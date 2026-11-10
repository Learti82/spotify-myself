const ID_RE = /^[A-Za-z0-9_-]{11}$/;

/** Extracts the 11-character video id from any common YouTube URL form. */
export function parseYouTubeId(input: string): string | null {
  const raw = input.trim();
  if (ID_RE.test(raw)) return raw;
  let url: URL;
  try {
    url = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^(www\.|m\.|music\.)/, "");
  let id: string | null = null;
  if (host === "youtu.be") id = url.pathname.split("/")[1] ?? null;
  else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (url.pathname === "/watch") id = url.searchParams.get("v");
    else {
      const m = url.pathname.match(/^\/(embed|shorts|live|v)\/([^/?#]+)/);
      if (m) id = m[2];
    }
  }
  return id && ID_RE.test(id) ? id : null;
}

export function isYouTubeHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return ["youtube.com", "youtu.be", "youtube-nocookie.com", "googlevideo.com", "ytimg.com"].some(
    (d) => h === d || h.endsWith(`.${d}`),
  );
}

export function youTubeWatchUrl(id: string): string {
  return `https://www.youtube.com/watch?v=${id}`;
}

/** Parses an ISO-8601 duration such as PT1H2M3S into seconds. */
export function parseIsoDuration(iso: string): number {
  const m = iso.match(/^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!m) return 0;
  const [, d, h, min, s] = m.map((v) => Number(v ?? 0));
  return d * 86400 + h * 3600 + min * 60 + s;
}

export interface YouTubeMeta {
  id: string;
  title: string;
  channel: string;
  thumbnail: string;
  duration: number;
  url: string;
}
