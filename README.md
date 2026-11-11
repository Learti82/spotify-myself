# Cadence — a private, offline-first music library

A personal, Spotify-style music player for one person. Import music you own or are
authorized to download, organize it into playlists, and listen online or with no
internet at all. Cadence is not a public streaming service: there is no sign-up,
no sharing, no public profiles and no payments.

## Features

| Area | What works |
|---|---|
| **Import** | Drag-and-drop MP3 / WAV / M4A / FLAC / OGG; reads ID3/Vorbis/MP4 tags (title, artist, album, genre, year, track, embedded artwork); falls back to "Artist - Title" file names; metadata editable afterwards. A rights confirmation is required. |
| **Authorized downloads** | Paste a direct link to a file from a source that permits downloading (Creative Commons, public domain, purchases, artist permission). Asks for the legal basis and a license note; shows download progress; refuses YouTube hosts and private-network addresses. |
| **YouTube** | Paste a link → title, channel, thumbnail (and duration, if a `YOUTUBE_API_KEY` is set) via YouTube's official oEmbed / Data API. Playback uses the official **visible** IFrame player. Audio is never extracted, downloaded or converted, and YouTube items are badged and never shown as offline. |
| **Offline** | Audio blobs, artwork, metadata, playlists, likes and history live in IndexedDB. A service worker caches the app shell, so the installed app opens and plays downloaded music in airplane mode. Persistent storage is requested so the browser doesn't evict it. |
| **Offline management** | Green arrow on offline-ready songs, progress rings while downloading, an Offline Music page with storage usage, "remove offline copy" that keeps the library entry, and re-attach / re-download. |
| **Playlists** | Create, rename, describe, delete; add/remove songs; drag-and-drop reordering (mouse, touch and keyboard); custom cover images; song count and total duration; play and shuffle play; download a whole playlist. |
| **Player** | Play/pause, previous/next, seek, volume/mute, shuffle, repeat all / repeat one, editable queue, autoplay next, remembers queue + position across reloads, lock-screen / media-key controls (Media Session), keeps playing while you navigate. |
| **Search** | Instant search across songs, artists, albums, playlists and YouTube items; filters, an offline-only toggle, and sorting. |
| **Home** | Recently played, your playlists, favorites, recently imported, your artists, and categories generated from your library (genres, decades, On Repeat, Fresh Finds, Offline Mix, YouTube Collection). |
| **Privacy** | A passcode gate (HMAC-signed httpOnly cookie) covers every page and API route, with login rate-limiting, `noindex` headers and robots.txt. Optional cloud backup is server-side only. |

### Keyboard shortcuts

`Space` play/pause · `Shift+→/←` next/previous · `→/←` seek 5 s · `↑/↓` volume · `M` mute ·
`S` shuffle · `R` repeat · `L` like · `Q` queue · `/` search

## Architecture

```
Browser (PWA)                                       Server (Next.js, single user)
┌─────────────────────────────────────────┐        ┌─────────────────────────────────────┐
│ React UI (App Router, client components)│        │ proxy.ts  → passcode session gate   │
│   AppShell (persistent layout)          │        │ /api/auth/*      login / logout      │
│     PlaybackEngine  <audio> + YT IFrame │  HTTPS │ /api/youtube     oEmbed metadata     │
│     zustand player store (persisted)    │◄──────►│ /api/fetch-audio authorized download │
│ Dexie / IndexedDB  ◄─ source of truth   │        │ /api/cloud/*     optional Supabase   │
│   songs, audioFiles (blobs), artworks,  │        └──────────────┬──────────────────────┘
│   playlists, playlistSongs, favorites,  │                       │ service-role key (server only)
│   history                               │                       ▼
│ Service worker: app-shell cache         │        Supabase (optional): Postgres + PRIVATE bucket
└─────────────────────────────────────────┘        accessed only via short-lived signed URLs
```

**Why local-first?** Offline playback is the priority, so the device's IndexedDB is
the source of truth and every feature works with no network. Supabase is an optional
backup and sync target, not a dependency. Large audio files are never stored in Postgres.

