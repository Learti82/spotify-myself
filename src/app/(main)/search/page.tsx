"use client";

import { CircleArrowDown, ListMusic, Search as SearchIcon, X } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useDeferredValue, useEffect, useMemo, useState } from "react";
import { Artwork, Mosaic } from "@/components/Artwork";
import { SongList } from "@/components/SongList";
import { CardGrid, CardRow, Chip, EmptyState, MediaCard, PageContainer, PlayFab, Section } from "@/components/ui";
import { genres, groupAlbums, groupArtists, matchPlaylist, matchSong, normalize, score } from "@/lib/derive";
import { pluralize } from "@/lib/format";
import { getPlaylistSongIds } from "@/lib/library";
import type { Song } from "@/lib/types";
import { usePlaylistsWithStats, useSongs } from "@/hooks/library";
import { usePlayer } from "@/store/player";

const FILTERS = [
  ["all", "All"],
  ["songs", "Songs"],
  ["artists", "Artists"],
  ["albums", "Albums"],
  ["playlists", "Playlists"],
  ["youtube", "YouTube"],
] as const;

const SORTS: Record<string, [string, ((a: Song, b: Song) => number) | null]> = {
  relevance: ["Relevance", null],
  title: ["Title (A–Z)", (a, b) => a.title.localeCompare(b.title)],
  artist: ["Artist (A–Z)", (a, b) => a.artist.localeCompare(b.artist)],
  recent: ["Recently added", (a, b) => b.importedAt - a.importedAt],
  plays: ["Most played", (a, b) => b.playCount - a.playCount],
  duration: ["Longest", (a, b) => b.duration - a.duration],
};

const BROWSE_COLORS = ["#8d67ab", "#e8115b", "#1e3264", "#148a08", "#bc5900", "#477d95", "#af2896", "#509bf5"];

