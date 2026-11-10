"use client";

import {
  ChevronDown,
  Heart,
  ListMusic,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume1,
  Volume2,
  VolumeX,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { likeSong } from "@/lib/actions";
import { formatTime } from "@/lib/format";
import { useFavoriteIds, useSong } from "@/hooks/library";
import { usePlayer } from "@/store/player";
import { Artwork } from "./Artwork";
import { OfflineIndicator } from "./Badges";

function ProgressBar({ compact = false }: { compact?: boolean }) {
  const position = usePlayer((s) => s.position);
  const duration = usePlayer((s) => s.duration);
  const [drag, setDrag] = useState<number | null>(null);
  const value = drag ?? position;
  const max = duration || 0;
  const pct = max ? (Math.min(value, max) / max) * 100 : 0;
  return (
    <div className={`flex w-full items-center gap-2 text-[11px] tabular-nums text-muted ${compact ? "" : "max-w-[600px]"}`}>
      {!compact && <span className="w-10 text-right" data-testid="current-time">{formatTime(value)}</span>}
      <input
        type="range"
        className="slider"
        aria-label="Seek"
        min={0}
        max={max || 1}
        step={0.1}
        value={Math.min(value, max || 1)}
        disabled={!max}
        style={{ "--pct": `${pct}%` } as React.CSSProperties}
        onChange={(e) => setDrag(Number(e.target.value))}
        onPointerUp={() => {
          if (drag != null) usePlayer.getState().seek(drag);
          setDrag(null);
        }}
        onKeyUp={() => {
          if (drag != null) usePlayer.getState().seek(drag);
          setDrag(null);
        }}
      />
      {!compact && <span className="w-10" data-testid="duration">{formatTime(max)}</span>}
    </div>
  );
}

function VolumeControl() {
  const volume = usePlayer((s) => s.volume);
  const muted = usePlayer((s) => s.muted);
  const v = muted ? 0 : volume;
  const Icon = v === 0 ? VolumeX : v < 0.5 ? Volume1 : Volume2;
  return (
    <div className="flex w-32 items-center gap-2">
      <button aria-label={muted ? "Unmute" : "Mute"} className="text-muted hover:text-white" onClick={() => usePlayer.getState().toggleMute()}>
        <Icon size={18} />
      </button>
      <input
        type="range"
        className="slider"
        aria-label="Volume"
        min={0}
        max={1}
        step={0.01}
        value={v}
        style={{ "--pct": `${v * 100}%` } as React.CSSProperties}
        onChange={(e) => usePlayer.getState().setVolume(Number(e.target.value))}
      />
    </div>
  );
}

export function TransportControls({ large = false }: { large?: boolean }) {
  const isPlaying = usePlayer((s) => s.isPlaying);
  const shuffle = usePlayer((s) => s.shuffle);
  const repeat = usePlayer((s) => s.repeat);
  const hasQueue = usePlayer((s) => s.queue.length > 0);
  const p = usePlayer.getState;
  const RepeatIcon = repeat === "one" ? Repeat1 : Repeat;
  const iconSize = large ? 26 : 18;
  return (
    <div className={`flex items-center ${large ? "w-full justify-between" : "gap-4 md:gap-5"}`}>
      <button
        aria-label={shuffle ? "Disable shuffle" : "Enable shuffle"}
        aria-pressed={shuffle}
        onClick={() => p().toggleShuffle()}
        className={`relative ${shuffle ? "text-accent" : "text-muted hover:text-white"}`}
      >
        <Shuffle size={iconSize} />
        {shuffle && <span className="absolute -bottom-1.5 left-1/2 size-1 -translate-x-1/2 rounded-full bg-accent" />}
      </button>
      <button aria-label="Previous" disabled={!hasQueue} onClick={() => p().previous()} className="text-muted hover:text-white disabled:opacity-40">
        <SkipBack size={large ? 30 : 20} className="fill-current" />
      </button>
      <button
        aria-label={isPlaying ? "Pause" : "Play"}
        disabled={!hasQueue}
        onClick={() => p().togglePlay()}
        data-testid="play-pause"
        className={`grid place-items-center rounded-full bg-white text-black transition hover:scale-105 disabled:opacity-40 ${large ? "size-16" : "size-8"}`}
      >
        {isPlaying ? <Pause size={large ? 28 : 16} className="fill-black" /> : <Play size={large ? 28 : 16} className="ml-0.5 fill-black" />}
      </button>
      <button aria-label="Next" disabled={!hasQueue} onClick={() => p().next()} className="text-muted hover:text-white disabled:opacity-40">
        <SkipForward size={large ? 30 : 20} className="fill-current" />
      </button>
      <button
        aria-label={`Repeat: ${repeat}`}
        onClick={() => p().cycleRepeat()}
        className={`relative ${repeat !== "off" ? "text-accent" : "text-muted hover:text-white"}`}
      >
        <RepeatIcon size={iconSize} />
        {repeat !== "off" && <span className="absolute -bottom-1.5 left-1/2 size-1 -translate-x-1/2 rounded-full bg-accent" />}
      </button>
    </div>
  );
}

function LikeButton({ id, size = 16 }: { id: string; size?: number }) {
  const liked = useFavoriteIds().has(id);
  const song = useSong(id);
  if (!song) return null;
  return (
    <button aria-label={liked ? "Remove from Liked Songs" : "Save to Liked Songs"} onClick={() => likeSong(song)} className={liked ? "text-accent" : "text-muted hover:text-white"}>
      <Heart size={size} className={liked ? "fill-accent" : ""} />
    </button>
  );
}

export function PlayerBar() {
  const currentId = usePlayer((s) => s.queue[s.index]);
  const song = useSong(currentId);
  const queueOpen = usePlayer((s) => s.queueOpen);
  const isPlaying = usePlayer((s) => s.isPlaying);
  const position = usePlayer((s) => s.position);
  const duration = usePlayer((s) => s.duration);

  return (
    <footer
      className="fixed inset-x-0 z-50 bottom-[var(--mobile-nav-h)] h-[var(--player-h)] md:bg-black"
      data-testid="player-bar"
    >
      {/* Desktop / tablet */}
      <div className="hidden h-full grid-cols-[minmax(0,1fr)_minmax(0,2fr)_minmax(0,1fr)] items-center gap-4 px-4 md:grid">
        <div className="flex min-w-0 items-center gap-3">
          {song ? (
            <>
              <button onClick={() => usePlayer.getState().setNowPlayingOpen(true)} aria-label="Open now playing">
                <Artwork artworkId={song.artworkId} artworkUrl={song.artworkUrl} seed={song.album + song.artist} className="size-14" />
              </button>
              <div className="min-w-0">
                <div className="truncate text-sm font-medium" data-testid="now-playing-title">{song.title}</div>
                <div className="flex items-center gap-1.5 truncate text-xs text-muted">
                  <OfflineIndicator song={song} />
                  <Link href={`/artist?name=${encodeURIComponent(song.artist)}`} className="truncate hover:text-white hover:underline">
                    {song.artist}
                  </Link>
                </div>
              </div>
              <div className="ml-2 shrink-0">
                <LikeButton id={song.id} />
              </div>
            </>
          ) : (
            <span className="text-sm text-subtle">Nothing playing</span>
          )}
        </div>
        <div className="flex flex-col items-center gap-1.5">
          <TransportControls />
          <ProgressBar />
        </div>
        <div className="flex items-center justify-end gap-4">
          <button
            aria-label="Queue"
            aria-pressed={queueOpen}
            onClick={() => usePlayer.getState().setQueueOpen(!queueOpen)}
            className={queueOpen ? "text-accent" : "text-muted hover:text-white"}
          >
            <ListMusic size={18} />
          </button>
          <VolumeControl />
        </div>
      </div>

      {/* Mobile mini player */}
      <div className="h-full px-2 md:hidden">
        {song ? (
          <div className="relative flex h-[calc(100%-4px)] items-center gap-3 overflow-hidden rounded-md bg-[#2a2a2a] px-2">
            <button className="flex min-w-0 flex-1 items-center gap-3 text-left" aria-label="Open now playing" onClick={() => usePlayer.getState().setNowPlayingOpen(true)}>
              <Artwork artworkId={song.artworkId} artworkUrl={song.artworkUrl} seed={song.album + song.artist} className="size-10" />
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{song.title}</div>
                <div className="flex items-center gap-1.5 truncate text-xs text-muted">
                  <OfflineIndicator song={song} />
                  <span className="truncate">{song.artist}</span>
                </div>
              </div>
            </button>
            <LikeButton id={song.id} size={20} />
            <button aria-label={isPlaying ? "Pause" : "Play"} className="p-2" onClick={() => usePlayer.getState().togglePlay()}>
              {isPlaying ? <Pause size={22} className="fill-white" /> : <Play size={22} className="fill-white" />}
            </button>
            <div className="absolute inset-x-2 bottom-0 h-0.5 bg-white/20">
              <div className="h-full bg-white" style={{ width: `${duration ? (position / duration) * 100 : 0}%` }} />
            </div>
          </div>
        ) : null}
      </div>
    </footer>
  );
}

/** Full-screen now-playing view (mainly for phones; also opens from artwork on desktop). */
export function NowPlaying() {
  const open = usePlayer((s) => s.nowPlayingOpen);
  const currentId = usePlayer((s) => s.queue[s.index]);
  const contextLabel = usePlayer((s) => s.contextLabel);
  const song = useSong(currentId);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && usePlayer.getState().setNowPlayingOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!open || !song) return null;
  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-gradient-to-b from-[#2b4a3b] to-[#121212] px-6 pb-8 pt-4 animate-slide-up md:px-12">
      <div className="flex items-center justify-between">
        <button aria-label="Close now playing" onClick={() => usePlayer.getState().setNowPlayingOpen(false)} className="p-2">
          <ChevronDown size={26} />
        </button>
        <div className="truncate text-center text-xs font-semibold uppercase tracking-widest text-white/80">
          {contextLabel ?? "Now playing"}
        </div>
        <button aria-label="Queue" onClick={() => { usePlayer.getState().setNowPlayingOpen(false); usePlayer.getState().setQueueOpen(true); }} className="p-2">
          <ListMusic size={22} />
        </button>
      </div>
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-8">
        {song.source === "youtube" ? (
          <div className="grid aspect-square w-full place-items-center rounded-lg bg-black/30 p-6 text-center text-sm text-white/70">
            The video is playing in the YouTube player on screen.
          </div>
        ) : (
          <Artwork artworkId={song.artworkId} artworkUrl={song.artworkUrl} seed={song.album + song.artist} className="aspect-square w-full shadow-2xl shadow-black/50" rounded="rounded-lg" />
        )}
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="truncate text-2xl font-bold">{song.title}</div>
            <div className="flex items-center gap-2 truncate text-white/70">
              <OfflineIndicator song={song} />
              {song.artist}
            </div>
          </div>
          <LikeButton id={song.id} size={26} />
        </div>
        <div className="space-y-1">
          <ProgressBar compact />
          <NowPlayingTimes />
        </div>
        <TransportControls large />
      </div>
    </div>
  );
}

function NowPlayingTimes() {
  const position = usePlayer((s) => s.position);
  const duration = usePlayer((s) => s.duration);
  return (
    <div className="flex justify-between text-xs tabular-nums text-white/60">
      <span>{formatTime(position)}</span>
      <span>{formatTime(duration)}</span>
    </div>
  );
}
