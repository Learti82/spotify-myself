"use client";

import { AlertCircle, CheckCircle2, Clock3, FileAudio, Link2, Loader2, MonitorPlay, Pencil, ShieldCheck, Upload, WifiOff } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useRef, useState } from "react";
import { Artwork } from "@/components/Artwork";
import { Button, Field, inputClass } from "@/components/Modal";
import { Chip, PageContainer } from "@/components/ui";
import { formatBytes, formatTime } from "@/lib/format";
import { fetchWithProgress } from "@/lib/http";
import { addSongsToPlaylist, addYouTubeSong, createPlaylist, importAudioBlob } from "@/lib/library";
import { AUDIO_ACCEPT, isSupportedAudio } from "@/lib/metadata";
import type { RightsBasis, Song } from "@/lib/types";
import { isYouTubeHost, parseYouTubeId, type YouTubeMeta } from "@/lib/youtube";
import { useOnline, usePlaylists } from "@/hooks/library";
import { usePlayer } from "@/store/player";
import { toast, useUI } from "@/store/ui";

type Tab = "files" | "youtube" | "url";

function RightsCheckbox({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <label className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 text-sm transition ${checked ? "border-accent/60 bg-accent/10" : "border-white/15 bg-white/[0.03]"}`}>
      <input type="checkbox" className="mt-0.5 size-4 accent-[var(--color-accent)]" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="text-neutral-200">{children}</span>
    </label>
  );
}

function PlaylistTarget({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const playlists = usePlaylists();
  return (
    <Field label="Also add to playlist (optional)">
      <select className={inputClass} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Don&apos;t add to a playlist</option>
        <option value="__new">+ New playlist</option>
        {playlists?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
    </Field>
  );
}

async function resolvePlaylist(target: string): Promise<string | null> {
  if (!target) return null;
  if (target === "__new") return createPlaylist(`Imported ${new Date().toLocaleDateString()}`);
  return target;
}

function ImportedRow({ song }: { song: Song }) {
  return (
    <li className="flex items-center gap-3 rounded-md p-2 hover:bg-white/[0.05]">
      <Artwork artworkId={song.artworkId} artworkUrl={song.artworkUrl} seed={song.album + song.artist} className="size-10" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm">{song.title}</div>
        <div className="truncate text-xs text-muted">{song.artist} · {song.album}</div>
      </div>
      <span className="hidden text-xs tabular-nums text-muted sm:inline">{formatTime(song.duration)}</span>
      <button className="rounded-full p-2 text-muted hover:bg-white/10 hover:text-white" aria-label={`Edit ${song.title}`} onClick={() => useUI.getState().openEditSong(song.id)}>
        <Pencil size={16} />
      </button>
    </li>
  );
}

// ---------------- Local files ----------------

interface FileJob {
  id: string;
  file: File;
  status: "queued" | "working" | "done" | "error";
  song?: Song;
  error?: string;
}

function FilesImport() {
  const [rights, setRights] = useState(false);
  const [jobs, setJobs] = useState<FileJob[]>([]);
  const [dragging, setDragging] = useState(false);
  const [target, setTarget] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const busy = jobs.some((j) => j.status === "queued" || j.status === "working");

  const run = async (files: File[]) => {
    if (!rights) {
      toast("Please confirm you have the rights to these files first.", "error");
      return;
    }
    const fresh: FileJob[] = files.map((file) => ({
      id: crypto.randomUUID(),
      file,
      status: isSupportedAudio(file) ? "queued" : "error",
      error: isSupportedAudio(file) ? undefined : "Unsupported file type",
    }));
    setJobs((j) => [...fresh, ...j]);
    const playlistId = await resolvePlaylist(target);
    const imported: string[] = [];
    for (const job of fresh) {
      if (job.status === "error") continue;
      setJobs((all) => all.map((j) => (j.id === job.id ? { ...j, status: "working" } : j)));
      try {
        const song = await importAudioBlob(job.file, job.file.name, { source: "local", rights: { basis: "owned" } });
        imported.push(song.id);
        setJobs((all) => all.map((j) => (j.id === job.id ? { ...j, status: "done", song } : j)));
      } catch (err) {
        setJobs((all) => all.map((j) => (j.id === job.id ? { ...j, status: "error", error: (err as Error).message } : j)));
      }
    }
    if (playlistId && imported.length) await addSongsToPlaylist(playlistId, imported);
    if (imported.length) toast(`Imported ${imported.length} song${imported.length === 1 ? "" : "s"} — available offline`, "success");
  };

  return (
    <div className="space-y-5">
      <RightsCheckbox checked={rights} onChange={setRights}>
        I own these audio files or am otherwise authorized to keep and play them for personal listening.
      </RightsCheckbox>
      <div className="max-w-sm"><PlaylistTarget value={target} onChange={setTarget} /></div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void run([...e.dataTransfer.files]);
        }}
        onClick={() => (rights ? input.current?.click() : toast("Please confirm you have the rights to these files first.", "error"))}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && input.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-14 text-center transition ${
          dragging ? "border-accent bg-accent/10" : "border-white/20 hover:border-white/40 hover:bg-white/[0.03]"
        } ${rights ? "" : "opacity-60"}`}
        data-testid="dropzone"
      >
        <Upload size={36} className="text-muted" />
        <div className="text-lg font-semibold">Drop audio files here or click to browse</div>
        <div className="text-sm text-muted">MP3, WAV, M4A, FLAC, OGG · Title, artist, album and artwork are read from tags</div>
        <input
          ref={input}
          type="file"
          multiple
          accept={AUDIO_ACCEPT}
          className="hidden"
          data-testid="file-input"
          onChange={(e) => {
            const files = [...(e.target.files ?? [])];
            e.target.value = "";
            void run(files);
          }}
        />
      </div>
      {jobs.length > 0 && (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-semibold">{busy ? "Importing…" : "Imported"}</h3>
            {!busy && <button className="text-sm text-muted hover:text-white" onClick={() => setJobs([])}>Clear</button>}
          </div>
          <ul className="divide-y divide-white/5 rounded-lg bg-surface p-2" data-testid="import-results">
            {jobs.map((j) =>
              j.status === "done" && j.song ? (
                <ImportedRow key={j.id} song={j.song} />
              ) : (
                <li key={j.id} className="flex items-center gap-3 p-2 text-sm">
                  {j.status === "error" ? <AlertCircle size={18} className="text-red-400" /> : j.status === "working" ? <Loader2 size={18} className="animate-spin text-accent" /> : <Clock3 size={18} className="text-muted" />}
                  <span className="min-w-0 flex-1 truncate">{j.file.name}</span>
                  <span className={`text-xs ${j.status === "error" ? "text-red-400" : "text-muted"}`}>{j.error ?? formatBytes(j.file.size)}</span>
                </li>
              ),
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

// ---------------- YouTube ----------------

function YouTubeImport() {
  const online = useOnline();
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [meta, setMeta] = useState<YouTubeMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [target, setTarget] = useState("");
  const [added, setAdded] = useState<Song[]>([]);

  const lookup = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError(null);
    setMeta(null);
    if (!parseYouTubeId(url)) return setError("That doesn't look like a YouTube video link.");
    setLoading(true);
    try {
      const res = await fetch(`/api/youtube?url=${encodeURIComponent(url)}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Couldn't look up that video.");
      setMeta(json);
      setTitle(json.title);
      setArtist(json.channel);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const add = async (playNow = false) => {
    if (!meta) return;
    const song = await addYouTubeSong({ ...meta, title: title.trim() || meta.title, channel: artist.trim() || meta.channel });
    const playlistId = await resolvePlaylist(target);
    if (playlistId) await addSongsToPlaylist(playlistId, [song.id]);
    setAdded((a) => [song, ...a.filter((s) => s.id !== song.id)]);
    toast("Added to your YouTube collection", "success");
    if (playNow) usePlayer.getState().playSongs([song.id], 0, { label: "YouTube Collection", href: "/library?tab=youtube" });
    setMeta(null);
    setUrl("");
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-neutral-200">
        <MonitorPlay size={18} className="mt-0.5 shrink-0 text-red-400" />
        <p>
          YouTube videos are saved as <strong>streaming items</strong> and play through YouTube&apos;s official embedded player.
          Audio is never extracted, downloaded or converted, so these items need an internet connection and are clearly marked with a YouTube badge.
        </p>
      </div>
      {!online && (
        <p className="flex items-center gap-2 text-sm text-amber-200"><WifiOff size={16} /> You&apos;re offline. Looking up videos needs an internet connection.</p>
      )}
      <form onSubmit={lookup} className="flex flex-col gap-2 sm:flex-row">
        <input className={inputClass} placeholder="https://www.youtube.com/watch?v=…" value={url} onChange={(e) => setUrl(e.target.value)} aria-label="YouTube URL" />
        <Button type="submit" disabled={!url || loading || !online} className="shrink-0">
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Link2 size={16} />} Look up
        </Button>
      </form>
      {error && <p className="flex items-center gap-2 text-sm text-red-400"><AlertCircle size={16} /> {error}</p>}
      {meta && (
        <div className="grid gap-5 rounded-xl bg-surface p-4 sm:grid-cols-[240px_1fr]" data-testid="youtube-preview">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={meta.thumbnail} alt="" className="aspect-video w-full rounded-md object-cover" />
          <div className="space-y-3">
            <Field label="Title"><input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
            <Field label="Artist / channel"><input className={inputClass} value={artist} onChange={(e) => setArtist(e.target.value)} /></Field>
            <p className="text-sm text-muted">
              Channel: {meta.channel} · Duration: {meta.duration ? formatTime(meta.duration) : "shown when played"}
            </p>
            <PlaylistTarget value={target} onChange={setTarget} />
            <div className="flex flex-wrap gap-2 pt-1">
              <Button onClick={() => add(false)}>Add to YouTube collection</Button>
              <Button variant="secondary" onClick={() => add(true)}>Add &amp; play</Button>
            </div>
          </div>
        </div>
      )}
      {added.length > 0 && (
        <ul className="rounded-lg bg-surface p-2">{added.map((s) => <ImportedRow key={s.id} song={s} />)}</ul>
      )}
    </div>
  );
}

// ---------------- Authorized URL download ----------------

const BASIS: [RightsBasis, string][] = [
  ["creative-commons", "Creative Commons license that allows downloading"],
  ["public-domain", "Public domain"],
  ["purchased", "I purchased this download"],
  ["artist-permission", "The artist/rights holder gave me permission"],
  ["other-permission", "Other explicit permission"],
];

function UrlImport() {
  const online = useOnline();
  const [url, setUrl] = useState("");
  const [basis, setBasis] = useState<RightsBasis>("creative-commons");
  const [note, setNote] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [progress, setProgress] = useState<{ loaded: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [target, setTarget] = useState("");
  const [added, setAdded] = useState<Song[]>([]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    let parsed: URL;
    try {
      parsed = new URL(url.trim());
      if (!/^https?:$/.test(parsed.protocol)) throw new Error();
    } catch {
      return setError("Enter a valid http(s) link to an audio file.");
    }
    if (isYouTubeHost(parsed.hostname)) return setError("YouTube links can't be downloaded. Use the YouTube tab to add them as streaming items.");
    if (!confirmed) return setError("Please confirm the source permits downloading.");
    if (basis !== "public-domain" && !note.trim()) return setError("Add a short note about the license or permission (e.g. “CC BY 4.0 via Free Music Archive”).");
    setProgress({ loaded: 0, total: 0 });
    try {
      const blob = await fetchWithProgress(`/api/fetch-audio?url=${encodeURIComponent(parsed.href)}`, { cache: "no-store" }, (loaded, total) => setProgress({ loaded, total }));
      const name = decodeURIComponent(parsed.pathname.split("/").pop() || "download");
      const song = await importAudioBlob(blob, name, { source: "url", sourceUrl: parsed.href, rights: { basis, note: note.trim() || undefined } });
      const playlistId = await resolvePlaylist(target);
      if (playlistId) await addSongsToPlaylist(playlistId, [song.id]);
      setAdded((a) => [song, ...a]);
      toast(`Downloaded "${song.title}" — available offline`, "success");
      setUrl("");
      setConfirmed(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setProgress(null);
    }
  };

  const pct = progress?.total ? Math.round((progress.loaded / progress.total) * 100) : null;
  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="text-sm text-muted">
        Import audio files from sources that explicitly allow downloading — for example Creative Commons archives, public-domain collections,
        purchases from stores that offer DRM-free downloads, or files an artist shared with you.
      </p>
      {!online && <p className="flex items-center gap-2 text-sm text-amber-200"><WifiOff size={16} /> Downloading needs an internet connection.</p>}
      <Field label="Direct link to the audio file">
        <input className={inputClass} placeholder="https://example.org/music/song.mp3" value={url} onChange={(e) => setUrl(e.target.value)} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Why you're allowed to download it">
          <select className={inputClass} value={basis} onChange={(e) => setBasis(e.target.value as RightsBasis)}>
            {BASIS.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
          </select>
        </Field>
        <Field label="License / permission note">
          <input className={inputClass} placeholder="e.g. CC BY 4.0 — Free Music Archive" value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </div>
      <PlaylistTarget value={target} onChange={setTarget} />
      <RightsCheckbox checked={confirmed} onChange={setConfirmed}>
        The source explicitly permits downloading this file and I have the right to keep a personal copy. I&apos;m not using this to bypass
        any platform&apos;s download restrictions.
      </RightsCheckbox>
      {error && <p className="flex items-center gap-2 text-sm text-red-400"><AlertCircle size={16} /> {error}</p>}
      {progress && (
        <div>
          <div className="mb-1 flex justify-between text-xs text-muted">
            <span>Downloading…</span>
            <span className="tabular-nums">{pct != null ? `${pct}%` : formatBytes(progress.loaded)}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded bg-white/10"><div className="h-full bg-accent transition-[width]" style={{ width: `${pct ?? 30}%` }} /></div>
        </div>
      )}
      <Button type="submit" disabled={!url || !!progress || !online}><ShieldCheck size={16} /> Download &amp; save offline</Button>
      {added.length > 0 && <ul className="rounded-lg bg-surface p-2">{added.map((s) => <ImportedRow key={s.id} song={s} />)}</ul>}
    </form>
  );
}

function ImportView() {
  const params = useSearchParams();
  const router = useRouter();
  const tab = (params.get("tab") as Tab) ?? "files";
  return (
    <PageContainer className="max-w-4xl">
      <h1 className="mb-1 text-3xl font-bold">Import Music</h1>
      <p className="mb-6 text-sm text-muted">
        Everything is stored privately on this device. Files you import play without internet. <Link href="/settings" className="underline hover:text-white">Cloud backup</Link> is optional.
      </p>
      <div className="mb-6 flex gap-2 overflow-x-auto" role="tablist">
        <Chip active={tab === "files"} onClick={() => router.replace("/import?tab=files")}><span className="flex items-center gap-1.5"><FileAudio size={14} /> Your files</span></Chip>
        <Chip active={tab === "youtube"} onClick={() => router.replace("/import?tab=youtube")}><span className="flex items-center gap-1.5"><MonitorPlay size={14} /> YouTube link</span></Chip>
        <Chip active={tab === "url"} onClick={() => router.replace("/import?tab=url")}><span className="flex items-center gap-1.5"><Link2 size={14} /> Authorized download</span></Chip>
      </div>
      {tab === "files" && <FilesImport />}
      {tab === "youtube" && <YouTubeImport />}
      {tab === "url" && <UrlImport />}
      <p className="mt-10 flex items-center gap-2 text-xs text-subtle">
        <CheckCircle2 size={14} /> Only import content you own or are licensed to use.
      </p>
    </PageContainer>
  );
}

export default function ImportPage() {
  return (
    <Suspense>
      <ImportView />
    </Suspense>
  );
}