function SearchView() {
  const params = useSearchParams();
  const router = useRouter();
  const [q, setQ] = useState(params.get("q") ?? "");
  const filter = params.get("filter") ?? "all";
  const sort = params.get("sort") ?? "relevance";
  const [offlineOnly, setOfflineOnly] = useState(false);
  const deferred = useDeferredValue(q);
  const songs = useSongs();
  const playlists = usePlaylistsWithStats();
  const contextHref = usePlayer((s) => (s.queue.length ? s.contextHref : undefined));

  // Keep the query in the URL (without adding history entries) so back navigation restores it.
  useEffect(() => {
    const t = setTimeout(() => {
      const next = new URLSearchParams(params);
      if (q) next.set("q", q);
      else next.delete("q");
      if (next.toString() !== params.toString()) router.replace(`/search?${next}`, { scroll: false });
    }, 300);
    return () => clearTimeout(t);
  }, [q, params, router]);

  const setParam = (k: string, v: string) => {
    const next = new URLSearchParams(params);
    next.set(k, v);
    if (q) next.set("q", q);
    router.replace(`/search?${next}`, { scroll: false });
  };

  const query = normalize(deferred.trim());
  const results = useMemo(() => {
    let pool = songs ?? [];
    if (offlineOnly) pool = pool.filter((s) => s.offline);
    const matched = query
      ? pool.map((s) => ({ s, sc: matchSong(s, query) })).filter((x) => x.sc > 0).sort((a, b) => b.sc - a.sc).map((x) => x.s)
      : [];
    const sorter = SORTS[sort]?.[1];
    const sorted = sorter ? [...matched].sort(sorter) : matched;
    const artists = query ? groupArtists(pool).filter((a) => score(a.name, query) > 0).sort((a, b) => score(b.name, query) - score(a.name, query)) : [];
    const albums = query
      ? groupAlbums(pool).filter((a) => score(a.name, query) > 0 || score(a.artist, query) > 0).sort((a, b) => score(b.name, query) - score(a.name, query))
      : [];
    const pls = query ? (playlists ?? []).filter((p) => matchPlaylist(p, query) > 0) : [];
    return {
      songs: sorted.filter((s) => s.source !== "youtube"),
      youtube: sorted.filter((s) => s.source === "youtube"),
      all: sorted,
      artists,
      albums,
      playlists: pls,
    };
  }, [songs, playlists, query, sort, offlineOnly]);

  const browse = useMemo(() => genres(songs ?? []).slice(0, 12), [songs]);
  const nothing = query && !results.all.length && !results.artists.length && !results.albums.length && !results.playlists.length;
  const top = results.all[0];

  return (
    <PageContainer>
      <div className="sticky top-0 z-20 -mx-4 bg-bg/95 px-4 pb-3 pt-1 backdrop-blur md:-mx-6 md:px-6">
        <div className="relative max-w-xl">
          <SearchIcon size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
          <input
            id="search-input"
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="What do you want to listen to?"
            className="h-12 w-full rounded-full bg-[#242424] pl-12 pr-12 text-[15px] outline-none ring-white/70 placeholder:text-muted hover:bg-[#2a2a2a] focus:ring-2"
            aria-label="Search your library"
          />
          {q && (
            <button aria-label="Clear search" onClick={() => setQ("")} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted hover:text-white">
              <X size={20} />
            </button>
          )}
        </div>
        {query && (
          <div className="mt-3 flex items-center gap-2 overflow-x-auto">
            {FILTERS.map(([k, label]) => (
              <Chip key={k} active={filter === k} onClick={() => setParam("filter", k)}>{label}</Chip>
            ))}
            <Chip active={offlineOnly} onClick={() => setOfflineOnly((v) => !v)}>
              <span className="flex items-center gap-1"><CircleArrowDown size={14} /> Offline</span>
            </Chip>
            <select
              aria-label="Sort results"
              value={sort}
              onChange={(e) => setParam("sort", e.target.value)}
              className="ml-auto shrink-0 rounded-full bg-white/[0.08] px-3 py-1.5 text-sm"
            >
              {Object.entries(SORTS).map(([k, [label]]) => <option key={k} value={k}>{label}</option>)}
            </select>
          </div>
        )}
      </div>

      {!query && (
        <div className="mt-4">
          <h2 className="mb-4 text-xl font-bold">Browse your library</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6">
            {[
              { title: "Liked Songs", href: "/liked" },
              { title: "Offline Music", href: "/offline" },
              { title: "YouTube", href: "/library?tab=youtube" },
              { title: "Albums", href: "/library?tab=albums" },
              { title: "Artists", href: "/library?tab=artists" },
              ...browse.map((g) => ({ title: g.name, href: `/collection?type=genre&value=${encodeURIComponent(g.name)}` })),
            ].map((c, i) => (
              <Link key={c.href} href={c.href} className="aspect-[16/9] rounded-lg p-4 text-lg font-bold transition hover:brightness-110" style={{ background: BROWSE_COLORS[i % BROWSE_COLORS.length] }}>
                {c.title}
              </Link>
            ))}
          </div>
        </div>
      )}

      {nothing && (
        <EmptyState icon={SearchIcon} title={`No results found for "${deferred}"`}>
          Check the spelling, or try fewer or different keywords.
        </EmptyState>
      )}

      {query && !nothing && (
        <div className="mt-4" data-testid="search-results">
          {filter === "all" && (
            <>
              {top && (
                <div className="mb-8 grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
                  <section>
                    <h2 className="mb-3 text-2xl font-bold">Top result</h2>
                    <div className="group relative rounded-lg bg-surface p-5 transition hover:bg-[#282828]">
                      <Artwork artworkId={top.artworkId} artworkUrl={top.artworkUrl} seed={top.album + top.artist} className="size-24 shadow-lg" rounded="rounded-md" />
                      <div className="mt-4 truncate text-3xl font-bold">{top.title}</div>
                      <div className="mt-1 text-sm text-muted">Song · <span className="text-white">{top.artist}</span></div>
                      <div className="absolute bottom-5 right-5 opacity-0 transition group-hover:opacity-100">
                        <PlayFab onClick={() => usePlayer.getState().playSongs([top.id], 0, { label: `Search: ${deferred}` })} />
                      </div>
                    </div>
                  </section>
                  <section>
                    <h2 className="mb-3 text-2xl font-bold">Songs</h2>
                    <SongList songs={results.all.slice(0, 4)} context={{ label: `Search: ${deferred}` }} showAlbum={false} />
                  </section>
                </div>
              )}
              {results.artists.length > 0 && (
                <Section title="Artists">
                  <CardRow>
                    {results.artists.slice(0, 10).map((a) => (
                      <MediaCard key={a.name} href={`/artist?name=${encodeURIComponent(a.name)}`} title={a.name} subtitle="Artist" round
                        image={<Artwork artworkId={a.artworkId} artworkUrl={a.artworkUrl} seed={a.name} className="size-full" rounded="" />} />
                    ))}
                  </CardRow>
                </Section>
              )}
              {results.albums.length > 0 && (
                <Section title="Albums">
                  <CardRow>
                    {results.albums.slice(0, 10).map((a) => {
                      const href = `/album?name=${encodeURIComponent(a.name)}&artist=${encodeURIComponent(a.artist)}`;
                      return (
                        <MediaCard key={a.key} href={href} title={a.name} subtitle={a.artist} isActive={contextHref === href}
                          onPlay={() => usePlayer.getState().playSongs(a.songs.map((s) => s.id), 0, { label: a.name, href })}
                          image={<Artwork artworkId={a.artworkId} artworkUrl={a.artworkUrl} seed={a.name + a.artist} className="size-full" rounded="" />} />
                      );
                    })}
                  </CardRow>
                </Section>
              )}
              {results.playlists.length > 0 && (
                <Section title="Playlists">
                  <CardRow>
                    {results.playlists.map((p) => (
                      <MediaCard key={p.id} href={`/playlist?id=${p.id}`} title={p.name} subtitle={pluralize(p.songCount, "song")}
                        onPlay={p.songCount ? async () => usePlayer.getState().playSongs(await getPlaylistSongIds(p.id), 0, { label: p.name, href: `/playlist?id=${p.id}` }) : undefined}
                        image={<Mosaic coverId={p.coverId} artworkIds={p.firstArtworkIds} artworkUrls={p.firstArtworkUrls} seed={p.id} className="size-full" rounded="" icon={ListMusic} />} />
                    ))}
                  </CardRow>
                </Section>
              )}
            </>
          )}
          {filter === "songs" && <SongList songs={results.songs} context={{ label: `Search: ${deferred}` }} empty={<p className="text-muted">No songs match.</p>} />}
          {filter === "youtube" && <SongList songs={results.youtube} context={{ label: `YouTube: ${deferred}` }} empty={<p className="text-muted">No YouTube items match.</p>} />}
          {filter === "artists" && (
            <CardGrid>
              {results.artists.map((a) => (
                <MediaCard key={a.name} href={`/artist?name=${encodeURIComponent(a.name)}`} title={a.name} subtitle={pluralize(a.songs.length, "song")} round
                  image={<Artwork artworkId={a.artworkId} artworkUrl={a.artworkUrl} seed={a.name} className="size-full" rounded="" />} />
              ))}
            </CardGrid>
          )}
          {filter === "albums" && (
            <CardGrid>
              {results.albums.map((a) => (
                <MediaCard key={a.key} href={`/album?name=${encodeURIComponent(a.name)}&artist=${encodeURIComponent(a.artist)}`} title={a.name} subtitle={a.artist}
                  image={<Artwork artworkId={a.artworkId} artworkUrl={a.artworkUrl} seed={a.name + a.artist} className="size-full" rounded="" />} />
              ))}
            </CardGrid>
          )}
          {filter === "playlists" && (
            <CardGrid>
              {results.playlists.map((p) => (
                <MediaCard key={p.id} href={`/playlist?id=${p.id}`} title={p.name} subtitle={pluralize(p.songCount, "song")}
                  image={<Mosaic coverId={p.coverId} artworkIds={p.firstArtworkIds} artworkUrls={p.firstArtworkUrls} seed={p.id} className="size-full" rounded="" icon={ListMusic} />} />
              ))}
            </CardGrid>
          )}
        </div>
      )}
    </PageContainer>
  );
}

export default function SearchPage() {
  return (
    <Suspense>
      <SearchView />
    </Suspense>
  );
}
