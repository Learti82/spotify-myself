"use client";

import { db } from "./db";
import { getSignedAudioUrl } from "./cloud-client";
import { fetchWithProgress } from "./http";
import { storeOfflineCopy } from "./library";
import { useDownloads } from "@/store/downloads";
import type { Song } from "./types";

export type PlayableSource = { url: string; local: boolean; release: () => void };

/**
 * Resolves the best way to play a song: the offline copy first (works without
 * internet), then the private cloud original, then the original download URL.
 */
export async function resolvePlayableSource(song: Song): Promise<PlayableSource> {
  const file = await db.audioFiles.get(song.id);
  if (file) {
    const url = URL.createObjectURL(file.blob);
    return { url, local: true, release: () => URL.revokeObjectURL(url) };
  }
  const online = navigator.onLine;
  if (song.cloudPath && online) {
    return { url: await getSignedAudioUrl(song), local: false, release: () => {} };
  }
  if (song.source === "url" && song.sourceUrl && online) {
    return { url: song.sourceUrl, local: false, release: () => {} };
  }
  if (!online) throw new Error(`"${song.title}" isn't downloaded, and you're offline.`);
  throw new Error(`"${song.title}" has no audio file on this device. Re-attach the file to play it.`);
}

export function canDownload(song: Song): boolean {
  return song.source !== "youtube" && !song.offline && Boolean(song.cloudPath || (song.source === "url" && song.sourceUrl));
}

/** Downloads an authorized file into IndexedDB with visible progress. */
export async function downloadForOffline(song: Song): Promise<void> {
  if (song.source === "youtube") throw new Error("YouTube items stream only and can't be downloaded.");
  const progress = useDownloads.getState();
  progress.set(song.id, { loaded: 0, total: song.size ?? 0, label: song.title });
  try {
    let url: string;
    let init: RequestInit | undefined;
    if (song.cloudPath) url = await getSignedAudioUrl(song);
    else if (song.source === "url" && song.sourceUrl) {
      url = `/api/fetch-audio?url=${encodeURIComponent(song.sourceUrl)}`;
      init = { cache: "no-store" };
    } else throw new Error("No downloadable original for this song.");
    const blob = await fetchWithProgress(url, init, (loaded, total) =>
      progress.set(song.id, { loaded, total: total || song.size || 0, label: song.title }),
    );
    await storeOfflineCopy(song.id, blob);
  } finally {
    progress.done(song.id);
  }
}
