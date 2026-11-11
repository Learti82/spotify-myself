import { NextResponse, type NextRequest } from "next/server";
import { BUCKET, isSafeStoragePath, supabaseAdmin } from "@/lib/supabase-server";

export async function POST(request: NextRequest) {
  try {
    const { path } = await request.json();
    if (!isSafeStoragePath(path)) throw new Error("Invalid path");
    const { error } = await supabaseAdmin().storage.from(BUCKET).remove([path]);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
