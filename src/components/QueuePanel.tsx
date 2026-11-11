"use client";

import { X } from "lucide-react";
import Link from "next/link";
import { useSongMap } from "@/hooks/library";
import { usePlayer } from "@/store/player";
import { Artwork } from "./Artwork";
import { OfflineIndicator } from "./Badges";
import { Equalizer } from "./SongList";
import type { Song } from "@/lib/types";

function QueueItem({ song, index, current }: { song: Song; index: number; current?: boolean }) {
  return (
    <div className="group flex items-center gap-3 rounded-md p-2 hover:bg-white/[0.07]">
      <button className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => usePlayer.getState().jumpTo(index)}>
        <Artwork artworkId={song.artworkId} artworkUrl={song.artworkUrl} seed={song.album + song.artist} className="size-10" />
        <div className="min-w-0">
          <div className={`flex items-center gap-2 truncate text-sm ${current ? "text-accent" : ""}`}>
            {current && <Equalizer />}
            <span className="truncate">{song.title}</span>
          </div>
          <div className="flex items-center gap-1.5 truncate text-xs text-muted">
            <OfflineIndicator song={song} />
            <span className="truncate">{song.artist}</span>
          </div>
        </div>
      </button>
      {!current && (
        <button
          aria-label={`Remove ${song.title} from queue`}
          onClick={() => usePlayer.getState().removeFromQueue(index)}
          className="text-muted opacity-0 hover:text-white group-hover:opacity-100 focus-visible:opacity-100"
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
}

export function QueuePanel() {
  const open = usePlayer((s) => s.queueOpen);
  const queue = usePlayer((s) => s.queue);
  const index = usePlayer((s) => s.index);
  const label = usePlayer((s) => s.contextLabel);
  const href = usePlayer((s) => s.contextHref);
  const songs = useSongMap();
  if (!open) return null;
  const current = songs.get(queue[index]);
  const upcoming = queue.slice(index + 1).map((id, i) => ({ song: songs.get(id), i: index + 1 + i }));
  return (
    <aside
      className="fixed inset-x-0 top-0 bottom-[calc(var(--player-h)+var(--mobile-nav-h))] z-[55] flex flex-col bg-surface animate-fade-in md:static md:inset-auto md:z-auto md:w-[340px] md:shrink-0 md:rounded-lg"
      aria-label="Queue"
    >
      <div className="flex items-center justify-between px-4 py-4">
        <h2 className="font-bold">Queue</h2>
        <button aria-label="Close queue" onClick={() => usePlayer.getState().setQueueOpen(false)} className="text-muted hover:text-white">
          <X size={20} />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
        <h3 className="px-2 pb-2 text-sm font-semibold">Now playing</h3>
        {current ? <QueueItem song={current} index={index} current /> : <p className="px-2 text-sm text-muted">Nothing playing.</p>}
        <div className="flex items-center justify-between px-2 pb-2 pt-6">
          <h3 className="truncate text-sm font-semibold">
            Next{label ? <> from: {href ? <Link href={href} className="hover:underline">{label}</Link> : label}</> : ""}
          </h3>
          {upcoming.length > 0 && (
            <button className="shrink-0 text-xs font-semibold text-muted hover:text-white" onClick={() => usePlayer.getState().clearUpcoming()}>
              Clear
            </button>
          )}
        </div>
        {upcoming.length === 0 && <p className="px-2 text-sm text-muted">Nothing queued. Use “Add to queue” on any song.</p>}
        {upcoming.map(({ song, i }) => (song ? <QueueItem key={`${song.id}-${i}`} song={song} index={i} /> : null))}
      </div>
    </aside>
  );
}
