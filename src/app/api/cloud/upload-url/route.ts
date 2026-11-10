import { NextResponse, type NextRequest } from "next/server";
import { BUCKET, supabaseAdmin } from "@/lib/supabase-server";

export async function POST(request: NextRequest) {
  try {
    const { songId, fileName } = await request.json();
    if (typeof songId !== "string" || !/^[0-9a-f-]{36}$/.test(songId)) throw new Error("Invalid song id");
    const safeName = String(fileName ?? "audio").replace(/[^A-Za-z0-9._-]+/g, "_").slice(-100) || "audio";
    const path = `songs/${songId}/${safeName}`;
    const { data, error } = await supabaseAdmin().storage.from(BUCKET).createSignedUploadUrl(path, { upsert: true });
    if (error) throw error;
    return NextResponse.json({ url: data.signedUrl, path });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
