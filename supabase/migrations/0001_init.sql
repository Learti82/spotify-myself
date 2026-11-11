-- Cadence: private single-user music library.
-- The app talks to this database only from the server with the service-role key.
-- RLS is enabled with NO policies, so the anon/public API cannot read or write anything.

create extension if not exists pgcrypto;

create table if not exists public.artists (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.albums (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  artist_id uuid references public.artists(id) on delete set null,
  year int,
  created_at timestamptz not null default now(),
  unique (name, artist_id)
);

create table if not exists public.songs (
  id uuid primary key,
  title text not null,
  artist text not null,                 -- denormalized display name
  album text not null,
  artist_id uuid references public.artists(id) on delete set null,
  album_id uuid references public.albums(id) on delete set null,
  duration real not null default 0,     -- seconds
  genre text,
  year int,
  track_no int,
  artwork_url text,                     -- remote artwork (e.g. YouTube thumbnail)
  audio_source text not null check (audio_source in ('local', 'url', 'youtube')),
  source_url text,                      -- original download page/file or YouTube watch URL
  youtube_id text,
  file_name text,
  mime_type text,
  size_bytes bigint,
  storage_path text,                    -- object path in the PRIVATE storage bucket (never public)
  local_file_ref text,                  -- IndexedDB key of the on-device copy, if any
  offline_available boolean not null default false,
  rights_basis text,
  rights_note text,
  rights_confirmed_at timestamptz,
  play_count int not null default 0,
  last_played_at timestamptz,
  imported_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- YouTube items are streaming-only and can never be marked offline.
  constraint youtube_never_offline check (audio_source <> 'youtube' or (offline_available = false and storage_path is null))
);
create index if not exists songs_artist_idx on public.songs (artist_id);
create index if not exists songs_album_idx on public.songs (album_id);
create index if not exists songs_imported_idx on public.songs (imported_at desc);

create table if not exists public.playlists (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  cover_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.playlist_songs (
  id uuid primary key default gen_random_uuid(),
  playlist_id uuid not null references public.playlists(id) on delete cascade,
  song_id uuid not null references public.songs(id) on delete cascade,
  position int not null,
  added_at timestamptz not null default now()
);
create index if not exists playlist_songs_order_idx on public.playlist_songs (playlist_id, position);

create table if not exists public.favorites (
  song_id uuid primary key references public.songs(id) on delete cascade,
  liked_at timestamptz not null default now()
);

create table if not exists public.listening_history (
  id bigint generated always as identity primary key,
  song_id uuid not null references public.songs(id) on delete cascade,
  played_at timestamptz not null default now(),
  unique (song_id, played_at)
);
create index if not exists listening_history_played_idx on public.listening_history (played_at desc);

-- Which devices hold an offline copy (audio bytes stay in each device's IndexedDB).
create table if not exists public.offline_downloads (
  device_id text not null,
  song_id uuid not null references public.songs(id) on delete cascade,
  size_bytes bigint,
  stored_at timestamptz not null default now(),
  primary key (device_id, song_id)
);

alter table public.artists enable row level security;
alter table public.albums enable row level security;
alter table public.songs enable row level security;
alter table public.playlists enable row level security;
alter table public.playlist_songs enable row level security;
alter table public.favorites enable row level security;
alter table public.listening_history enable row level security;
alter table public.offline_downloads enable row level security;

-- Private bucket for original audio files. Access only via short-lived signed URLs.
insert into storage.buckets (id, name, public)
values ('music', 'music', false)
on conflict (id) do update set public = false;
