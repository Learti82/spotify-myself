"use client";

import { db, uid } from "./db";
import { parseAudioFile, resizeImage } from "./metadata";
import type { RightsBasis, Song } from "./types";
import type { YouTubeMeta } from "./youtube";
import { youTubeWatchUrl } from "./youtube";

let persistRequested = false;
/** Ask the browser not to evict offline music under storage pressure. */
export async function requestPersistentStorage(): Promise<boolean> {
  if (persistRequested || typeof navigator === "undefined" || !navigator.storage?.persist) return false;
  persistRequested = true;
  try {
    return (await navigator.storage.persisted()) || (await navigator.storage.persist());
  } catch {
    return false;
  }
}

export interface RightsInfo {
  basis: RightsBasis;
  note?: string;
}

function baseSong(partial: Partial<Song> & Pick<Song, "title" | "source">): Song {
  const now = Date.now();
  return {
    id: uid(),
    artist: "Unknown Artist",
    album: "Unknown Album",
    duration: 0,
    offline: 0,
    importedAt: now,
    updatedAt: now,
    playCount: 0,
    ...partial,
  };
}

async function saveArtwork(blob: Blob | undefined): Promise<string | undefined> {
  if (!blob) return undefined;
  const id = uid();
  await db.artworks.put({ id, blob });
  return id;
}

/** Imports an audio file the owner has the rights to, keeping the bytes on-device. */
export async function importAudioBlob(
  blob: Blob,
  fileName: string,
  opts: { source: "local" | "url"; sourceUrl?: string; rights: RightsInfo },
): Promise<Song> {
  const meta = await parseAudioFile(blob, fileName);
  const artworkId = await saveArtwork(meta.artwork);
  const song = baseSong({
    title: meta.title,
    artist: meta.artist,
    album: meta.album,
    duration: meta.duration,
    genre: meta.genre,
    year: meta.year,
    trackNo: meta.trackNo,
    artworkId,
    source: opts.source,
    sourceUrl: opts.sourceUrl,
    fileName,
    mimeType: blob.type || undefined,
    size: blob.size,
    offline: 1,
    rightsBasis: opts.rights.basis,
    rightsNote: opts.rights.note,
    rightsConfirmedAt: Date.now(),
  });
  await db.transaction("rw", db.songs, db.audioFiles, async () => {
    await db.songs.add(song);
    await db.audioFiles.put({ songId: song.id, blob, size: blob.size, storedAt: Date.now() });
  });
  void requestPersistentStorage();
  return song;
}

/** Adds a YouTube video as a streaming-only item. It is never stored offline. */
export async function addYouTubeSong(meta: YouTubeMeta): Promise<Song> {
  const existing = await db.songs.where("youtubeId").equals(meta.id).first();
  if (existing) return existing;
  const song = baseSong({
    title: meta.title,
    artist: meta.channel || "YouTube",
    album: "YouTube",
    duration: meta.duration,
    artworkUrl: meta.thumbnail,
    source: "youtube",
    sourceUrl: youTubeWatchUrl(meta.id),
    youtubeId: meta.id,
    offline: 0,
  });
  await db.songs.add(song);
  return song;
}

export async function updateSong(id: string, patch: Partial<Song>): Promise<void> {
  await db.songs.update(id, { ...patch, updatedAt: Date.now() });
}

export async function setSongArtwork(id: string, file: Blob): Promise<void> {
  const blob = await resizeImage(file);
  const song = await db.songs.get(id);
  const artworkId = await saveArtwork(blob);
  await updateSong(id, { artworkId });
  if (song?.artworkId) await maybeDeleteArtwork(song.artworkId);
}

async function maybeDeleteArtwork(artworkId: string) {
  const usedBySong = await db.songs.filter((s) => s.artworkId === artworkId).count();
  const usedByPlaylist = await db.playlists.filter((p) => p.coverId === artworkId).count();
  if (!usedBySong && !usedByPlaylist) await db.artworks.delete(artworkId);
}

export async function deleteSong(id: string): Promise<void> {
  const song = await db.songs.get(id);
  await db.transaction(
    "rw",
    [db.songs, db.audioFiles, db.playlistSongs, db.favorites, db.history],
    async () => {
      await db.songs.delete(id);
      await db.audioFiles.delete(id);
      await db.playlistSongs.where("songId").equals(id).delete();
      await db.favorites.delete(id);
      await db.history.where("songId").equals(id).delete();
    },
  );
  if (song?.artworkId) await maybeDeleteArtwork(song.artworkId);
}

/** Stores downloaded bytes for offline use. Refuses YouTube items by design. */
export async function storeOfflineCopy(songId: string, blob: Blob): Promise<void> {
  const song = await db.songs.get(songId);
  if (!song || song.source === "youtube") throw new Error("This item cannot be stored offline.");
  await db.transaction("rw", db.songs, db.audioFiles, async () => {
    await db.audioFiles.put({ songId, blob, size: blob.size, storedAt: Date.now() });
    await db.songs.update(songId, { offline: 1, size: blob.size, mimeType: song.mimeType ?? (blob.type || undefined) });
  });
  void requestPersistentStorage();
}

