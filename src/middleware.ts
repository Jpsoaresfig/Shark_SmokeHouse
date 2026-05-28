import { NextRequest, NextResponse } from "next/server";

const PROTECTED_ROUTES = ["/checkout", "/orders", "/profile"];
const ADMIN_ROUTES = ["/admin"];
const MOTOBOY_ROUTES = ["/motoboy"];
const AUTH_ROUTES = ["/login", "/register"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = request.cookies.get("shark_session")?.value;

  // Redireciona usuário já logado para fora das páginas de auth
  if (AUTH_ROUTES.some((r) => pathname.startsWith(r)) && session) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Protege rotas que exigem login
  if (PROTECTED_ROUTES.some((r) => pathname.startsWith(r)) && !session) {
    const url = new URL("/login", request.url);
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  // Protege rotas de admin (verificação de role é feita no client)
  if (ADMIN_ROUTES.some((r) => pathname.startsWith(r)) && !session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Protege rotas de motoboy
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
    "/admin/:path*",
    "/motoboy/:path*",
    "/login",
    "/register",
  ],
};
