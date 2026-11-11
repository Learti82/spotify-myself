"use client";

import { canDownload, downloadForOffline } from "./audio-source";
import { cloudEnabled, deleteCloudOriginal, uploadOriginal } from "./cloud-client";
import { db } from "./db";
import { deleteSong, hasRemoteOriginal, removeOfflineCopy, toggleFavorite } from "./library";
import type { Song } from "./types";
import { useDownloads } from "@/store/downloads";
import { usePlayer } from "@/store/player";
import { toast, useUI } from "@/store/ui";

/** UI-level actions shared by menus, rows and pages (toasts + confirmations). */

export async function likeSong(song: Song) {
  const liked = await toggleFavorite(song.id);
  toast(liked ? "Added to Liked Songs" : "Removed from Liked Songs");
}

export async function downloadSong(song: Song) {
  if (!canDownload(song)) return;
  try {
    await downloadForOffline(song);
    toast(`"${song.title}" is available offline`, "success");
  } catch (err) {
    toast((err as Error).message, "error");
  }
}

export async function downloadMany(songs: Song[]) {
  const list = songs.filter(canDownload);
  if (!list.length) return toast("Nothing to download");
  for (const s of list) {
    try {
      await downloadForOffline(s);
    } catch (err) {
      toast(`${s.title}: ${(err as Error).message}`, "error");
    }
  }
  toast(`Downloaded ${list.length} song${list.length === 1 ? "" : "s"}`, "success");
}

export async function removeOffline(song: Song) {
  if (!hasRemoteOriginal(song)) {
    const ok = await useUI.getState().askConfirm({
      title: "Remove offline file?",
      message:
        "This song only exists on this device. The library entry will stay, but you'll need to re-attach the file to play it again.",
      confirmLabel: "Remove file",
      danger: true,
    });
    if (!ok) return;
  }
  await removeOfflineCopy(song.id);
  toast("Removed offline copy. The song stays in your library.");
}

export async function deleteSongWithConfirm(song: Song) {
  const ok = await useUI.getState().askConfirm({
    title: "Delete from library?",
    message: `"${song.title}" will be removed from your library, playlists and this device.${
      song.cloudPath ? " Its private cloud copy will be deleted too." : ""
    }`,
    confirmLabel: "Delete",
    danger: true,
  });
  if (!ok) return;
  if (song.cloudPath) {
    try {
      await deleteCloudOriginal(song);
    } catch (err) {
      toast(`Cloud copy not deleted: ${(err as Error).message}`, "error");
    }
  }
  usePlayer.getState().removeSongEverywhere(song.id);
  await deleteSong(song.id);
  toast("Deleted from your library");
}

export async function backupSongToCloud(song: Song) {
  if (!(await cloudEnabled())) return toast("Private cloud storage isn't configured.", "error");
  const dl = useDownloads.getState();
  try {
    dl.set(song.id, { loaded: 0, total: song.size ?? 0, label: `Uploading ${song.title}` });
    await uploadOriginal(song, (loaded, total) => dl.set(song.id, { loaded, total, label: `Uploading ${song.title}` }));
    toast(`"${song.title}" backed up to your private cloud`, "success");
  } catch (err) {
    toast((err as Error).message, "error");
  } finally {
    dl.done(song.id);
  }
}

export async function songsByIds(ids: string[]): Promise<Song[]> {
  return (await db.songs.bulkGet(ids)).filter((s): s is Song => Boolean(s));
}
