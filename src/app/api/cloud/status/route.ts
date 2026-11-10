import { connection, NextResponse } from "next/server";
import { cloudConfigured } from "@/lib/supabase-server";

export async function GET() {
  await connection(); // evaluate env at request time, not build time
  return NextResponse.json({ enabled: cloudConfigured() });
}
