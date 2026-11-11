"use client";

import { Check, ImagePlus, ListMusic, Plus } from "lucide-react";
import { useRef, useState } from "react";
import { addSongsToPlaylist, createPlaylist, setSongArtwork, updateSong } from "@/lib/library";
import { pluralize } from "@/lib/format";
import type { Song } from "@/lib/types";
import { useSong, usePlaylistsWithStats } from "@/hooks/library";
import { toast, useUI } from "@/store/ui";
import { Artwork, Mosaic } from "./Artwork";
import { Button, Field, inputClass, Modal } from "./Modal";

function ConfirmDialog() {
  const confirm = useUI((s) => s.confirm);
  if (!confirm) return null;
  const close = useUI.getState().closeConfirm;
  return (
    <Modal title={confirm.title} onClose={() => close(false)}>
      <p className="text-sm text-neutral-300">{confirm.message}</p>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="ghost" onClick={() => close(false)}>Cancel</Button>
        <Button variant={confirm.danger ? "danger" : "primary"} onClick={() => close(true)} autoFocus>
          {confirm.confirmLabel ?? "Confirm"}
        </Button>
      </div>
    </Modal>
  );
}

function EditSongDialog({ id }: { id: string }) {
  const song = useSong(id);
  if (!song) return null;
  return <EditSongForm song={song} />;
}

function EditSongForm({ song }: { song: Song }) {
  const id = song.id;
  const [form, setForm] = useState({
    title: song.title,
    artist: song.artist,
    album: song.album,
    genre: song.genre ?? "",
    year: song.year ? String(song.year) : "",
    trackNo: song.trackNo ? String(song.trackNo) : "",
  });
  const fileRef = useRef<HTMLInputElement>(null);
  const close = () => useUI.getState().openEditSong(null);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  return (
    <Modal title="Edit details" onClose={close} wide>
      <form
        className="grid gap-5 sm:grid-cols-[180px_1fr]"
        onSubmit={async (e) => {
          e.preventDefault();
          await updateSong(id, {
            title: form.title.trim() || "Untitled",
            artist: form.artist.trim() || "Unknown Artist",
            album: form.album.trim() || "Unknown Album",
            genre: form.genre.trim() || undefined,
            year: form.year ? Number(form.year) || undefined : undefined,
            trackNo: form.trackNo ? Number(form.trackNo) || undefined : undefined,
          });
          toast("Details saved", "success");
          close();
        }}
      >
        <div>
          <button
            type="button"
            className="group relative block size-[180px] overflow-hidden rounded-md shadow-lg"
            onClick={() => fileRef.current?.click()}
            aria-label="Change artwork"
          >
            <Artwork artworkId={song.artworkId} artworkUrl={song.artworkUrl} seed={song.album + song.artist} className="size-full" rounded="" />
            <span className="absolute inset-0 grid place-items-center bg-black/60 text-sm font-semibold opacity-0 transition group-hover:opacity-100">
              <span className="flex flex-col items-center gap-2"><ImagePlus size={28} /> Choose artwork</span>
            </span>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) await setSongArtwork(id, f);
            }}
          />
          <p className="mt-2 text-xs text-subtle">
            {song.source === "youtube" ? "YouTube stream" : song.fileName ?? "Audio file"}
          </p>
        </div>
        <div className="grid content-start gap-3">
          <Field label="Title"><input className={inputClass} value={form.title} onChange={set("title")} autoFocus /></Field>
          <Field label="Artist"><input className={inputClass} value={form.artist} onChange={set("artist")} /></Field>
          <Field label="Album"><input className={inputClass} value={form.album} onChange={set("album")} /></Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Genre"><input className={inputClass} value={form.genre} onChange={set("genre")} /></Field>
            <Field label="Year"><input className={inputClass} inputMode="numeric" value={form.year} onChange={set("year")} /></Field>
            <Field label="Track #"><input className={inputClass} inputMode="numeric" value={form.trackNo} onChange={set("trackNo")} /></Field>
          </div>
          <div className="mt-2 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={close}>Cancel</Button>
            <Button type="submit">Save</Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

function AddToPlaylistDialog({ songIds }: { songIds: string[] }) {
  const playlists = usePlaylistsWithStats();
  const [newName, setNewName] = useState("");
  const close = () => useUI.getState().openAddToPlaylist(null);
  const add = async (playlistId: string, name: string) => {
    const added = await addSongsToPlaylist(playlistId, songIds);
    toast(added ? `Added to ${name}` : `Already in ${name}`, added ? "success" : "default");
    close();
  };
  return (
    <Modal title={`Add ${pluralize(songIds.length, "song")} to playlist`} onClose={close}>
      <form
        className="mb-4 flex gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          const name = newName.trim() || undefined;
          const id = await createPlaylist(name);
          await add(id, name ?? "new playlist");
        }}
      >
        <input className={inputClass} placeholder="New playlist name" value={newName} onChange={(e) => setNewName(e.target.value)} />
        <Button type="submit" className="shrink-0"><Plus size={16} /> Create</Button>
      </form>
      <ul className="max-h-80 space-y-1 overflow-y-auto">
        {playlists?.map((p) => (
          <li key={p.id}>
            <button onClick={() => add(p.id, p.name)} className="flex w-full items-center gap-3 rounded-md p-2 text-left hover:bg-white/10">
              <Mosaic coverId={p.coverId} artworkIds={p.firstArtworkIds} artworkUrls={p.firstArtworkUrls} seed={p.id} className="size-11" icon={ListMusic} />
              <div className="min-w-0 flex-1">
                <div className="truncate">{p.name}</div>
                <div className="text-xs text-muted">{pluralize(p.songCount, "song")}</div>
              </div>
            </button>
          </li>
        ))}
        {playlists?.length === 0 && <li className="p-2 text-sm text-muted">No playlists yet — create one above.</li>}
      </ul>
    </Modal>
  );
}

function Toaster() {
  const toasts = useUI((s) => s.toasts);
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--player-h)+var(--mobile-nav-h)+16px)] z-[90] flex flex-col items-center gap-2 px-4" aria-live="polite">
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className={`pointer-events-auto flex max-w-md items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium shadow-xl animate-slide-up ${
            t.tone === "error" ? "bg-red-500 text-white" : t.tone === "success" ? "bg-accent text-black" : "bg-[#eee] text-black"
          }`}
          onClick={() => useUI.getState().dismissToast(t.id)}
        >
          {t.tone === "success" && <Check size={16} />}
          {t.message}
        </div>
      ))}
    </div>
  );
}

export function GlobalDialogs() {
  const editId = useUI((s) => s.editSongId);
  const addIds = useUI((s) => s.addToPlaylistSongIds);
  return (
    <>
      {editId && <EditSongDialog key={editId} id={editId} />}
      {addIds && <AddToPlaylistDialog songIds={addIds} />}
      <ConfirmDialog />
      <Toaster />
    </>
  );
}