**How a song is resolved for playback:** the offline blob in IndexedDB, then (online)
a short-lived signed URL for the private cloud original, then the original authorized
download URL. YouTube items always go to the official embedded player.

### Project structure

```
src/
  app/
    (main)/            pages inside the persistent shell (player keeps playing)
      page.tsx         Home
      search/ library/ playlists/ playlist/ liked/ recent/ offline/
      import/ album/ artist/ collection/ settings/
    login/             passcode screen
    api/               auth, youtube, fetch-audio, cloud/*
    manifest.ts        PWA manifest
  components/          AppShell, Sidebar, PlayerBar, PlaybackEngine, QueuePanel,
                       SongList, SongMenu, Dialogs, Artwork, Popover, ui primitives
  hooks/               live IndexedDB queries (dexie-react-hooks), keyboard shortcuts
  lib/                 db (Dexie schema), library (CRUD), metadata (tag parsing),
                       audio-source, cloud-client, youtube, derive (albums/artists/search),
                       auth (HMAC sessions), supabase-server
  store/               zustand: player, ui (toasts/dialogs), downloads (progress)
  proxy.ts             auth gate (Next.js 16 "proxy", formerly middleware)
public/sw.js           service worker
supabase/migrations/   SQL schema (RLS on, no public policies, private bucket)
tests/                 end-to-end test + fixture generator
```

Playlist, album and artist pages use query strings (`/playlist?id=…`) rather than
dynamic segments, so one cached page per section serves every item offline.

### Database schema

The local IndexedDB schema is in `src/lib/db.ts`. The optional Postgres schema is in
`supabase/migrations/0001_init.sql`, with these tables: `songs`, `artists`, `albums`,
`playlists`, `playlist_songs`, `favorites`, `listening_history` and `offline_downloads`.
A song has an id, title, artist, album, duration, artwork URL, audio source
(`local`/`url`/`youtube`), source URL, private storage path, local file reference,
offline availability, rights basis/note and import date. A check constraint
prevents a YouTube item from ever being marked offline.

## Getting started

```bash
npm install
cp .env.example .env.local   # set APP_PASSCODE (and AUTH_SECRET)
npm run dev                   # http://localhost:3000
```

In development with no `APP_PASSCODE` the app is open. In production it is locked
until `APP_PASSCODE` is set. The service worker registers in production builds
(`npm run build && npm start`). To try it in dev, run `localStorage.setItem("sw-dev", "1")`.

Install it as an app from the browser menu ("Install app" / "Add to Home Screen").
Open it once while online so the shell is cached; after that it works offline.

### Optional: private cloud backup (Supabase)

1. Create a Supabase project and run `supabase/migrations/0001_init.sql`. This creates
   the tables with RLS enabled and **no** public policies, plus a private `music` bucket.
2. Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in the server environment
   (never in a `NEXT_PUBLIC_` variable).
3. In **Settings** you can then upload originals, back up your library, and restore
   it on another device. Once a file is backed up you can remove its offline copy and
   download it again later.

### Environment variables

| Name | Required | Purpose |
|---|---|---|
| `APP_PASSCODE` | production | Passcode that unlocks the app |
| `AUTH_SECRET` | recommended | Secret for signing the session cookie |
| `YOUTUBE_API_KEY` | no | Shows durations when adding YouTube links |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_BUCKET` | no | Private cloud backup |

## Testing

```bash
npm run lint && npx tsc --noEmit
npm run build && APP_PASSCODE=test-passcode PORT=3100 npm start &
tests/fixtures.sh /tmp/fixtures            # needs ffmpeg
BASE_URL=http://localhost:3100 PASSCODE=test-passcode FIXTURES=/tmp/fixtures node tests/e2e.cjs
```

The end-to-end test (Playwright) covers login, importing tagged files, playback
controls, navigation without interruption, repeat/shuffle/auto-next, likes, playlist
CRUD with drag-and-drop, search, metadata editing, source restrictions, **offline
playback with the network disabled**, offline-copy removal and re-attach, position
restore and responsive layouts.

## Legal use

Only import audio you own or are licensed to keep. YouTube content is played
exclusively through YouTube's embedded player, in line with YouTube's Terms of Service.
Cadence does not download, extract or convert YouTube media.
