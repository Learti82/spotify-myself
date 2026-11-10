import Dexie, { type EntityTable } from "dexie";
import type {
  Artwork,
  AudioFile,
  Favorite,
  HistoryEntry,
  Playlist,
  PlaylistSong,
  Song,
} from "./types";

/**
 * The on-device database. Everything the app needs to work offline lives here:
 * metadata, playlists, favorites, history, audio bytes and artwork.
 * Audio blobs are kept in their own table so listing songs never loads them.
 */
export class LibraryDB extends Dexie {
  songs!: EntityTable<Song, "id">;
  audioFiles!: EntityTable<AudioFile, "songId">;
  artworks!: EntityTable<Artwork, "id">;
  playlists!: EntityTable<Playlist, "id">;
  playlistSongs!: EntityTable<PlaylistSong, "id">;
  favorites!: EntityTable<Favorite, "songId">;
  history!: EntityTable<HistoryEntry, "id">;

  constructor() {
    super("personal-music-library");
    this.version(1).stores({
      songs: "id, title, artist, album, source, offline, importedAt, lastPlayedAt, youtubeId",
      audioFiles: "songId, storedAt",
      artworks: "id",
      playlists: "id, name, createdAt, updatedAt",
      playlistSongs: "id, playlistId, songId, [playlistId+position]",
      favorites: "songId, likedAt",
      history: "++id, songId, playedAt",
    });
  }
}

export const db = new LibraryDB();

export function uid(): string {
  return crypto.randomUUID();
}
