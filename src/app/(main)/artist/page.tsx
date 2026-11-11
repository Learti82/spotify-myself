"use client";

import { Shuffle, User } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo } from "react";
import { Artwork } from "@/components/Artwork";
import { SongList } from "@/components/SongList";
import { ActionBar, CardRow, EmptyState, HeroHeader, IconButton, MediaCard, PlayFab, Section } from "@/components/ui";
import { groupAlbums } from "@/lib/derive";
import { pluralize } from "@/lib/format";
import { useSongs } from "@/hooks/library";
import { usePlayer } from "@/store/player";

function ArtistView() {
  const name = useSearchParams().get("name") ?? "";
  const songs = useSongs();
  const mine = useMemo(
    () => (songs ?? []).filter((s) => s.artist.toLowerCase() === name.toLowerCase()).sort((a, b) => b.playCount - a.playCount || b.importedAt - a.importedAt),
    [songs, name],
  );
  const albums = useMemo(() => groupAlbums(mine), [mine]);
  const href = `/artist?name=${encodeURIComponent(name)}`;
  const active = usePlayer((s) => s.contextHref === href && s.queue.length > 0);
  if (!songs) return null;
  if (!mine.length) return <EmptyState icon={User} title="Artist not found" />;
  const art = mine.find((s) => s.artworkId || s.artworkUrl);
  const plays = mine.reduce((t, s) => t + s.playCount, 0);
  const play = (shuffle?: boolean) => usePlayer.getState().playSongs(mine.map((s) => s.id), 0, { label: mine[0].artist, href, shuffle });
  return (
    <div>
      <HeroHeader
        kind="Artist"
        title={mine[0].artist}
        gradient="from-sky-900"
        image={<Artwork artworkId={art?.artworkId} artworkUrl={art?.artworkUrl} seed={name} className="size-full" rounded="rounded-full" icon={User} />}
        meta={<>{pluralize(mine.length, "song")} in your library · {pluralize(plays, "play")}</>}
      />
      <ActionBar>
        <PlayFab size="lg" isActive={active} onClick={() => play()} label="Play artist" />
        <IconButton label="Shuffle play" onClick={() => play(true)}><Shuffle size={26} /></IconButton>
      </ActionBar>
      <div className="px-2">
        <h2 className="mb-3 px-2 text-xl font-bold md:px-4">Songs</h2>
        <SongList songs={mine} context={{ label: mine[0].artist, href }} showDate={false} />
      </div>
      {albums.length > 0 && (
        <div className="px-4 pt-8 md:px-6">
          <Section title="Albums">
            <CardRow>
              {albums.map((a) => (
                <MediaCard
                  key={a.key}
                  href={`/album?name=${encodeURIComponent(a.name)}&artist=${encodeURIComponent(a.artist)}`}
                  title={a.name}
                  subtitle={`${a.year ?? "Album"} · ${pluralize(a.songs.length, "song")}`}
                  image={<Artwork artworkId={a.artworkId} artworkUrl={a.artworkUrl} seed={a.name + a.artist} className="size-full" rounded="" />}
                />
              ))}
            </CardRow>
          </Section>
        </div>
      )}
    </div>
  );
}

export default function ArtistPage() {
  return (
    <Suspense>
      <ArtistView />
    </Suspense>
  );
}
