"use client";

import { Heart, Shuffle } from "lucide-react";
import { SongList } from "@/components/SongList";
import { ActionBar, EmptyState, HeroHeader, IconButton, PlayFab } from "@/components/ui";
import { formatTotalDuration, pluralize } from "@/lib/format";
import { useLikedSongs } from "@/hooks/library";
import { usePlayer } from "@/store/player";

export default function LikedPage() {
  const songs = useLikedSongs();
  const active = usePlayer((s) => s.contextHref === "/liked" && s.queue.length > 0);
  const list = songs ?? [];
  const play = (shuffle?: boolean) => usePlayer.getState().playSongs(list.map((s) => s.id), 0, { label: "Liked Songs", href: "/liked", shuffle });
  const total = list.reduce((t, s) => t + (s.duration || 0), 0);
  return (
    <div>
      <HeroHeader
        kind="Playlist"
        title="Liked Songs"
        gradient="from-indigo-800"
        image={<div className="grid size-full place-items-center rounded-md bg-gradient-to-br from-indigo-700 to-emerald-300"><Heart size={72} className="fill-white" /></div>}
        meta={<>{pluralize(list.length, "song")}{total > 0 && <>, {formatTotalDuration(total)}</>}</>}
      />
      {list.length > 0 && (
        <ActionBar>
          <PlayFab size="lg" isActive={active} onClick={() => play()} label="Play liked songs" />
          <IconButton label="Shuffle play" onClick={() => play(true)}><Shuffle size={26} /></IconButton>
        </ActionBar>
      )}
      <div className="px-2">
        <SongList
          songs={list}
          context={{ label: "Liked Songs", href: "/liked" }}
          empty={songs && <EmptyState icon={Heart} title="Songs you like will appear here">Save songs by tapping the heart icon.</EmptyState>}
        />
      </div>
    </div>
  );
}