/** Frees the on-device copy; the library entry (and any cloud original) stays. */
export async function removeOfflineCopy(songId: string): Promise<void> {
  await db.transaction("rw", db.songs, db.audioFiles, async () => {
    await db.audioFiles.delete(songId);
    await db.songs.update(songId, { offline: 0 });
  });
}

/** Re-attach a file for a local song whose offline copy was removed. */
export async function reattachFile(songId: string, file: File): Promise<void> {
  await storeOfflineCopy(songId, file);
  await updateSong(songId, { fileName: file.name, mimeType: file.type || undefined });
}

/** True when the song can still be played after removing its offline copy. */
export function hasRemoteOriginal(song: Song): boolean {
  return Boolean(song.cloudPath || (song.source === "url" && song.sourceUrl));
}

export async function toggleFavorite(songId: string): Promise<boolean> {
  const existing = await db.favorites.get(songId);
  if (existing) {
    await db.favorites.delete(songId);
    return false;
  }
  await db.favorites.put({ songId, likedAt: Date.now() });
  return true;
}

export async function recordPlay(songId: string): Promise<void> {
  const now = Date.now();
  await db.transaction("rw", db.songs, db.history, async () => {
    await db.history.add({ songId, playedAt: now });
    const song = await db.songs.get(songId);
    if (song) await db.songs.update(songId, { playCount: (song.playCount ?? 0) + 1, lastPlayedAt: now });
  });
  // Keep history bounded.
  const count = await db.history.count();
  if (count > 2000) {
    const old = await db.history.orderBy("playedAt").limit(count - 2000).primaryKeys();
    await db.history.bulkDelete(old);
  }
}

// ---------- Playlists ----------

export async function createPlaylist(name?: string): Promise<string> {
  const count = await db.playlists.count();
  const id = uid();
  const now = Date.now();
  await db.playlists.add({ id, name: name?.trim() || `My Playlist #${count + 1}`, createdAt: now, updatedAt: now });
  return id;
}

export async function updatePlaylist(id: string, patch: { name?: string; description?: string }) {
  await db.playlists.update(id, { ...patch, updatedAt: Date.now() });
}

export async function setPlaylistCover(id: string, file: Blob): Promise<void> {
  const blob = await resizeImage(file);
  const playlist = await db.playlists.get(id);
  const coverId = await saveArtwork(blob);
  await db.playlists.update(id, { coverId, updatedAt: Date.now() });
  if (playlist?.coverId) await maybeDeleteArtwork(playlist.coverId);
}

export async function removePlaylistCover(id: string): Promise<void> {
  const playlist = await db.playlists.get(id);
  await db.playlists.update(id, { coverId: undefined, updatedAt: Date.now() });
  if (playlist?.coverId) await maybeDeleteArtwork(playlist.coverId);
}

export async function deletePlaylist(id: string): Promise<void> {
  const playlist = await db.playlists.get(id);
  await db.transaction("rw", db.playlists, db.playlistSongs, async () => {
    await db.playlists.delete(id);
    await db.playlistSongs.where("playlistId").equals(id).delete();
  });
  if (playlist?.coverId) await maybeDeleteArtwork(playlist.coverId);
}

/** Adds songs to the end of a playlist, skipping ones already in it. Returns how many were added. */
export async function addSongsToPlaylist(playlistId: string, songIds: string[]): Promise<number> {
  return db.transaction("rw", db.playlists, db.playlistSongs, async () => {
    const entries = await db.playlistSongs.where("playlistId").equals(playlistId).toArray();
    const present = new Set(entries.map((e) => e.songId));
    let position = entries.reduce((max, e) => Math.max(max, e.position), -1) + 1;
    const toAdd = [...new Set(songIds)].filter((id) => !present.has(id));
    const now = Date.now();
    await db.playlistSongs.bulkAdd(
      toAdd.map((songId) => ({ id: uid(), playlistId, songId, position: position++, addedAt: now })),
    );
    await db.playlists.update(playlistId, { updatedAt: now });
    return toAdd.length;
  });
}

export async function removePlaylistEntry(entryId: string): Promise<void> {
  const entry = await db.playlistSongs.get(entryId);
  await db.playlistSongs.delete(entryId);
  if (entry) await db.playlists.update(entry.playlistId, { updatedAt: Date.now() });
}

export async function reorderPlaylist(playlistId: string, orderedEntryIds: string[]): Promise<void> {
  await db.transaction("rw", db.playlists, db.playlistSongs, async () => {
    await Promise.all(orderedEntryIds.map((id, position) => db.playlistSongs.update(id, { position })));
    await db.playlists.update(playlistId, { updatedAt: Date.now() });
  });
}

export async function getPlaylistSongIds(playlistId: string): Promise<string[]> {
  const entries = await db.playlistSongs.where("[playlistId+position]").between([playlistId, -Infinity], [playlistId, Infinity]).toArray();
  return entries.map((e) => e.songId);
}
