import { NextRequest, NextResponse } from "next/server";

// Routes that require authentication
const protectedPrefixes = ["/profile", "/lesson-builder", "/admin", "/account"];

// Routes that authenticated users should be redirected away from
const authRoutes = ["/auth/login", "/auth/signup"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = request.cookies.has("__session");

  const isProtected = protectedPrefixes.some((prefix) =>
    pathname.startsWith(prefix)
  );
  const isAuthRoute = authRoutes.some((route) => pathname.startsWith(route));

  // Unauthenticated user hitting a protected route → landing page
  if (isProtected && !hasSession) {
    return NextResponse.redirect(new URL("/", request.url));
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
