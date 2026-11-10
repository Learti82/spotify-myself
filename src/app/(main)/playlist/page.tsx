"use client";

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  CircleArrowDown,
  GripVertical,
  ImagePlus,
  ListMusic,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Shuffle,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useRef, useState } from "react";
import { Artwork, Mosaic } from "@/components/Artwork";
import { Button, Field, inputClass, Modal } from "@/components/Modal";
import { MenuDivider, MenuItem, Popover } from "@/components/Popover";
import { SongListHeader, SongRow } from "@/components/SongList";
import { ActionBar, EmptyState, HeroHeader, IconButton, PageContainer, PlayFab } from "@/components/ui";
import { downloadMany } from "@/lib/actions";
import { canDownload } from "@/lib/audio-source";
import { matchSong, normalize } from "@/lib/derive";
import { formatTotalDuration, pluralize } from "@/lib/format";
import {
  addSongsToPlaylist,
  deletePlaylist,
  removePlaylistCover,
  removePlaylistEntry,
  reorderPlaylist,
  setPlaylistCover,
  updatePlaylist,
} from "@/lib/library";
import type { Song } from "@/lib/types";
import { useFavoriteIds, usePlaylist, usePlaylistItems, useSongs, type PlaylistItem } from "@/hooks/library";
import { usePlayer } from "@/store/player";
import { toast, useUI } from "@/store/ui";

function SortableSongRow({ item, index, liked, onPlay }: { item: PlaylistItem; index: number; liked: boolean; onPlay: () => void }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: item.entry.id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={isDragging ? "relative z-10 rounded-md bg-[#2a2a2a] shadow-xl" : ""}
    >
      <SongRow
        song={item.song}
        index={index}
        liked={liked}
        onPlay={onPlay}
        dateValue={item.entry.addedAt}
        onRemoveFromPlaylist={async () => {
          await removePlaylistEntry(item.entry.id);
          toast("Removed from playlist");
        }}
        dragHandle={
          <button
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            onClick={(e) => e.stopPropagation()}
            aria-label={`Reorder ${item.song.title}`}
            className="cursor-grab touch-none rounded p-1 text-muted hover:text-white active:cursor-grabbing"
          >
            <GripVertical size={16} />
          </button>
        }
      />
    </div>
  );
}

function EditPlaylistDialog({ id, name, description, onClose }: { id: string; name: string; description?: string; onClose: () => void }) {
  const [n, setN] = useState(name);
  const [d, setD] = useState(description ?? "");
  return (
    <Modal title="Edit details" onClose={onClose}>
      <form
        className="grid gap-3"
        onSubmit={async (e) => {
          e.preventDefault();
          await updatePlaylist(id, { name: n.trim() || name, description: d.trim() || undefined });
          onClose();
        }}
      >
        <Field label="Name"><input className={inputClass} value={n} onChange={(e) => setN(e.target.value)} autoFocus maxLength={100} /></Field>
        <Field label="Description"><textarea className={`${inputClass} min-h-24 resize-none`} value={d} onChange={(e) => setD(e.target.value)} maxLength={300} placeholder="Add an optional description" /></Field>
        <div className="mt-2 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit">Save</Button>
        </div>
      </form>
    </Modal>
  );
}

