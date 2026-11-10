"use client";

import { CircleArrowDown, Disc3, Shuffle } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo } from "react";
import { Artwork } from "@/components/Artwork";
import { SongList } from "@/components/SongList";
import { ActionBar, EmptyState, HeroHeader, IconButton, PlayFab } from "@/components/ui";
import { downloadMany } from "@/lib/actions";
import { canDownload } from "@/lib/audio-source";
import { groupAlbums } from "@/lib/derive";
import { formatTotalDuration, pluralize } from "@/lib/format";
import { useSongs } from "@/hooks/library";
import { usePlayer } from "@/store/player";

function AlbumView() {
  const params = useSearchParams();
  const name = params.get("name") ?? "";
  const artist = params.get("artist") ?? "";
  const songs = useSongs();
  const album = useMemo(
    () => groupAlbums(songs ?? []).find((a) => a.name.toLowerCase() === name.toLowerCase() && (!artist || a.artist.toLowerCase() === artist.toLowerCase())),
    [songs, name, artist],
  );
  const href = `/album?name=${encodeURIComponent(name)}&artist=${encodeURIComponent(artist)}`;
  const active = usePlayer((s) => s.contextHref === href && s.queue.length > 0);
  if (!songs) return null;
  if (!album) return <EmptyState icon={Disc3} title="Album not found" />;
  const play = (shuffle?: boolean) => usePlayer.getState().playSongs(album.songs.map((s) => s.id), 0, { label: album.name, href, shuffle });
  return (
    <div>
      <HeroHeader
        kind="Album"
        title={album.name}
        image={<Artwork artworkId={album.artworkId} artworkUrl={album.artworkUrl} seed={album.name + album.artist} className="size-full" rounded="rounded-md" icon={Disc3} />}
        meta={
          <>
            <Link href={`/artist?name=${encodeURIComponent(album.artist)}`} className="font-semibold text-white hover:underline">{album.artist}</Link>
            {album.year ? <> · {album.year}</> : null} · {pluralize(album.songs.length, "song")}, {formatTotalDuration(album.duration)}
          </>
        }
      />
      <ActionBar>
        <PlayFab size="lg" isActive={active} onClick={() => play()} label="Play album" />
        <IconButton label="Shuffle play" onClick={() => play(true)}><Shuffle size={26} /></IconButton>
        {album.songs.some(canDownload) && (
          <IconButton label="Download album" onClick={() => downloadMany(album.songs)}><CircleArrowDown size={28} /></IconButton>
        )}
      </ActionBar>
      <div className="px-2">
        <SongList songs={album.songs} context={{ label: album.name, href }} showAlbum={false} />
      </div>
    </div>
  );
}

export default function AlbumPage() {
  return (
    <Suspense>
      <AlbumView />
    </Suspense>
  );
}
