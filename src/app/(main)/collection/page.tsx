"use client";

import { Shuffle, Sparkles } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo } from "react";
import { SongList } from "@/components/SongList";
import { ActionBar, EmptyState, HeroHeader, IconButton, PlayFab } from "@/components/ui";
import { formatTotalDuration, pluralize } from "@/lib/format";
import type { Song } from "@/lib/types";
import { useSongs } from "@/hooks/library";
import { usePlayer } from "@/store/player";

/** Smart collections generated from the library: genre, decade, most played, never played. */
function build(type: string, value: string, songs: Song[]): { title: string; songs: Song[] } {
  switch (type) {
    case "genre":
      return { title: value, songs: songs.filter((s) => s.genre?.toLowerCase() === value.toLowerCase()) };
    case "decade": {
      const d = Number(value);
      return { title: `${d}s`, songs: songs.filter((s) => s.year && s.year >= d && s.year < d + 10) };
    }
    case "most-played":
      return { title: "On Repeat", songs: songs.filter((s) => s.playCount > 0).sort((a, b) => b.playCount - a.playCount).slice(0, 50) };
    case "never-played":
      return { title: "Fresh Finds", songs: songs.filter((s) => !s.playCount).sort((a, b) => b.importedAt - a.importedAt) };
    default:
      return { title: "Collection", songs: [] };
  }
}

function CollectionView() {
  const params = useSearchParams();
  const type = params.get("type") ?? "";
  const value = params.get("value") ?? "";
  const all = useSongs();
  const { title, songs } = useMemo(() => build(type, value, all ?? []), [type, value, all]);
  const href = `/collection?${params}`;
  const active = usePlayer((s) => s.contextHref === href && s.queue.length > 0);
  if (!all) return null;
  const play = (shuffle?: boolean) => usePlayer.getState().playSongs(songs.map((s) => s.id), 0, { label: title, href, shuffle });
  const total = songs.reduce((t, s) => t + (s.duration || 0), 0);
  return (
    <div>
      <HeroHeader
        kind="Made from your library"
        title={title}
        gradient="from-fuchsia-900"
        image={<div className="grid size-full place-items-center rounded-md bg-gradient-to-br from-fuchsia-700 to-orange-400"><Sparkles size={64} /></div>}
        meta={<>{pluralize(songs.length, "song")}{total > 0 && <>, {formatTotalDuration(total)}</>}</>}
      />
      {songs.length > 0 && (
        <ActionBar>
          <PlayFab size="lg" isActive={active} onClick={() => play()} />
          <IconButton label="Shuffle play" onClick={() => play(true)}><Shuffle size={26} /></IconButton>
        </ActionBar>
      )}
      <div className="px-2">
        <SongList songs={songs} context={{ label: title, href }} empty={<EmptyState icon={Sparkles} title="Nothing here yet" />} />
      </div>
    </div>
  );
}

export default function CollectionPage() {
  return (
    <Suspense>
      <CollectionView />
    </Suspense>
  );
}
