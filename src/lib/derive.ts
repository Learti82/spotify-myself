import type { Playlist, Song } from "./types";

export interface Album {
  key: string;
  name: string;
  artist: string;
  songs: Song[];
  artworkId?: string;
  artworkUrl?: string;
  year?: number;
  duration: number;
  latestImport: number;
}

export interface Artist {
  name: string;
  songs: Song[];
  albums: number;
  artworkId?: string;
  artworkUrl?: string;
  plays: number;
}

const byTrack = (a: Song, b: Song) => (a.trackNo ?? 999) - (b.trackNo ?? 999) || a.title.localeCompare(b.title);

export function groupAlbums(songs: Song[]): Album[] {
  const map = new Map<string, Album>();
  for (const s of songs) {
    if (s.source === "youtube") continue;
    const key = `${s.album}\u0000${s.artist}`.toLowerCase();
    let a = map.get(key);
    if (!a) {
      a = { key, name: s.album, artist: s.artist, songs: [], duration: 0, latestImport: 0 };
      map.set(key, a);
    }
    a.songs.push(s);
    a.duration += s.duration || 0;
    a.latestImport = Math.max(a.latestImport, s.importedAt);
    a.year ??= s.year;
    if (!a.artworkId && s.artworkId) a.artworkId = s.artworkId;
    if (!a.artworkUrl && s.artworkUrl) a.artworkUrl = s.artworkUrl;
  }
  for (const a of map.values()) a.songs.sort(byTrack);
  return [...map.values()].sort((a, b) => b.latestImport - a.latestImport);
}

export function groupArtists(songs: Song[]): Artist[] {
  const map = new Map<string, Artist & { albumSet: Set<string> }>();
  for (const s of songs) {
    const key = s.artist.toLowerCase();
    let a = map.get(key);
    if (!a) {
      a = { name: s.artist, songs: [], albums: 0, plays: 0, albumSet: new Set() };
      map.set(key, a);
    }
    a.songs.push(s);
    a.plays += s.playCount || 0;
    if (s.source !== "youtube") a.albumSet.add(s.album.toLowerCase());
    if (!a.artworkId && s.artworkId) a.artworkId = s.artworkId;
    if (!a.artworkUrl && s.artworkUrl) a.artworkUrl = s.artworkUrl;
  }
  return [...map.values()]
    .map(({ albumSet, ...a }) => ({ ...a, albums: albumSet.size }))
    .sort((a, b) => b.plays - a.plays || b.songs.length - a.songs.length || a.name.localeCompare(b.name));
}

export function genres(songs: Song[]): { name: string; count: number }[] {
  const map = new Map<string, { name: string; count: number }>();
  for (const s of songs) {
    if (!s.genre) continue;
    const k = s.genre.toLowerCase();
    const g = map.get(k) ?? { name: s.genre, count: 0 };
    g.count++;
    map.set(k, g);
  }
  return [...map.values()].sort((a, b) => b.count - a.count);
}

export function normalize(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** Simple relevance score: exact > prefix > word-prefix > substring. */
export function score(text: string, q: string): number {
  const t = normalize(text);
  if (!q) return 1;
  if (t === q) return 100;
  if (t.startsWith(q)) return 80;
  if (t.split(/[\s\-_/(]+/).some((w) => w.startsWith(q))) return 60;
  if (t.includes(q)) return 40;
  return 0;
}

export function matchSong(s: Song, q: string): number {
  return Math.max(
    score(s.title, q) * 1.2,
    score(s.artist, q),
    score(s.album, q) * 0.8,
    s.genre ? score(s.genre, q) * 0.6 : 0,
  );
}

export function matchPlaylist(p: Playlist, q: string): number {
  return Math.max(score(p.name, q), p.description ? score(p.description, q) * 0.5 : 0);
}
