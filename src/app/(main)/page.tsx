"use client";

import { CircleArrowDown, Flame, Heart, ListMusic, MonitorPlay, Sparkles, Upload } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { Artwork, Mosaic } from "@/components/Artwork";
import { Button } from "@/components/Modal";
import { CardRow, EmptyState, MediaCard, PageContainer, PlayFab, Section } from "@/components/ui";
import { genres, groupArtists } from "@/lib/derive";
import { greeting, pluralize } from "@/lib/format";
import { getPlaylistSongIds } from "@/lib/library";
import type { Song } from "@/lib/types";
import { useLikedSongs, usePlaylistsWithStats, useRecentlyPlayed, useSongs } from "@/hooks/library";
import { usePlayer } from "@/store/player";

const CATEGORY_COLORS = ["#e13300", "#1e3264", "#8d67ab", "#e8115b", "#148a08", "#bc5900", "#477d95", "#af2896", "#509bf5", "#d84000"];

function QuickTile({ href, title, image, onPlay }: { href: string; title: string; image: React.ReactNode; onPlay?: () => void }) {
  const active = usePlayer((s) => s.contextHref === href && s.queue.length > 0);
  return (
    <Link href={href} className="group flex h-14 items-center gap-3 overflow-hidden rounded-md bg-white/[0.08] pr-2 transition hover:bg-white/[0.16] md:h-16">
      <div className="h-full aspect-square shrink-0 shadow-lg">{image}</div>
      <span className="min-w-0 flex-1 truncate text-sm font-bold md:text-base">{title}</span>
      {onPlay && (
        <div className={`hidden transition md:block ${active ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
          <div className="scale-75"><PlayFab onClick={onPlay} isActive={active} /></div>
        </div>
      )}
    </Link>
  );
}

function SongCards({ songs, label, href }: { songs: Song[]; label: string; href: string }) {
  const ids = songs.map((s) => s.id);
  const currentId = usePlayer((s) => s.queue[s.index]);
  return (
    <CardRow>
      {songs.map((s, i) => (
        <MediaCard
          key={s.id}
          href={s.source === "youtube" ? `/library?tab=youtube` : `/album?name=${encodeURIComponent(s.album)}&artist=${encodeURIComponent(s.artist)}`}
          title={s.title}
          subtitle={s.artist}
          image={<Artwork artworkId={s.artworkId} artworkUrl={s.artworkUrl} seed={s.album + s.artist} className="size-full" rounded="" />}
          isActive={currentId === s.id}
          onPlay={() => usePlayer.getState().playSongs(ids, i, { label, href })}
        />
      ))}
    </CardRow>
  );
}

export default function HomePage() {
  const songs = useSongs();
  const playlists = usePlaylistsWithStats();
  const liked = useLikedSongs();
  const recent = useRecentlyPlayed(12);
  const play = usePlayer.getState;

  const recentlyImported = useMemo(() => [...(songs ?? [])].sort((a, b) => b.importedAt - a.importedAt).slice(0, 12), [songs]);
  const categories = useMemo(() => {
    const all = songs ?? [];
    const cats: { title: string; href: string; subtitle: string; icon?: React.ElementType }[] = [];
    for (const g of genres(all).slice(0, 6)) cats.push({ title: g.name, href: `/collection?type=genre&value=${encodeURIComponent(g.name)}`, subtitle: pluralize(g.count, "song") });
    const decades = new Map<number, number>();
    for (const s of all) if (s.year) decades.set(Math.floor(s.year / 10) * 10, (decades.get(Math.floor(s.year / 10) * 10) ?? 0) + 1);
    for (const [d, n] of [...decades].sort((a, b) => b[1] - a[1]).slice(0, 3)) cats.push({ title: `${d}s`, href: `/collection?type=decade&value=${d}`, subtitle: pluralize(n, "song") });
    if (all.some((s) => s.playCount > 0)) cats.push({ title: "On Repeat", href: "/collection?type=most-played", subtitle: "Your most played", icon: Flame });
    const neverPlayed = all.filter((s) => !s.playCount).length;
    if (neverPlayed) cats.push({ title: "Fresh Finds", href: "/collection?type=never-played", subtitle: `${pluralize(neverPlayed, "song")} you haven't played`, icon: Sparkles });
    const offline = all.filter((s) => s.offline).length;
    if (offline) cats.push({ title: "Offline Mix", href: "/offline", subtitle: `${pluralize(offline, "song")} ready without Wi-Fi`, icon: CircleArrowDown });
    const yt = all.filter((s) => s.source === "youtube").length;
    if (yt) cats.push({ title: "YouTube Collection", href: "/library?tab=youtube", subtitle: pluralize(yt, "video"), icon: MonitorPlay });
    return cats;
  }, [songs]);
  const topArtists = useMemo(() => groupArtists(songs ?? []).slice(0, 10), [songs]);

  if (songs === undefined) return <PageContainer><div className="h-10" /></PageContainer>;

  if (songs.length === 0) {
    return (
      <PageContainer>
        <h1 className="mb-6 text-3xl font-bold">{greeting()}</h1>
        <EmptyState
          icon={Upload}
          title="Your library is empty"
          action={<Link href="/import"><Button><Upload size={16} /> Import music</Button></Link>}
        >
          Import MP3s and other audio files you own, add authorized downloads, or save YouTube videos to stream. Everything you import stays private to you, and downloaded files play offline.
        </EmptyState>
      </PageContainer>
    );
  }

  return (
    <div className="bg-gradient-to-b from-emerald-900/40 via-bg to-bg">
      <PageContainer>
        <h1 className="mb-5 text-2xl font-bold md:text-3xl">{greeting()}</h1>
        <div className="mb-8 grid grid-cols-2 gap-2 md:gap-3 xl:grid-cols-4">
          <QuickTile
            href="/liked"
            title="Liked Songs"
            image={<div className="grid size-full place-items-center bg-gradient-to-br from-indigo-600 to-emerald-300"><Heart size={20} className="fill-white" /></div>}
            onPlay={liked?.length ? () => play().playSongs(liked.map((s) => s.id), 0, { label: "Liked Songs", href: "/liked" }) : undefined}
          />
          <QuickTile
            href="/offline"
            title="Offline Music"
            image={<div className="grid size-full place-items-center bg-gradient-to-br from-emerald-700 to-teal-400"><CircleArrowDown size={22} /></div>}
          />
          {playlists?.slice(0, 6).map((p) => (
            <QuickTile
              key={p.id}
              href={`/playlist?id=${p.id}`}
              title={p.name}
              image={<Mosaic coverId={p.coverId} artworkIds={p.firstArtworkIds} artworkUrls={p.firstArtworkUrls} seed={p.id} className="size-full" rounded="" icon={ListMusic} />}
              onPlay={p.songCount ? async () => play().playSongs(await getPlaylistSongIds(p.id), 0, { label: p.name, href: `/playlist?id=${p.id}` }) : undefined}
            />
          ))}
        </div>

        {recent && recent.length > 0 && (
          <Section title="Recently played" href="/recent">
            <SongCards songs={recent} label="Recently played" href="/recent" />
          </Section>
        )}

        {playlists && playlists.length > 0 && (
          <Section title="Your playlists" href="/playlists">
            <CardRow>
              {playlists.slice(0, 12).map((p) => (
                <MediaCard
                  key={p.id}
                  href={`/playlist?id=${p.id}`}
                  title={p.name}
                  subtitle={`Playlist · ${pluralize(p.songCount, "song")}`}
                  image={<Mosaic coverId={p.coverId} artworkIds={p.firstArtworkIds} artworkUrls={p.firstArtworkUrls} seed={p.id} className="size-full" rounded="" icon={ListMusic} />}
                  onPlay={p.songCount ? async () => play().playSongs(await getPlaylistSongIds(p.id), 0, { label: p.name, href: `/playlist?id=${p.id}` }) : undefined}
                />
              ))}
            </CardRow>
          </Section>
        )}

        {liked && liked.length > 0 && (
          <Section title="Favorite songs" href="/liked">
            <SongCards songs={liked.slice(0, 12)} label="Liked Songs" href="/liked" />
          </Section>
        )}

        <Section title="Recently imported" href="/library">
          <SongCards songs={recentlyImported} label="Recently imported" href="/library" />
        </Section>

        {topArtists.length > 1 && (
          <Section title="Your artists" href="/library?tab=artists">
            <CardRow>
              {topArtists.map((a) => (
                <MediaCard
                  key={a.name}
                  href={`/artist?name=${encodeURIComponent(a.name)}`}
                  title={a.name}
                  subtitle="Artist"
                  round
                  image={<Artwork artworkId={a.artworkId} artworkUrl={a.artworkUrl} seed={a.name} className="size-full" rounded="" />}
                />
              ))}
            </CardRow>
          </Section>
        )}

        {categories.length > 0 && (
          <Section title="Made from your library">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6 md:gap-4">
              {categories.map((c, i) => {
                const Icon = c.icon;
                return (
                  <Link
                    key={c.href}
                    href={c.href}
                    className="relative aspect-[16/10] overflow-hidden rounded-lg p-4 transition hover:brightness-110"
                    style={{ background: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }}
                  >
                    <div className="text-lg font-bold leading-tight md:text-xl">{c.title}</div>
                    <div className="mt-1 text-xs text-white/80">{c.subtitle}</div>
                    {Icon && <Icon className="absolute -bottom-2 -right-2 size-16 rotate-12 text-black/25" />}
                  </Link>
                );
              })}
            </div>
          </Section>
        )}
      </PageContainer>
    </div>
  );
}
