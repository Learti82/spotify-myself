"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { getArtworkUrl, peekArtworkUrl } from "@/lib/artwork";
import { db } from "@/lib/db";
import type { Playlist, PlaylistSong, Song } from "@/lib/types";

const EMPTY: never[] = [];

export function useSongs(): Song[] | undefined {
  return useLiveQuery(() => db.songs.toArray(), []);
}

export function useSongMap(): Map<string, Song> {
  const songs = useSongs();
  return useMemo(() => new Map((songs ?? EMPTY).map((s) => [s.id, s])), [songs]);
}

export function useSong(id?: string): Song | undefined {
  return useLiveQuery(() => (id ? db.songs.get(id) : undefined), [id]);
}

export function useFavoriteIds(): Set<string> {
  const favs = useLiveQuery(() => db.favorites.toArray(), []);
  return useMemo(() => new Set((favs ?? EMPTY).map((f) => f.songId)), [favs]);
}

export function useLikedSongs(): Song[] | undefined {
  return useLiveQuery(async () => {
    const favs = await db.favorites.orderBy("likedAt").reverse().toArray();
    const songs = await db.songs.bulkGet(favs.map((f) => f.songId));
    return songs.filter((s): s is Song => Boolean(s));
  }, []);
}

export function usePlaylists(): Playlist[] | undefined {
  return useLiveQuery(() => db.playlists.orderBy("updatedAt").reverse().toArray(), []);
}

export interface PlaylistWithStats extends Playlist {
  songCount: number;
  duration: number;
  firstArtworkIds: (string | undefined)[];
  firstArtworkUrls: (string | undefined)[];
}

export function usePlaylistsWithStats(): PlaylistWithStats[] | undefined {
  return useLiveQuery(async () => {
    const [playlists, entries, songs] = await Promise.all([
      db.playlists.orderBy("updatedAt").reverse().toArray(),
      db.playlistSongs.toArray(),
      db.songs.toArray(),
    ]);
    const map = new Map(songs.map((s) => [s.id, s]));
    return playlists.map((p) => {
      const mine = entries
        .filter((e) => e.playlistId === p.id)
        .sort((a, b) => a.position - b.position)
        .map((e) => map.get(e.songId))
        .filter((s): s is Song => Boolean(s));
      return {
        ...p,
        songCount: mine.length,
        duration: mine.reduce((t, s) => t + (s.duration || 0), 0),
        firstArtworkIds: mine.slice(0, 4).map((s) => s.artworkId),
        firstArtworkUrls: mine.slice(0, 4).map((s) => s.artworkUrl),
      };
    });
  }, []);
}

export function usePlaylist(id?: string | null): Playlist | null | undefined {
  return useLiveQuery(async () => (id ? (await db.playlists.get(id)) ?? null : null), [id]);
}

export interface PlaylistItem {
  entry: PlaylistSong;
  song: Song;
}

export function usePlaylistItems(id?: string | null): PlaylistItem[] | undefined {
  return useLiveQuery(async () => {
    if (!id) return [];
    const entries = await db.playlistSongs
      .where("[playlistId+position]")
      .between([id, -Infinity], [id, Infinity])
      .toArray();
    const songs = await db.songs.bulkGet(entries.map((e) => e.songId));
    return entries
      .map((entry, i) => ({ entry, song: songs[i] }))
      .filter((x): x is PlaylistItem => Boolean(x.song));
  }, [id]);
}

/** Distinct songs in most-recently-played order. */
export function useRecentlyPlayed(limit = 50): Song[] | undefined {
  return useLiveQuery(async () => {
    const recent = await db.history.orderBy("playedAt").reverse().limit(500).toArray();
    const seen = new Set<string>();
    const ids: string[] = [];
    for (const h of recent) {
      if (!seen.has(h.songId)) {
        seen.add(h.songId);
        ids.push(h.songId);
        if (ids.length >= limit) break;
      }
    }
    const songs = await db.songs.bulkGet(ids);
    return songs.filter((s): s is Song => Boolean(s));
  }, [limit]);
}

export function useHistory(limit = 200) {
  return useLiveQuery(async () => {
    const entries = await db.history.orderBy("playedAt").reverse().limit(limit).toArray();
    const songs = await db.songs.bulkGet(entries.map((e) => e.songId));
    return entries
      .map((e, i) => ({ entry: e, song: songs[i] }))
      .filter((x): x is { entry: typeof x.entry; song: Song } => Boolean(x.song));
  }, [limit]);
}

export function useArtworkUrl(artworkId?: string, fallbackUrl?: string): string | null {
  const [loaded, setLoaded] = useState<{ id: string; url: string | null } | null>(null);
  useEffect(() => {
    if (!artworkId || peekArtworkUrl(artworkId)) return;
    let cancelled = false;
    getArtworkUrl(artworkId).then((url) => !cancelled && setLoaded({ id: artworkId, url }));
    return () => {
      cancelled = true;
    };
  }, [artworkId]);
  const url = artworkId ? (peekArtworkUrl(artworkId) ?? (loaded?.id === artworkId ? loaded.url : null)) : null;
  return url ?? fallbackUrl ?? null;
}

function subscribeOnline(cb: () => void) {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}

export function useOnline(): boolean {
  return useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
}

export interface StorageInfo {
  usage: number;
  quota: number;
  persisted: boolean;
}

export function useStorageEstimate(deps: unknown[] = []): StorageInfo | null {
  const [info, setInfo] = useState<StorageInfo | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!navigator.storage?.estimate) return;
      const est = await navigator.storage.estimate();
      const persisted = (await navigator.storage.persisted?.()) ?? false;
      if (!cancelled) setInfo({ usage: est.usage ?? 0, quota: est.quota ?? 0, persisted });
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return info;
}
