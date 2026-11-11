"use client";

import { Heart, ListMusic, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { Mosaic } from "@/components/Artwork";
import { Button } from "@/components/Modal";
import { CardGrid, EmptyState, MediaCard, PageContainer } from "@/components/ui";
import { formatTotalDuration, pluralize } from "@/lib/format";
import { createPlaylist, getPlaylistSongIds } from "@/lib/library";
import { useLikedSongs, usePlaylistsWithStats } from "@/hooks/library";
import { usePlayer } from "@/store/player";

export default function PlaylistsPage() {
  const playlists = usePlaylistsWithStats();
  const liked = useLikedSongs();
  const router = useRouter();
  const contextHref = usePlayer((s) => (s.queue.length ? s.contextHref : undefined));
  const newPlaylist = async () => router.push(`/playlist?id=${await createPlaylist()}`);

  return (
    <PageContainer>
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-3xl font-bold">Playlists</h1>
        <Button onClick={newPlaylist}><Plus size={16} /> New playlist</Button>
      </div>
      <CardGrid>
        <MediaCard
          href="/liked"
          title="Liked Songs"
          subtitle={pluralize(liked?.length ?? 0, "liked song")}
          image={<div className="grid size-full place-items-center bg-gradient-to-br from-indigo-700 to-emerald-300"><Heart size={48} className="fill-white" /></div>}
          isActive={contextHref === "/liked"}
          onPlay={liked?.length ? () => usePlayer.getState().playSongs(liked.map((s) => s.id), 0, { label: "Liked Songs", href: "/liked" }) : undefined}
        />
        {playlists?.map((p) => {
          const href = `/playlist?id=${p.id}`;
          return (
            <MediaCard
              key={p.id}
              href={href}
              title={p.name}
              subtitle={`${pluralize(p.songCount, "song")}${p.duration ? ` · ${formatTotalDuration(p.duration)}` : ""}`}
              image={<Mosaic coverId={p.coverId} artworkIds={p.firstArtworkIds} artworkUrls={p.firstArtworkUrls} seed={p.id} className="size-full" rounded="" icon={ListMusic} />}
              isActive={contextHref === href}
              onPlay={p.songCount ? async () => usePlayer.getState().playSongs(await getPlaylistSongIds(p.id), 0, { label: p.name, href }) : undefined}
            />
          );
        })}
      </CardGrid>
      {playlists?.length === 0 && (
        <EmptyState icon={ListMusic} title="Create your first playlist" action={<Button onClick={newPlaylist}><Plus size={16} /> Create playlist</Button>}>
          Organize your music any way you like. Playlists are stored on this device and work offline.
        </EmptyState>
      )}
    </PageContainer>
  );
}
