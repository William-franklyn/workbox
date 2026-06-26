import { NextResponse, type NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isAuthRoute =
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup") ||
    pathname.startsWith("/invite");

  const isAppRoute =
    pathname.startsWith("/chat") ||
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/integrations") ||
    pathname.startsWith("/home") ||
    pathname.startsWith("/tasks") ||
    pathname.startsWith("/goals") ||
    pathname.startsWith("/automations") ||
    pathname.startsWith("/settings");

  // Supabase SSR stores the session in cookies prefixed with the project ref
  const hasSession = request.cookies.getAll().some((c) =>
    c.name.startsWith("sb-") && c.name.includes("-auth-token")
  );

  if (!hasSession && isAppRoute) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (hasSession && isAuthRoute) {
    return NextResponse.redirect(new URL("/home", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api|_/).*)"],
};
