import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { NextResponse, type NextRequest } from "next/server";
import { isYouTubeHost } from "@/lib/youtube";

/**
 * Downloads an audio file the owner is authorized to keep (e.g. Creative Commons,
 * purchased DRM-free downloads). It refuses YouTube/streaming hosts, non-audio
 * responses and private network addresses.
 */
const MAX_BYTES = 500 * 1024 * 1024;
const AUDIO_TYPES = /^(audio\/|application\/ogg|application\/octet-stream|binary\/octet-stream|video\/(mp4|webm|ogg))/i;

function isPrivateAddress(ip: string): boolean {
  if (ip.startsWith("::ffff:")) ip = ip.slice(7);
  if (isIP(ip) === 4) {
    const [a, b] = ip.split(".").map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  const v6 = ip.toLowerCase();
  return v6 === "::1" || v6 === "::" || v6.startsWith("fc") || v6.startsWith("fd") || v6.startsWith("fe80");
}

async function assertPublicUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("Invalid URL.");
  }
  if (!/^https?:$/.test(url.protocol)) throw new Error("Only http(s) links are supported.");
  if (url.username || url.password) throw new Error("Links with credentials aren't supported.");
  if (isYouTubeHost(url.hostname)) throw new Error("YouTube content can't be downloaded. Add it as a YouTube streaming item instead.");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const addrs = isIP(host) ? [{ address: host }] : await lookup(host, { all: true }).catch(() => []);
  if (!addrs.length) throw new Error("Couldn't resolve that host.");
  if (addrs.some((a) => isPrivateAddress(a.address))) throw new Error("Private network addresses aren't allowed.");
  return url;
}

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("url") ?? "";
  try {
    let url = await assertPublicUrl(raw);
    let res: Response | null = null;
    // Follow redirects manually so every hop is validated.
    for (let hop = 0; hop < 5; hop++) {
      res = await fetch(url, { redirect: "manual", headers: { "user-agent": "PersonalMusicLibrary/1.0" }, signal: AbortSignal.timeout(30_000) });
      if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
        url = await assertPublicUrl(new URL(res.headers.get("location")!, url).href);
        continue;
      }
      break;
    }
    if (!res || !res.ok || !res.body) {
      return NextResponse.json({ error: `The source responded with ${res?.status ?? "an error"}.` }, { status: 502 });
    }
    const type = res.headers.get("content-type") ?? "application/octet-stream";
    if (!AUDIO_TYPES.test(type)) {
      return NextResponse.json({ error: `That link isn't an audio file (got ${type.split(";")[0]}). Use a direct download link.` }, { status: 415 });
    }
    const length = Number(res.headers.get("content-length") ?? 0);
    if (length > MAX_BYTES) return NextResponse.json({ error: "File is larger than 500 MB." }, { status: 413 });

    let seen = 0;
    const limited = res.body.pipeThrough(
      new TransformStream<Uint8Array, Uint8Array>({
        transform(chunk, controller) {
          seen += chunk.byteLength;
          if (seen > MAX_BYTES) controller.error(new Error("File too large"));
          else controller.enqueue(chunk);
        },
      }),
    );
    const headers = new Headers({ "content-type": type, "cache-control": "no-store" });
    if (length) headers.set("content-length", String(length));
    return new Response(limited, { headers });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message || "Download failed." }, { status: 400 });
  }
}
