"use client";

import { Clock3, Heart, Play } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { likeSong } from "@/lib/actions";
import { formatRelativeDate, formatTime } from "@/lib/format";
import type { Song } from "@/lib/types";
import { useFavoriteIds } from "@/hooks/library";
import { usePlayer } from "@/store/player";
import { Artwork } from "./Artwork";
import { OfflineIndicator } from "./Badges";
import { SongMenu } from "./SongMenu";

export interface PlayContext {
  label: string;
  href?: string;
}

export function Equalizer() {
  return (
    <span className="equalizer inline-flex h-3.5 items-end" aria-label="Now playing">
      <span className="h-full" />
      <span className="h-full" />
      <span className="h-full" />
    </span>
  );
}

export function SongRow({
  song,
  index,
  liked,
  onPlay,
  showAlbum = true,
  showDate = true,
  dateValue,
  onRemoveFromPlaylist,
  dragHandle,
}: {
  song: Song;
  index: number;
  liked: boolean;
  onPlay: () => void;
  showAlbum?: boolean;
  showDate?: boolean;
  dateValue?: number;
  onRemoveFromPlaylist?: () => void;
  dragHandle?: ReactNode;
}) {
  const isCurrent = usePlayer((s) => s.queue[s.index] === song.id);
  const isPlaying = usePlayer((s) => s.isPlaying && s.queue[s.index] === song.id);
  const unavailable = song.source === "local" && !song.offline && !song.cloudPath;

  return (
    <div
      role="row"
      data-testid="song-row"
      onClick={onPlay}
      onKeyDown={(e) => e.key === "Enter" && onPlay()}
      tabIndex={0}
      className={`group grid cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 outline-none hover:bg-white/[0.07] focus-visible:bg-white/10 md:px-4 ${
        showAlbum
          ? "md:grid-cols-[2rem_minmax(0,4fr)_minmax(0,3fr)_auto] lg:grid-cols-[2rem_minmax(0,4fr)_minmax(0,3fr)_minmax(0,2fr)_auto]"
          : "md:grid-cols-[2rem_minmax(0,1fr)_auto]"
      } ${dragHandle ? "grid-cols-[auto_minmax(0,1fr)_auto]" : "grid-cols-[minmax(0,1fr)_auto]"} ${unavailable ? "opacity-50" : ""}`}
    >
      <div className={`${dragHandle ? "flex" : "hidden md:flex"} w-8 justify-center text-sm tabular-nums text-muted`}>
        {dragHandle}
        <span className={`group-hover:hidden ${dragHandle ? "hidden" : ""} ${isCurrent ? "text-accent" : ""}`}>
          {isPlaying ? <Equalizer /> : index + 1}
        </span>
        {!dragHandle && <Play size={14} className="hidden fill-white text-white group-hover:block" />}
      </div>
      <div className="flex min-w-0 items-center gap-3">
        <Artwork artworkId={song.artworkId} artworkUrl={song.artworkUrl} seed={song.album + song.artist} className="size-10" />
        <div className="min-w-0">
          <div className={`truncate text-[15px] ${isCurrent ? "text-accent" : "text-white"}`}>{song.title}</div>
          <div className="flex min-w-0 items-center gap-1.5 text-sm text-muted">
            <OfflineIndicator song={song} />
            <Link
              href={`/artist?name=${encodeURIComponent(song.artist)}`}
              onClick={(e) => e.stopPropagation()}
              className="truncate hover:text-white hover:underline"
            >
              {song.artist}
            </Link>
          </div>
        </div>
      </div>
      {showAlbum && (
        <div className="hidden min-w-0 truncate text-sm text-muted md:block">
          {song.source === "youtube" ? (
            <span>YouTube</span>
          ) : (
            <Link
              href={`/album?name=${encodeURIComponent(song.album)}&artist=${encodeURIComponent(song.artist)}`}
              onClick={(e) => e.stopPropagation()}
              className="hover:text-white hover:underline"
            >
              {song.album}
            </Link>
          )}
        </div>
      )}
      {showAlbum && showDate && (
        <div className="hidden truncate text-sm text-muted lg:block">{formatRelativeDate(dateValue ?? song.importedAt)}</div>
      )}
      <div className="flex items-center justify-end gap-1 md:gap-3">
        <button
          aria-label={liked ? "Remove from Liked Songs" : "Save to Liked Songs"}
          onClick={(e) => {
            e.stopPropagation();
            void likeSong(song);
          }}
          className={`hidden size-8 place-items-center md:grid ${liked ? "text-accent" : "text-muted opacity-0 hover:text-white group-hover:opacity-100 focus-visible:opacity-100"}`}
        >
          <Heart size={16} className={liked ? "fill-accent" : ""} />
        </button>
        <span className="hidden w-12 text-right text-sm tabular-nums text-muted md:inline">
          {song.duration ? formatTime(song.duration) : "–"}
        </span>
        <SongMenu song={song} liked={liked} onRemoveFromPlaylist={onRemoveFromPlaylist} className="md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100" />
      </div>
    </div>
  );
}

export function SongListHeader({ showAlbum = true, showDate = true, dateLabel = "Date added" }: { showAlbum?: boolean; showDate?: boolean; dateLabel?: string }) {
  return (
    <div
      className={`sticky top-16 z-10 mb-2 hidden items-center gap-3 border-b border-white/10 bg-bg/95 px-4 py-2 text-xs uppercase tracking-wider text-muted backdrop-blur md:grid ${
        showAlbum
          ? "md:grid-cols-[2rem_minmax(0,4fr)_minmax(0,3fr)_auto] lg:grid-cols-[2rem_minmax(0,4fr)_minmax(0,3fr)_minmax(0,2fr)_auto]"
          : "md:grid-cols-[2rem_minmax(0,1fr)_auto]"
      }`}
    >
      <span className="text-center">#</span>
      <span>Title</span>
      {showAlbum && <span>Album</span>}
      {showAlbum && showDate && <span className="hidden lg:block">{dateLabel}</span>}
      <span className="flex w-[8.5rem] justify-end pr-10">
        <Clock3 size={15} aria-label="Duration" />
      </span>
    </div>
  );
}

export function SongList({
  songs,
  context,
  showAlbum = true,
  showDate = true,
  dates,
  dateLabel,
  empty,
}: {
  songs: Song[];
  context: PlayContext;
  showAlbum?: boolean;
  showDate?: boolean;
  dates?: number[];
  dateLabel?: string;
  empty?: ReactNode;
}) {
  const liked = useFavoriteIds();
  if (!songs.length) return <>{empty ?? null}</>;
  const ids = songs.map((s) => s.id);
  return (
    <div role="table" aria-label={context.label}>
      <SongListHeader showAlbum={showAlbum} showDate={showDate} dateLabel={dateLabel} />
      {songs.map((song, i) => (
        <SongRow
          key={`${song.id}-${i}`}
          song={song}
          index={i}
          liked={liked.has(song.id)}
          showAlbum={showAlbum}
          showDate={showDate}
          dateValue={dates?.[i]}
          onPlay={() => usePlayer.getState().playSongs(ids, i, { label: context.label, href: context.href })}
        />
      ))}
    </div>
  );
}
