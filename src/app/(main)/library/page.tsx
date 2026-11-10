"use client";

import { Library, ListMusic, MonitorPlay, Upload } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo } from "react";
import { Artwork, Mosaic } from "@/components/Artwork";
import { Button } from "@/components/Modal";
import { SongList } from "@/components/SongList";
import { CardGrid, Chip, EmptyState, MediaCard, PageContainer } from "@/components/ui";
import { groupAlbums, groupArtists } from "@/lib/derive";
import { pluralize } from "@/lib/format";
import { getPlaylistSongIds } from "@/lib/library";
import type { Song } from "@/lib/types";
import { usePlaylistsWithStats, useSongs } from "@/hooks/library";
import { usePlayer } from "@/store/player";

const TABS = [
  ["songs", "Songs"],
  ["albums", "Albums"],
  ["artists", "Artists"],
  ["playlists", "Playlists"],
  ["youtube", "YouTube"],
] as const;

const SORTS: Record<string, [string, (a: Song, b: Song) => number]> = {
  recent: ["Recently added", (a, b) => b.importedAt - a.importedAt],
  title: ["Title", (a, b) => a.title.localeCompare(b.title)],
  artist: ["Artist", (a, b) => a.artist.localeCompare(b.artist) || a.album.localeCompare(b.album) || (a.trackNo ?? 0) - (b.trackNo ?? 0)],
  album: ["Album", (a, b) => a.album.localeCompare(b.album) || (a.trackNo ?? 0) - (b.trackNo ?? 0)],
  plays: ["Most played", (a, b) => b.playCount - a.playCount],
  duration: ["Duration", (a, b) => b.duration - a.duration],
};

function LibraryView() {
  const params = useSearchParams();
  const router = useRouter();
  const tab = params.get("tab") ?? "songs";
  const sort = params.get("sort") ?? "recent";
  const songs = useSongs();
  const playlists = usePlaylistsWithStats();
  const contextHref = usePlayer((s) => (s.queue.length ? s.contextHref : undefined));
  const setParam = (k: string, v: string) => {
    const next = new URLSearchParams(params);
    next.set(k, v);
    router.replace(`/library?${next}`);
  };

  const sorted = useMemo(() => [...(songs ?? [])].filter((s) => s.source !== "youtube").sort(SORTS[sort]?.[1] ?? SORTS.recent[1]), [songs, sort]);
  const youtube = useMemo(() => (songs ?? []).filter((s) => s.source === "youtube").sort((a, b) => b.importedAt - a.importedAt), [songs]);
  const albums = useMemo(() => groupAlbums(songs ?? []), [songs]);
  const artists = useMemo(() => groupArtists(songs ?? []), [songs]);

  return (
    <PageContainer>
      <div className="mb-4 flex items-center justify-between gap-4">
        <h1 className="text-3xl font-bold">Your Library</h1>
        <Link href="/import"><Button variant="secondary"><Upload size={16} /> Import</Button></Link>
      </div>
      <div className="-mx-4 mb-6 flex gap-2 overflow-x-auto px-4" role="tablist">
        {TABS.map(([key, label]) => (
          <Chip key={key} active={tab === key} onClick={() => setParam("tab", key)}>{label}</Chip>
        ))}
      </div>

      {songs?.length === 0 && (
        <EmptyState icon={Library} title="Nothing here yet" action={<Link href="/import"><Button><Upload size={16} /> Import music</Button></Link>}>
          Import your audio files to start building your library.
        </EmptyState>
      )}

      {tab === "songs" && sorted.length > 0 && (
        <>
          <div className="mb-3 flex items-center justify-between text-sm text-muted">
            <span>{pluralize(sorted.length, "song")}</span>
            <label className="flex items-center gap-2">
              Sort by
              <select value={sort} onChange={(e) => setParam("sort", e.target.value)} className="rounded bg-elevated px-2 py-1 text-white">
                {Object.entries(SORTS).map(([k, [label]]) => <option key={k} value={k}>{label}</option>)}
              </select>
            </label>
          </div>
          <SongList songs={sorted} context={{ label: "Your Library", href: "/library" }} />
        </>
      )}

      {tab === "albums" && (
        <CardGrid>
          {albums.map((a) => {
            const href = `/album?name=${encodeURIComponent(a.name)}&artist=${encodeURIComponent(a.artist)}`;
            return (
              <MediaCard
                key={a.key}
                href={href}
                title={a.name}
                subtitle={<>{a.year ? `${a.year} · ` : ""}{a.artist}</>}
                image={<Artwork artworkId={a.artworkId} artworkUrl={a.artworkUrl} seed={a.name + a.artist} className="size-full" rounded="" />}
                isActive={contextHref === href}
                onPlay={() => usePlayer.getState().playSongs(a.songs.map((s) => s.id), 0, { label: a.name, href })}
              />
            );
          })}
        </CardGrid>
      )}

      {tab === "artists" && (
        <CardGrid>
          {artists.map((a) => (
            <MediaCard
              key={a.name}
              href={`/artist?name=${encodeURIComponent(a.name)}`}
              title={a.name}
              subtitle={`${pluralize(a.songs.length, "song")}${a.albums ? ` · ${pluralize(a.albums, "album")}` : ""}`}
              round
              image={<Artwork artworkId={a.artworkId} artworkUrl={a.artworkUrl} seed={a.name} className="size-full" rounded="" />}
            />
          ))}
        </CardGrid>
      )}

      {tab === "playlists" && (
        <CardGrid>
          {playlists?.map((p) => {
            const href = `/playlist?id=${p.id}`;
            return (
              <MediaCard
                key={p.id}
                href={href}
                title={p.name}
                subtitle={pluralize(p.songCount, "song")}
                image={<Mosaic coverId={p.coverId} artworkIds={p.firstArtworkIds} artworkUrls={p.firstArtworkUrls} seed={p.id} className="size-full" rounded="" icon={ListMusic} />}
                isActive={contextHref === href}
                onPlay={p.songCount ? async () => usePlayer.getState().playSongs(await getPlaylistSongIds(p.id), 0, { label: p.name, href }) : undefined}
              />
            );
          })}
        </CardGrid>
      )}

      {tab === "youtube" && (
        <>
          <div className="mb-4 flex items-start gap-3 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-neutral-200">
            <MonitorPlay size={18} className="mt-0.5 shrink-0 text-red-400" />
            <p>
              YouTube items stream through YouTube&apos;s official embedded player and need an internet connection.
              They are never downloaded or converted, so they don&apos;t appear in Offline Music.
            </p>
          </div>
          <SongList
            songs={youtube}
            context={{ label: "YouTube Collection", href: "/library?tab=youtube" }}
            empty={<EmptyState icon={MonitorPlay} title="No YouTube videos yet" action={<Link href="/import?tab=youtube"><Button>Add a YouTube link</Button></Link>} />}
          />
        </>
      )}
    </PageContainer>
  );
}

export default function LibraryPage() {
  return (
    <Suspense>
      <LibraryView />
    </Suspense>
  );
}
