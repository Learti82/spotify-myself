import { NextResponse, type NextRequest } from "next/server";
import { authBypassed, SESSION_COOKIE, verifySessionToken } from "@/lib/auth";

/** Everything except the login screen and static PWA assets requires the owner's session. */
export async function proxy(request: NextRequest) {
  if (authBypassed()) return NextResponse.next();
  const ok = await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value);
  if (ok) return NextResponse.next();

  const { pathname, search } = request.nextUrl;
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    "/((?!login|api/auth/login|_next/static|_next/image|icons/|sw\\.js|manifest\\.webmanifest|favicon\\.ico|robots\\.txt).*)",
  ],
};
