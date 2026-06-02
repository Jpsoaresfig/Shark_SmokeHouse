import { NextRequest, NextResponse } from "next/server";

const PROTECTED_ROUTES = ["/checkout", "/orders", "/profile", "/account"];
const ADMIN_ROUTES = ["/admin"];
const MOTOBOY_ROUTES = ["/motoboy"];
const AUTH_ROUTES = ["/login", "/register"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = request.cookies.get("shark_session")?.value;

  // Redirect already-logged-in users away from auth pages
  if (AUTH_ROUTES.some((r) => pathname.startsWith(r)) && session) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Protect routes that require login
  if (PROTECTED_ROUTES.some((r) => pathname.startsWith(r)) && !session) {
    const url = new URL("/login", request.url);
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  // Protect admin routes (role check done client-side)
  if (ADMIN_ROUTES.some((r) => pathname.startsWith(r)) && !session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Protect motoboy routes
  if (MOTOBOY_ROUTES.some((r) => pathname.startsWith(r)) && !session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/checkout/:path*",
    "/orders/:path*",
    "/profile/:path*",
    "/account/:path*",
    "/admin/:path*",
    "/motoboy/:path*",
    "/login",
    "/register",
  ],
};
