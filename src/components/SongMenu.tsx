"use client";

import {
  CircleArrowDown,
  CircleMinus,
  CloudUpload,
  Disc3,
  ExternalLink,
  FilePlus2,
  Heart,
  ListEnd,
  ListPlus,
  ListStart,
  MoreHorizontal,
  Pencil,
  Trash2,
  User,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { backupSongToCloud, deleteSongWithConfirm, downloadSong, likeSong, removeOffline } from "@/lib/actions";
import { canDownload } from "@/lib/audio-source";
import { cloudEnabled } from "@/lib/cloud-client";
import { reattachFile } from "@/lib/library";
import { AUDIO_ACCEPT } from "@/lib/metadata";
import type { Song } from "@/lib/types";
import { usePlayer } from "@/store/player";
import { toast, useUI } from "@/store/ui";
import { MenuDivider, MenuItem, Popover } from "./Popover";

export function SongMenu({
  song,
  liked,
  onRemoveFromPlaylist,
  className = "",
}: {
  song: Song;
  liked: boolean;
  onRemoveFromPlaylist?: () => void;
  className?: string;
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [cloud, setCloud] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const open = anchor !== null;
  const close = () => setAnchor(null);
  const run = (fn: () => void) => () => {
    close();
    fn();
  };

  useEffect(() => {
    if (open) cloudEnabled().then(setCloud);
  }, [open]);

  return (
    <>
      <button
        aria-label={`More options for ${song.title}`}
        className={`grid size-8 place-items-center rounded-full text-muted hover:text-white ${className}`}
        onClick={(e) => {
          e.stopPropagation();
          setAnchor(open ? null : e.currentTarget);
        }}
      >
        <MoreHorizontal size={18} />
      </button>
      <input
        ref={fileInput}
        type="file"
        accept={AUDIO_ACCEPT}
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          await reattachFile(song.id, file);
          toast("File re-attached and available offline", "success");
        }}
      />
      <Popover anchor={anchor} open={open} onClose={close}>
        <div onClick={(e) => e.stopPropagation()}>
          <MenuItem icon={ListStart} onClick={run(() => { usePlayer.getState().playNext([song.id]); toast("Playing next"); })}>
            Play next
          </MenuItem>
          <MenuItem icon={ListEnd} onClick={run(() => { usePlayer.getState().addToQueue([song.id]); toast("Added to queue"); })}>
            Add to queue
          </MenuItem>
          <MenuItem icon={ListPlus} onClick={run(() => useUI.getState().openAddToPlaylist([song.id]))}>
            Add to playlist
          </MenuItem>
          {onRemoveFromPlaylist && (
            <MenuItem icon={CircleMinus} onClick={run(onRemoveFromPlaylist)}>
              Remove from this playlist
            </MenuItem>
          )}
          <MenuItem icon={Heart} onClick={run(() => likeSong(song))}>
            {liked ? "Remove from Liked Songs" : "Save to Liked Songs"}
          </MenuItem>
          <MenuDivider />
          {canDownload(song) && (
            <MenuItem icon={CircleArrowDown} onClick={run(() => downloadSong(song))}>
              Download for offline
            </MenuItem>
          )}
          {song.offline === 1 && song.source !== "youtube" && (
            <MenuItem icon={CircleArrowDown} onClick={run(() => removeOffline(song))}>
              Remove offline copy
            </MenuItem>
          )}
          {song.source === "local" && !song.offline && !song.cloudPath && (
            <MenuItem icon={FilePlus2} onClick={() => {
                close();
                fileInput.current?.click();
              }}>
              Re-attach audio file
            </MenuItem>
          )}
          {cloud && song.offline === 1 && !song.cloudPath && song.source !== "youtube" && (
            <MenuItem icon={CloudUpload} onClick={run(() => backupSongToCloud(song))}>
              Back up file to private cloud
            </MenuItem>
          )}
          {song.source === "youtube" && song.sourceUrl && (
            <MenuItem icon={ExternalLink} onClick={run(() => window.open(song.sourceUrl, "_blank", "noopener"))}>
              Open on YouTube
            </MenuItem>
          )}
          <MenuItem icon={User} onClick={run(() => router.push(`/artist?name=${encodeURIComponent(song.artist)}`))}>
            Go to artist
          </MenuItem>
          {song.source !== "youtube" && (
            <MenuItem
              icon={Disc3}
              onClick={run(() =>
                router.push(`/album?name=${encodeURIComponent(song.album)}&artist=${encodeURIComponent(song.artist)}`),
              )}
            >
              Go to album
            </MenuItem>
          )}
          <MenuItem icon={Pencil} onClick={run(() => useUI.getState().openEditSong(song.id))}>
            Edit details
          </MenuItem>
          <MenuDivider />
          <MenuItem icon={Trash2} danger onClick={run(() => deleteSongWithConfirm(song))}>
            Delete from library
          </MenuItem>
        </div>
      </Popover>
    </>
  );
}
