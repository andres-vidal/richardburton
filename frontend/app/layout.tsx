import { SESSION_COOKIE } from "modules/api";
import HTTP from "modules/http";
import type { User } from "modules/users";
import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { ReactNode } from "react";
import "styles/globals.css";
import { Providers } from "./providers";

const api = HTTP.client({ baseURL: process.env.NEXT_INTERNAL_API_URL });

// Read the httpOnly rb-session cookie server-side and ask the backend who the
// user is (GET /users/me → user or null). Fetched once here and provided
// app-wide via the client SessionProvider — no client fetch/store/effect.
async function getSession(): Promise<User | null> {
  const cookie = (await cookies()).get(SESSION_COOKIE);
  if (!cookie) return null;

  try {
    const { data } = await api.get<User | null>("/users/me", {
      headers: { Cookie: `${cookie.name}=${cookie.value}` },
    });
    return data ?? null;
  } catch {
    return null;
  }
}

const APP_NAME = "Richard & Isabel Burton Platform";
const IMAGE_ALT = `${APP_NAME}: A database about Brazilian literature in translation`;
const DESCRIPTION = `The ${APP_NAME} is an open access online repository with reliable data about Brazilian literature in translation to English, stemmed from the need to preserve the Brazilian cultural and historical heritage as well as its international dissemination.`;

// Root layout for the App Router — replaces `pages/_document.tsx` (the HTML shell)
// and the `<Head>`/metadata from `pages/_app.tsx`. Metadata is expressed via the
// App Router `metadata`/`viewport` exports instead of `next/head`.
export const metadata: Metadata = {
  // Base URL for resolving the relative og/twitter image paths below.
  metadataBase: new URL(process.env.APP_URL ?? "http://localhost:3000"),
  title: APP_NAME,
  description: DESCRIPTION,
  authors: [{ name: "Andrés Vidal" }],
  keywords: [
    "Brazilian",
    "Literature",
    "Richard Burton",
    "Isabel Burton",
    "Richard & Isabel Burton",
    "Translation",
    "English",
  ],
  icons: { shortcut: "/favicon.ico" },
  openGraph: {
    type: "website",
    siteName: APP_NAME,
    title: APP_NAME,
    description: DESCRIPTION,
    locale: "en_US",
    images: [
      { url: "/thumbnail.png", alt: IMAGE_ALT, width: 1200, height: 627 },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: APP_NAME,
    description: DESCRIPTION,
    images: [{ url: "/thumbnail.png", alt: IMAGE_ALT }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await getSession();

  return (
    <html lang="en">
      <body>
        <Providers session={session}>{children}</Providers>
      </body>
    </html>
  );
}