function AddSongsPanel({ playlistId, present, onClose, onAdded }: { playlistId: string; present: Set<string>; onClose?: () => void; onAdded: () => void }) {
  const songs = useSongs();
  const [q, setQ] = useState("");
  const results = useMemo(() => {
    const query = normalize(q.trim());
    const list = (songs ?? []).filter((s) => !present.has(s.id));
    if (!query) return list.sort((a, b) => b.importedAt - a.importedAt).slice(0, 20);
    return list
      .map((s) => ({ s, score: matchSong(s, query) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 30)
      .map((x) => x.s);
  }, [songs, q, present]);
  return (
    <section className="mt-8 border-t border-white/10 px-4 pt-6 md:px-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold">Let&apos;s find something for your playlist</h2>
          <div className="relative mt-4 max-w-md">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input className={`${inputClass} pl-10`} placeholder="Search your library" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search songs to add" />
          </div>
        </div>
        {onClose && <IconButton label="Close" onClick={onClose}><X size={22} /></IconButton>}
      </div>
      <ul className="mt-4">
        {results.map((s: Song) => (
          <li key={s.id} className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-white/[0.07]">
            <Artwork artworkId={s.artworkId} artworkUrl={s.artworkUrl} seed={s.album + s.artist} className="size-10" />
            <div className="min-w-0 flex-1">
              <div className="truncate">{s.title}</div>
              <div className="truncate text-sm text-muted">{s.artist}</div>
            </div>
            <div className="hidden min-w-0 flex-1 truncate text-sm text-muted md:block">{s.album}</div>
            <Button
              variant="secondary"
              className="px-4 py-1.5"
              onClick={async () => {
                await addSongsToPlaylist(playlistId, [s.id]);
                onAdded();
              }}
            >
              Add
            </Button>
          </li>
        ))}
        {songs && results.length === 0 && <li className="px-2 py-4 text-sm text-muted">{q ? "No matching songs." : "Every song in your library is already here."}</li>}
      </ul>
    </section>
  );
}

function PlaylistView() {
  const id = useSearchParams().get("id");
  const router = useRouter();
  const playlist = usePlaylist(id);
  const items = usePlaylistItems(id);
  const liked = useFavoriteIds();
  // Optimistic order while a reorder is written; dropped as soon as the DB query updates.
  const [order, setOrder] = useState<{ base: PlaylistItem[] | undefined; list: PlaylistItem[] } | null>(null);
  const [editing, setEditing] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const menuOpen = menuAnchor !== null;
  const setMenuOpen = (v: boolean) => !v && setMenuAnchor(null);
  const [showAdd, setShowAdd] = useState(false);
  const coverInput = useRef<HTMLInputElement>(null);
  const href = `/playlist?id=${id}`;
  const isContext = usePlayer((s) => s.contextHref === href && s.queue.length > 0);

  const list = order && order.base === items ? order.list : (items ?? []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  if (playlist === undefined || items === undefined) return <PageContainer><div className="h-64" /></PageContainer>;
  if (playlist === null) {
    return (
      <EmptyState icon={ListMusic} title="Playlist not found" action={<Link href="/playlists"><Button>Back to playlists</Button></Link>}>
        It may have been deleted.
      </EmptyState>
    );
  }

  const songIds = list.map((x) => x.song.id);
  const total = list.reduce((t, x) => t + (x.song.duration || 0), 0);
  const downloadable = list.filter((x) => canDownload(x.song)).length;
  const offlineCount = list.filter((x) => x.song.offline).length;
  const play = (index = 0, shuffle?: boolean) =>
    usePlayer.getState().playSongs(songIds, index, { label: playlist.name, href, shuffle });

  const onDragEnd = async (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = list.findIndex((x) => x.entry.id === active.id);
    const to = list.findIndex((x) => x.entry.id === over.id);
    const next = arrayMove(list, from, to);
    setOrder({ base: items, list: next });
    await reorderPlaylist(playlist.id, next.map((x) => x.entry.id));
  };

  return (
    <div>
      <HeroHeader
        kind="Playlist"
        title={<button className="text-left hover:underline" onClick={() => setEditing(true)}>{playlist.name}</button>}
        image={
          <button className="group relative size-full overflow-hidden rounded-md" onClick={() => coverInput.current?.click()} aria-label="Change cover">
            <Mosaic
              coverId={playlist.coverId}
              artworkIds={list.slice(0, 4).map((x) => x.song.artworkId)}
              artworkUrls={list.slice(0, 4).map((x) => x.song.artworkUrl)}
              seed={playlist.id}
              className="size-full"
              rounded=""
              icon={ListMusic}
            />
            <span className="absolute inset-0 grid place-items-center bg-black/60 text-sm font-semibold opacity-0 transition group-hover:opacity-100">
              <span className="flex flex-col items-center gap-2"><ImagePlus size={32} /> Choose photo</span>
            </span>
          </button>
        }
        meta={
          <>
            {playlist.description && <p className="mb-2 text-white/70">{playlist.description}</p>}
            <span className="font-semibold text-white">You</span> · {pluralize(list.length, "song")}
            {total > 0 && <>, {formatTotalDuration(total)}</>}
            {offlineCount > 0 && <> · <span className="text-accent">{offlineCount} offline</span></>}
          </>
        }
      />
      <input
        ref={coverInput}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) await setPlaylistCover(playlist.id, f);
        }}
      />
      <ActionBar>
        <PlayFab size="lg" isActive={isContext} onClick={() => play(0)} label="Play playlist" />
        <IconButton label="Shuffle play" onClick={() => list.length && play(0, true)}>
          <Shuffle size={26} />
        </IconButton>
        {downloadable > 0 && (
          <IconButton label={`Download ${downloadable} for offline`} onClick={() => downloadMany(list.map((x) => x.song))}>
            <CircleArrowDown size={28} />
          </IconButton>
        )}
        <IconButton label="Add songs" onClick={() => setShowAdd(true)}>
          <Plus size={26} />
        </IconButton>
        <button aria-label="More options for playlist" className="grid size-10 place-items-center text-muted hover:text-white" onClick={(e) => setMenuAnchor(menuOpen ? null : e.currentTarget)}>
          <MoreHorizontal size={28} />
        </button>
        <Popover anchor={menuAnchor} open={menuOpen} onClose={() => setMenuOpen(false)} align="start">
          <MenuItem icon={Pencil} onClick={() => { setMenuOpen(false); setEditing(true); }}>Edit details</MenuItem>
          <MenuItem icon={ImagePlus} onClick={() => { setMenuOpen(false); coverInput.current?.click(); }}>Change cover</MenuItem>
          {playlist.coverId && (
            <MenuItem icon={X} onClick={() => { setMenuOpen(false); removePlaylistCover(playlist.id); }}>Remove cover</MenuItem>
          )}
          <MenuDivider />
          <MenuItem
            icon={Trash2}
            danger
            onClick={async () => {
              setMenuOpen(false);
              const ok = await useUI.getState().askConfirm({
                title: "Delete playlist?",
                message: `This will delete "${playlist.name}". The songs stay in your library.`,
                confirmLabel: "Delete",
                danger: true,
              });
              if (!ok) return;
              await deletePlaylist(playlist.id);
              toast("Playlist deleted");
              router.push("/playlists");
            }}
          >
            Delete playlist
          </MenuItem>
        </Popover>
      </ActionBar>

      <div className="px-2 md:px-2">
        {list.length > 0 ? (
          <>
            <SongListHeader />
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext items={list.map((x) => x.entry.id)} strategy={verticalListSortingStrategy}>
                {list.map((item, i) => (
                  <SortableSongRow key={item.entry.id} item={item} index={i} liked={liked.has(item.song.id)} onPlay={() => play(i)} />
                ))}
              </SortableContext>
            </DndContext>
          </>
        ) : null}
      </div>
      {(showAdd || list.length === 0) && (
        <AddSongsPanel
          playlistId={playlist.id}
          present={new Set(songIds)}
          onAdded={() => setShowAdd(true)}
          onClose={list.length ? () => setShowAdd(false) : undefined}
        />
      )}
      {editing && <EditPlaylistDialog id={playlist.id} name={playlist.name} description={playlist.description} onClose={() => setEditing(false)} />}
      <div className="h-10" />
    </div>
  );
}

export default function PlaylistPage() {
  return (
    <Suspense>
      <PlaylistView />
    </Suspense>
  );
}
