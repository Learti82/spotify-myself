"use client";

export interface ParsedAudio {
  title: string;
  artist: string;
  album: string;
  duration: number;
  genre?: string;
  year?: number;
  trackNo?: number;
  artwork?: Blob;
}

export const SUPPORTED_AUDIO = [".mp3", ".wav", ".m4a", ".aac", ".flac", ".ogg", ".oga", ".opus", ".webm"];
export const AUDIO_ACCEPT = "audio/*," + SUPPORTED_AUDIO.join(",");

export function isSupportedAudio(file: { name: string; type: string }): boolean {
  const lower = file.name.toLowerCase();
  return file.type.startsWith("audio/") || SUPPORTED_AUDIO.some((ext) => lower.endsWith(ext));
}

/** "Artist - Title.mp3" → { artist, title }; otherwise the bare file name. */
function guessFromFileName(name: string): { title: string; artist?: string } {
  const base = name.replace(/\.[^.]+$/, "").replace(/[_]+/g, " ").trim();
  const m = base.match(/^(.+?)\s+[-–—]\s+(.+)$/);
  if (m) return { artist: m[1].trim(), title: m[2].trim() };
  return { title: base || "Untitled" };
}

/** Reads the duration with the browser decoder, used when tags don't carry it. */
export function probeDuration(blob: Blob): Promise<number> {
  return new Promise((resolve) => {
    const audio = document.createElement("audio");
    const url = URL.createObjectURL(blob);
    const done = (v: number) => {
      URL.revokeObjectURL(url);
      audio.removeAttribute("src");
      resolve(Number.isFinite(v) ? v : 0);
    };
    audio.preload = "metadata";
    audio.onloadedmetadata = () => done(audio.duration);
    audio.onerror = () => done(0);
    setTimeout(() => done(0), 8000);
    audio.src = url;
  });
}

/** Downscales artwork to keep IndexedDB lean and lists fast. */
export async function resizeImage(blob: Blob, max = 600): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(blob);
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && blob.size < 300_000) return blob;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((res) => canvas.toBlob((b) => res(b ?? blob), "image/jpeg", 0.86));
  } catch {
    return blob;
  }
}

export async function parseAudioFile(blob: Blob, fileName: string): Promise<ParsedAudio> {
  const guess = guessFromFileName(fileName);
  const result: ParsedAudio = {
    title: guess.title,
    artist: guess.artist ?? "Unknown Artist",
    album: "Unknown Album",
    duration: 0,
  };
  try {
    const { parseBlob, selectCover } = await import("music-metadata");
    const meta = await parseBlob(blob, { duration: true, skipPostHeaders: true });
    const c = meta.common;
    if (c.title?.trim()) result.title = c.title.trim();
    if (c.artist?.trim()) result.artist = c.artist.trim();
    else if (c.albumartist?.trim()) result.artist = c.albumartist.trim();
    if (c.album?.trim()) result.album = c.album.trim();
    if (c.genre?.[0]) result.genre = c.genre[0].trim();
    if (c.year) result.year = c.year;
    if (c.track?.no) result.trackNo = c.track.no;
    if (meta.format.duration) result.duration = meta.format.duration;
    const cover = selectCover(c.picture);
    if (cover) {
      const art = new Blob([new Uint8Array(cover.data)], { type: cover.format || "image/jpeg" });
      result.artwork = await resizeImage(art);
    }
  } catch (err) {
    console.warn("Could not read tags for", fileName, err);
  }
  if (!result.duration) result.duration = await probeDuration(blob);
  return result;
}
