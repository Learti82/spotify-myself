import { NextResponse, type NextRequest } from "next/server";
import { BUCKET, isSafeStoragePath, supabaseAdmin } from "@/lib/supabase-server";

/** Short-lived signed URL for streaming or downloading a private original. */
export async function POST(request: NextRequest) {
  try {
    const { path } = await request.json();
    if (!isSafeStoragePath(path)) throw new Error("Invalid path");
    const { data, error } = await supabaseAdmin().storage.from(BUCKET).createSignedUrl(path, 60 * 60);
    if (error) throw error;
    return NextResponse.json({ url: data.signedUrl });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
