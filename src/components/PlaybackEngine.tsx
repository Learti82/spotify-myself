"use client";

import { Minimize2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { resolvePlayableSource } from "@/lib/audio-source";
import { getArtworkUrl } from "@/lib/artwork";
import { db } from "@/lib/db";
import { recordPlay } from "@/lib/library";
import type { Song } from "@/lib/types";
import { useSong } from "@/hooks/library";
import { registerEngine, usePlayer } from "@/store/player";
import { toast } from "@/store/ui";

// ---------- Minimal typings for the official YouTube IFrame Player API ----------
interface YTPlayer {
  loadVideoById(id: string, start?: number): void;
  cueVideoById(id: string, start?: number): void;
  playVideo(): void;
  pauseVideo(): void;
  stopVideo(): void;
  seekTo(s: number, allowSeekAhead: boolean): void;
  getCurrentTime(): number;
  getDuration(): number;
  setVolume(v: number): void;
  mute(): void;
  unMute(): void;
  destroy(): void;
}
interface YTNamespace {
  Player: new (
    el: HTMLElement,
    opts: {
      width?: string | number;
      height?: string | number;
      videoId?: string;
      playerVars?: Record<string, string | number>;
      events?: Record<string, (e: { data: number; target: YTPlayer }) => void>;
    },
  ) => YTPlayer;
}
declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let ytPromise: Promise<YTNamespace> | null = null;
function loadYouTubeApi(): Promise<YTNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  ytPromise ??= new Promise((resolve, reject) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve(window.YT!);
    };
    const s = document.createElement("script");
    s.src = "https://www.youtube.com/iframe_api";
    s.async = true;
    s.onerror = () => {
      ytPromise = null;
      reject(new Error("Couldn't load the YouTube player. Check your connection."));
    };
    document.head.appendChild(s);
  });
  return ytPromise;
}

// Skip unplayable tracks, but stop once every track in the queue has failed.
let consecutiveFailures = 0;
function failAndSkip(message: string) {
  toast(message, "error");
  const { queue } = usePlayer.getState();
  consecutiveFailures++;
  if (consecutiveFailures >= queue.length) {
    consecutiveFailures = 0;
    usePlayer.getState().setPlaying(false);
    return;
  }
  usePlayer.getState().next(true);
}

let restoredPosition = false;

