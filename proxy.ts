import { NextRequest, NextResponse } from "next/server";

// Routes that require authentication
const protectedPrefixes = [
  "/home",
  "/onboarding",
  "/profile",
  "/network",
  "/messages",
  "/admin",
  "/account",
  "/notifications",
  "/forums/new",
  "/resources/upload",
  "/inspiration/new",
];

function isProtectedLessonBuilderRoute(pathname: string): boolean {
  if (pathname.startsWith("/lesson-builder/new")) return true;
  if (pathname.startsWith("/lesson-builder/drafts")) return true;

  const previewMatch = pathname.match(/^\/lesson-builder\/[^/]+\/preview(?:\/.*)?$/);
  return previewMatch !== null;
}

// Routes that authenticated users should be redirected away from
const authRoutes = ["/auth/login", "/auth/signup"];

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const hasSession = request.cookies.has("__session");

  const isProtected = protectedPrefixes.some((prefix) =>
    pathname.startsWith(prefix)
  ) || isProtectedLessonBuilderRoute(pathname);
  const isAuthRoute = authRoutes.some((route) => pathname.startsWith(route));

  // Unauthenticated user hitting a protected route → landing page
  if (isProtected && !hasSession) {
    const loginUrl = new URL("/auth/login", request.url);
    loginUrl.searchParams.set("redirect", `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  // Authenticated user hitting auth pages → home feed
  if (isAuthRoute && hasSession) {
    return NextResponse.redirect(new URL("/home", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Run on all routes except static assets, images, and API routes
    "/((?!api|_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
