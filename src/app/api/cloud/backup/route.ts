import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import type { Favorite, HistoryEntry, Playlist, PlaylistSong, Song } from "@/lib/types";

/**
 * Metadata backup/restore for the private Supabase database.
 * Audio bytes never pass through here (they live in the private bucket).
 */

const iso = (ms?: number) => (ms ? new Date(ms).toISOString() : null);
const ms = (s?: string | null) => (s ? Date.parse(s) : undefined);

function check<T>(r: { data: T; error: { message: string } | null }): T {
  if (r.error) throw new Error(r.error.message);
  return r.data;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      songs: Song[];
      playlists: Playlist[];
      playlistSongs: PlaylistSong[];
      favorites: Favorite[];
      history: HistoryEntry[];
      deviceId?: string;
    };
    const db = supabaseAdmin();
    const songs = body.songs ?? [];

    // Artists & albums are normalized server-side from the songs.
    const artistNames = [...new Set(songs.map((s) => s.artist))];
    const artists = artistNames.length
      ? check(await db.from("artists").upsert(artistNames.map((name) => ({ name })), { onConflict: "name" }).select("id,name"))
      : [];
    const artistId = new Map((artists as { id: string; name: string }[]).map((a) => [a.name, a.id]));
    const albumKeys = [...new Map(songs.filter((s) => s.source !== "youtube").map((s) => [`${s.album}\u0000${s.artist}`, s])).values()];
    const albums = albumKeys.length
      ? check(
          await db
            .from("albums")
            .upsert(albumKeys.map((s) => ({ name: s.album, artist_id: artistId.get(s.artist), year: s.year ?? null })), { onConflict: "name,artist_id" })
            .select("id,name,artist_id"),
        )
      : [];
    const albumId = new Map((albums as { id: string; name: string; artist_id: string }[]).map((a) => [`${a.name}\u0000${a.artist_id}`, a.id]));

    if (songs.length) {
      check(
        await db.from("songs").upsert(
          songs.map((s) => ({
            id: s.id,
            title: s.title,
            artist: s.artist,
            album: s.album,
            artist_id: artistId.get(s.artist) ?? null,
            album_id: albumId.get(`${s.album}\u0000${artistId.get(s.artist)}`) ?? null,
            duration: s.duration || 0,
            genre: s.genre ?? null,
            year: s.year ?? null,
            track_no: s.trackNo ?? null,
            artwork_url: s.artworkUrl ?? null,
            audio_source: s.source,
            source_url: s.sourceUrl ?? null,
            youtube_id: s.youtubeId ?? null,
            file_name: s.fileName ?? null,
            mime_type: s.mimeType ?? null,
            size_bytes: s.size ?? null,
            storage_path: s.cloudPath ?? null,
            local_file_ref: s.offline ? s.id : null,
            offline_available: s.source !== "youtube" && Boolean(s.offline),
            rights_basis: s.rightsBasis ?? null,
            rights_note: s.rightsNote ?? null,
            rights_confirmed_at: iso(s.rightsConfirmedAt),
            play_count: s.playCount ?? 0,
            last_played_at: iso(s.lastPlayedAt),
            imported_at: iso(s.importedAt),
            updated_at: iso(s.updatedAt),
          })),
        ),
      );
    }
    // Mirror deletions.
    const songIds = songs.map((s) => s.id);
    check(await db.from("songs").delete().not("id", "in", `(${songIds.length ? songIds.join(",") : "00000000-0000-0000-0000-000000000000"})`));

    const playlists = body.playlists ?? [];
    if (playlists.length) {
      check(
        await db.from("playlists").upsert(
          playlists.map((p) => ({ id: p.id, name: p.name, description: p.description ?? null, created_at: iso(p.createdAt), updated_at: iso(p.updatedAt) })),
        ),
      );
    }
    const playlistIds = playlists.map((p) => p.id);
    check(await db.from("playlists").delete().not("id", "in", `(${playlistIds.length ? playlistIds.join(",") : "00000000-0000-0000-0000-000000000000"})`));

    check(await db.from("playlist_songs").delete().neq("id", "00000000-0000-0000-0000-000000000000"));
    const entries = (body.playlistSongs ?? []).filter((e) => songIds.includes(e.songId) && playlistIds.includes(e.playlistId));
    if (entries.length) {
      check(
        await db.from("playlist_songs").insert(
          entries.map((e) => ({ id: e.id, playlist_id: e.playlistId, song_id: e.songId, position: e.position, added_at: iso(e.addedAt) })),
        ),
      );
    }

    check(await db.from("favorites").delete().neq("song_id", "00000000-0000-0000-0000-000000000000"));
    const favs = (body.favorites ?? []).filter((f) => songIds.includes(f.songId));
    if (favs.length) check(await db.from("favorites").insert(favs.map((f) => ({ song_id: f.songId, liked_at: iso(f.likedAt) }))));

    const history = (body.history ?? []).filter((h) => songIds.includes(h.songId));
    if (history.length) {
      check(
        await db
          .from("listening_history")
          .upsert(history.map((h) => ({ song_id: h.songId, played_at: iso(h.playedAt) })), { onConflict: "song_id,played_at", ignoreDuplicates: true }),
      );
    }
    const deviceId = typeof body.deviceId === "string" ? body.deviceId.slice(0, 64) : null;
    if (deviceId) {
      check(await db.from("offline_downloads").delete().eq("device_id", deviceId));
      const offline = songs.filter((s) => s.offline && s.source !== "youtube");
      if (offline.length) {
        check(
          await db
            .from("offline_downloads")
            .insert(offline.map((s) => ({ device_id: deviceId, song_id: s.id, size_bytes: s.size ?? null }))),
        );
      }
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function GET() {
  try {
    const db = supabaseAdmin();
    const [songs, playlists, entries, favorites] = await Promise.all([
      db.from("songs").select("*"),
      db.from("playlists").select("*"),
      db.from("playlist_songs").select("*"),
      db.from("favorites").select("*"),
    ]);
    type Row = Record<string, never>;
    return NextResponse.json({
      songs: (check(songs) as Row[]).map(
        (r): Song => ({
          id: r.id,
          title: r.title,
          artist: r.artist,
          album: r.album,
          duration: r.duration ?? 0,
          genre: r.genre ?? undefined,
          year: r.year ?? undefined,
          trackNo: r.track_no ?? undefined,
          artworkUrl: r.artwork_url ?? undefined,
          source: r.audio_source,
          sourceUrl: r.source_url ?? undefined,
          youtubeId: r.youtube_id ?? undefined,
          fileName: r.file_name ?? undefined,
          mimeType: r.mime_type ?? undefined,
          size: r.size_bytes ?? undefined,
          cloudPath: r.storage_path ?? undefined,
          offline: 0,
          rightsBasis: r.rights_basis ?? undefined,
          rightsNote: r.rights_note ?? undefined,
          rightsConfirmedAt: ms(r.rights_confirmed_at),
          playCount: r.play_count ?? 0,
          lastPlayedAt: ms(r.last_played_at),
          importedAt: ms(r.imported_at) ?? Date.now(),
          updatedAt: ms(r.updated_at) ?? Date.now(),
        }),
      ),
      playlists: (check(playlists) as Row[]).map(
        (r): Playlist => ({ id: r.id, name: r.name, description: r.description ?? undefined, createdAt: ms(r.created_at)!, updatedAt: ms(r.updated_at)! }),
      ),
      playlistSongs: (check(entries) as Row[]).map(
        (r): PlaylistSong => ({ id: r.id, playlistId: r.playlist_id, songId: r.song_id, position: r.position, addedAt: ms(r.added_at)! }),
      ),
      favorites: (check(favorites) as Row[]).map((r): Favorite => ({ songId: r.song_id, likedAt: ms(r.liked_at)! })),
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