export function PlaybackEngine() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const currentId = usePlayer((s) => s.queue[s.index]);
  const playToken = usePlayer((s) => s.playToken);
  const isPlaying = usePlayer((s) => s.isPlaying);
  const volume = usePlayer((s) => s.volume);
  const muted = usePlayer((s) => s.muted);
  const song = useSong(currentId);
  const isYouTube = song?.source === "youtube";
  const playedRef = useRef<string | null>(null);
  /** Changing src fires a "pause" event; it must not flip the play state. */
  const switchingRef = useRef(false);

  // ----- HTML audio element: local/offline files and authorized URLs -----
  useEffect(() => {
    const audio = audioRef.current!;
    if (!currentId) {
      audio.pause();
      audio.removeAttribute("src");
      return;
    }
    let cancelled = false;
    let release: (() => void) | undefined;
    (async () => {
      const s = await db.songs.get(currentId);
      if (cancelled || !s) return;
      if (s.source === "youtube") {
        audio.pause();
        audio.removeAttribute("src");
        audio.load();
        return;
      }
      try {
        const src = await resolvePlayableSource(s);
        if (cancelled) return src.release();
        release = src.release;
        switchingRef.current = true;
        audio.src = src.url;
        playedRef.current = null;
        const state = usePlayer.getState();
        if (!restoredPosition) {
          restoredPosition = true;
          if (state.position > 0) audio.currentTime = state.position;
        }
        registerEngine({ seek: (t) => (audio.currentTime = t), getTime: () => audio.currentTime });
        if (state.isPlaying) {
          audio.play().catch((err) => {
            if (err?.name === "NotAllowedError") usePlayer.getState().setPlaying(false);
          });
        }
      } catch (err) {
        if (!cancelled) failAndSkip((err as Error).message);
      }
    })();
    return () => {
      cancelled = true;
      release?.();
    };
  }, [currentId, playToken]);

  useEffect(() => {
    const audio = audioRef.current!;
    if (isYouTube || !audio.src) return;
    if (isPlaying && audio.paused) {
      audio.play().catch((err) => {
        if (err?.name === "NotAllowedError") usePlayer.getState().setPlaying(false);
      });
    } else if (!isPlaying && !audio.paused) audio.pause();
  }, [isPlaying, isYouTube]);

  useEffect(() => {
    const audio = audioRef.current!;
    audio.volume = volume;
    audio.muted = muted;
  }, [volume, muted]);

  // ----- Media Session: lock screen / hardware media keys -----
  useMediaSession(song);

  useEffect(() => {
    document.title = song ? `${song.title} • ${song.artist}` : "Cadence";
  }, [song]);

  return (
    <>
      <audio
        ref={audioRef}
        preload="auto"
        onTimeUpdate={(e) => {
          const a = e.currentTarget;
          usePlayer.getState().setProgress(a.currentTime, Number.isFinite(a.duration) ? a.duration : undefined);
        }}
        onLoadedMetadata={(e) => {
          const a = e.currentTarget;
          usePlayer.getState().setProgress(a.currentTime, a.duration);
        }}
        onPlaying={() => {
          consecutiveFailures = 0;
          if (currentId && playedRef.current !== `${currentId}:${playToken}`) {
            playedRef.current = `${currentId}:${playToken}`;
            void recordPlay(currentId);
          }
          if (!usePlayer.getState().isPlaying) usePlayer.getState().setPlaying(true);
        }}
        onCanPlay={() => (switchingRef.current = false)}
        onPause={(e) => {
          if (switchingRef.current) return;
          if (!e.currentTarget.ended && usePlayer.getState().isPlaying && !isYouTube) usePlayer.getState().setPlaying(false);
        }}
        onEnded={() => usePlayer.getState().next(true)}
        onError={(e) => {
          if (!e.currentTarget.getAttribute("src") || isYouTube) return;
          failAndSkip(`Couldn't play "${song?.title ?? "this track"}". The format may not be supported by this browser.`);
        }}
        className="hidden"
        data-testid="audio-engine"
      />
      {isYouTube && song?.youtubeId && <YouTubePanel song={song} playToken={playToken} />}
    </>
  );
}

