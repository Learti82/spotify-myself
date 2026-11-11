/** Where a song's audio comes from. */
export type SongSource =
  /** A file the owner uploaded from their device. */
  | "local"
  /** A file downloaded from a URL whose owner explicitly permits downloading. */
  | "url"
  /** A YouTube video, played only through the official embedded player. Never offline. */
  | "youtube";

export type RightsBasis =
  | "owned"
  | "purchased"
  | "creative-commons"
  | "public-domain"
  | "artist-permission"
  | "other-permission";

export interface Song {
  id: string;
  title: string;
  artist: string;
  album: string;
  /** Seconds. 0 when unknown. */
  duration: number;
  genre?: string;
  year?: number;
  trackNo?: number;
  /** Local artwork blob id (artworks table). */
  artworkId?: string;
  /** Remote artwork, e.g. a YouTube thumbnail. */
  artworkUrl?: string;
  source: SongSource;
  /** Original URL (download page/file URL, or the YouTube watch URL). */
  sourceUrl?: string;
  youtubeId?: string;
  fileName?: string;
  mimeType?: string;
  /** Bytes of the audio file, when known. */
  size?: number;
  /** 1 when the audio blob is stored in IndexedDB (indexable boolean). */
  offline: 0 | 1;
  /** Path of the original in the private Supabase bucket, if backed up. */
  cloudPath?: string;
  rightsBasis?: RightsBasis;
  rightsNote?: string;
  rightsConfirmedAt?: number;
  importedAt: number;
  updatedAt: number;
  playCount: number;
  lastPlayedAt?: number;
}

/** offline_downloads: the actual audio bytes kept on this device. */
export interface AudioFile {
  songId: string;
  blob: Blob;
  size: number;
  storedAt: number;
}

export interface Artwork {
  id: string;
  blob: Blob;
}

export interface Playlist {
  id: string;
  name: string;
  description?: string;
  coverId?: string;
  createdAt: number;
  updatedAt: number;
}

export interface PlaylistSong {
  id: string;
  playlistId: string;
  songId: string;
  position: number;
  addedAt: number;
}

export interface Favorite {
  songId: string;
  likedAt: number;
}

export interface HistoryEntry {
  id?: number;
  songId: string;
  playedAt: number;
}

export type RepeatMode = "off" | "all" | "one";
