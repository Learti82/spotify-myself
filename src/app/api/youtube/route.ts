import { NextResponse, type NextRequest } from "next/server";
import { parseIsoDuration, parseYouTubeId, youTubeWatchUrl, type YouTubeMeta } from "@/lib/youtube";

/**
 * Looks up public metadata for a YouTube video using YouTube's official oEmbed
 * endpoint (and the Data API for duration, when YOUTUBE_API_KEY is set).
 * No media is fetched here — playback happens in the official embedded player.
 */
export async function GET(request: NextRequest) {
  const input = request.nextUrl.searchParams.get("url") ?? "";
  const id = parseYouTubeId(input);
  if (!id) return NextResponse.json({ error: "Not a valid YouTube video link." }, { status: 400 });

  const watchUrl = youTubeWatchUrl(id);
  const oembed = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(watchUrl)}`, {
    signal: AbortSignal.timeout(8000),
  }).catch(() => null);
  if (!oembed) return NextResponse.json({ error: "Couldn't reach YouTube. Check your connection." }, { status: 502 });
  if (oembed.status === 401 || oembed.status === 403) {
    return NextResponse.json({ error: "This video doesn't allow embedding, so it can't be played here." }, { status: 422 });
  }
  if (!oembed.ok) return NextResponse.json({ error: "Video not found or private." }, { status: 404 });
  const data = (await oembed.json()) as { title?: string; author_name?: string; thumbnail_url?: string };

  let duration = 0;
  const key = process.env.YOUTUBE_API_KEY;
  if (key) {
    try {
      const r = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${id}&key=${encodeURIComponent(key)}`,
        { signal: AbortSignal.timeout(8000) },
      );
      const j = await r.json();
      duration = parseIsoDuration(j.items?.[0]?.contentDetails?.duration ?? "");
    } catch {}
  }

  const meta: YouTubeMeta = {
    id,
    title: data.title ?? "YouTube video",
    channel: data.author_name ?? "YouTube",
    thumbnail: data.thumbnail_url ?? `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    duration,
    url: watchUrl,
  };
  return NextResponse.json(meta);
}