/** The official, visible YouTube embed. Audio is never extracted from it. */
function YouTubePanel({ song, playToken }: { song: Song; playToken: number }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const readyRef = useRef(false);
  const playedRef = useRef<string | null>(null);
  const [compact, setCompact] = useState(false);
  const isPlaying = usePlayer((s) => s.isPlaying);
  const volume = usePlayer((s) => s.volume);
  const muted = usePlayer((s) => s.muted);
  const videoId = song.youtubeId!;

  useEffect(() => {
    if (!navigator.onLine) {
      failAndSkip(`"${song.title}" is a YouTube stream and needs an internet connection.`);
      return;
    }
    let cancelled = false;
    const start = () => {
      const p = playerRef.current!;
      const state = usePlayer.getState();
      const resume = !restoredPosition && state.position > 0 ? state.position : 0;
      restoredPosition = true;
      if (state.isPlaying) p.loadVideoById(videoId, resume);
      else p.cueVideoById(videoId, resume);
      p.setVolume(Math.round(state.volume * 100));
      if (state.muted) p.mute();
    };
    if (playerRef.current && readyRef.current) {
      start();
    } else if (!playerRef.current) {
      loadYouTubeApi()
        .then((YT) => {
          if (cancelled || !hostRef.current) return;
          const el = document.createElement("div");
          hostRef.current.appendChild(el);
          playerRef.current = new YT.Player(el, {
            width: "100%",
            height: "100%",
            playerVars: { playsinline: 1, rel: 0, modestbranding: 1, origin: window.location.origin },
            events: {
              onReady: () => {
                readyRef.current = true;
                registerEngine({
                  seek: (t) => playerRef.current?.seekTo(t, true),
                  getTime: () => playerRef.current?.getCurrentTime() ?? 0,
                });
                start();
              },
              onStateChange: (e) => {
                const st = usePlayer.getState();
                if (e.data === 1) {
                  consecutiveFailures = 0;
                  if (!st.isPlaying) st.setPlaying(true);
                  const key = `${song.id}:${usePlayer.getState().playToken}`;
                  if (playedRef.current !== key) {
                    playedRef.current = key;
                    void recordPlay(song.id);
                  }
                } else if (e.data === 2 && st.isPlaying) st.setPlaying(false);
                else if (e.data === 0) st.next(true);
              },
              onError: () => failAndSkip(`YouTube can't play "${song.title}" in an embedded player.`),
            },
          });
        })
        .catch((err) => failAndSkip(err.message));
    }
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId, playToken]);

  useEffect(() => {
    const p = playerRef.current;
    if (!p || !readyRef.current) return;
    if (isPlaying) p.playVideo();
    else p.pauseVideo();
  }, [isPlaying]);

  useEffect(() => {
    const p = playerRef.current;
    if (!p || !readyRef.current) return;
    p.setVolume(Math.round(volume * 100));
    if (muted) p.mute();
    else p.unMute();
  }, [volume, muted]);

  // Progress polling (the IFrame API has no timeupdate event).
  useEffect(() => {
    const t = setInterval(() => {
      const p = playerRef.current;
      if (!p || !readyRef.current) return;
      const d = p.getDuration?.() ?? 0;
      usePlayer.getState().setProgress(p.getCurrentTime?.() ?? 0, d || undefined);
    }, 500);
    return () => clearInterval(t);
  }, []);

  useEffect(
    () => () => {
      playerRef.current?.destroy();
      playerRef.current = null;
      readyRef.current = false;
      registerEngine(null);
    },
    [],
  );

  return (
    <div
      className={`fixed z-40 overflow-hidden rounded-xl border border-white/10 bg-black shadow-2xl transition-all right-3 bottom-[calc(var(--player-h)+var(--mobile-nav-h)+12px)] ${
        compact ? "w-[200px]" : "w-[356px] max-w-[calc(100vw-24px)]"
      }`}
      data-testid="youtube-panel"
    >
      <div className="flex items-center justify-between gap-2 bg-[#181818] px-3 py-1.5 text-xs text-neutral-300">
        <span className="truncate">YouTube · streaming only</span>
        <div className="flex items-center gap-1">
          <button
            className="rounded p-1 hover:bg-white/10"
            onClick={() => setCompact((c) => !c)}
            aria-label={compact ? "Larger video" : "Smaller video"}
          >
            <Minimize2 size={14} />
          </button>
          <button
            className="rounded p-1 hover:bg-white/10"
            onClick={() => usePlayer.getState().setPlaying(false)}
            aria-label="Pause"
            title="Pause"
          >
            <X size={14} />
          </button>
        </div>
      </div>
      {/* The embed stays at least 200px tall, as YouTube's player policies require. */}
      <div ref={hostRef} className={compact ? "h-[200px]" : "aspect-video min-h-[200px]"} />
    </div>
  );
}

function useMediaSession(song: Song | undefined) {
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    const ms = navigator.mediaSession;
    const p = usePlayer.getState;
    ms.setActionHandler("play", () => p().setPlaying(true));
    ms.setActionHandler("pause", () => p().setPlaying(false));
    ms.setActionHandler("nexttrack", () => p().next());
    ms.setActionHandler("previoustrack", () => p().previous());
    try {
      ms.setActionHandler("seekto", (d) => d.seekTime != null && p().seek(d.seekTime));
      ms.setActionHandler("seekbackward", () => p().seek(Math.max(0, p().position - 10)));
      ms.setActionHandler("seekforward", () => p().seek(p().position + 10));
    } catch {}
  }, []);

  useEffect(() => {
    if (!("mediaSession" in navigator) || !song) return;
    let cancelled = false;
    (async () => {
      const art = song.artworkId ? await getArtworkUrl(song.artworkId) : song.artworkUrl;
      if (cancelled) return;
      navigator.mediaSession.metadata = new MediaMetadata({
        title: song.title,
        artist: song.artist,
        album: song.album,
        artwork: art ? [{ src: art, sizes: "512x512" }] : [{ src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" }],
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [song]);

  const isPlaying = usePlayer((s) => s.isPlaying);
  useEffect(() => {
    if ("mediaSession" in navigator) navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";
  }, [isPlaying]);
}
