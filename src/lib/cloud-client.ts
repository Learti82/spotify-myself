"use client";

import { db } from "./db";
import { putWithProgress } from "./http";
import type { Song } from "./types";

let statusPromise: Promise<boolean> | null = null;

/** Whether the optional private Supabase storage is configured on the server. */
export function cloudEnabled(): Promise<boolean> {
  if (typeof navigator !== "undefined" && !navigator.onLine) return Promise.resolve(false);
  statusPromise ??= fetch("/api/cloud/status")
    .then((r) => (r.ok ? r.json() : { enabled: false }))
    .then((j) => Boolean(j.enabled))
    .catch(() => {
      statusPromise = null;
      return false;
    });
  return statusPromise;
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? `Request failed (${res.status})`);
  return json as T;
}

/** Short-lived signed URL for a cloud original. Never a public URL. */
export async function getSignedAudioUrl(song: Song): Promise<string> {
  const { url } = await postJson<{ url: string }>("/api/cloud/signed-url", { path: song.cloudPath });
  return url;
}

export async function uploadOriginal(song: Song, onProgress: (l: number, t: number) => void): Promise<void> {
  const file = await db.audioFiles.get(song.id);
  if (!file) throw new Error("No local file to upload.");
  const { url, path } = await postJson<{ url: string; path: string }>("/api/cloud/upload-url", {
    songId: song.id,
    fileName: song.fileName ?? "audio",
  });
  await putWithProgress(
    url,
    file.blob,
    { "content-type": file.blob.type || "application/octet-stream", "x-upsert": "true" },
    onProgress,
  );
  await db.songs.update(song.id, { cloudPath: path, updatedAt: Date.now() });
}

export async function deleteCloudOriginal(song: Song): Promise<void> {
  if (!song.cloudPath) return;
  await postJson("/api/cloud/delete-audio", { path: song.cloudPath });
}

/** Pushes all metadata to the private database (audio bytes are uploaded separately). */
export async function backupMetadata(): Promise<{ songs: number; playlists: number }> {
  const [songs, playlists, playlistSongs, favorites, history] = await Promise.all([
    db.songs.toArray(),
    db.playlists.toArray(),
    db.playlistSongs.toArray(),
    db.favorites.toArray(),
    db.history.orderBy("playedAt").reverse().limit(500).toArray(),
  ]);
  let deviceId = localStorage.getItem("device-id");
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    localStorage.setItem("device-id", deviceId);
  }
  await postJson("/api/cloud/backup", { songs, playlists, playlistSongs, favorites, history, deviceId });
  return { songs: songs.length, playlists: playlists.length };
}

/** Pulls metadata from the cloud and merges it into this device (newer wins). */
export async function restoreMetadata(): Promise<{ songs: number; playlists: number }> {
  const res = await fetch("/api/cloud/backup");
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Restore failed");
  const remoteSongs: Song[] = data.songs ?? [];
  await db.transaction("rw", [db.songs, db.playlists, db.playlistSongs, db.favorites], async () => {
    for (const s of remoteSongs) {
      const local = await db.songs.get(s.id);
      if (!local) await db.songs.put({ ...s, offline: 0 });
      else if (s.updatedAt > local.updatedAt) await db.songs.put({ ...s, offline: local.offline, artworkId: local.artworkId });
    }
    for (const p of data.playlists ?? []) {
      const local = await db.playlists.get(p.id);
      if (!local || p.updatedAt > local.updatedAt) {
        await db.playlists.put({ ...p, coverId: local?.coverId });
        await db.playlistSongs.where("playlistId").equals(p.id).delete();
        await db.playlistSongs.bulkPut((data.playlistSongs ?? []).filter((e: { playlistId: string }) => e.playlistId === p.id));
      }
    }
    await db.favorites.bulkPut(data.favorites ?? []);
  });
  return { songs: remoteSongs.length, playlists: (data.playlists ?? []).length };
}
