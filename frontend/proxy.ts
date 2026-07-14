import createMiddleware from "next-intl/middleware";
import { NextRequest, NextResponse } from "next/server";

import { routing } from "./i18n/routing";

const handleI18nRouting = createMiddleware(routing);

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  const locale = routing.locales.find(
    (currentLocale) =>
      pathname === `/${currentLocale}` ||
      pathname.startsWith(`/${currentLocale}/`),
  );

  const isProtectedRoute = routing.locales.some(
    (currentLocale) =>
      pathname === `/${currentLocale}/publications/new` ||
      pathname.startsWith(`/${currentLocale}/publications/new/`),
  );

  if (isProtectedRoute && !request.cookies.get("rb-session")) {
    const currentLocale = locale ?? routing.defaultLocale;

    const signInUrl = new URL(
      `/${currentLocale}/auth/sign-in`,
      request.url,
    );

    signInUrl.searchParams.set("callbackUrl", pathname);

    return NextResponse.redirect(signInUrl);
  }

  return handleI18nRouting(request);
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};