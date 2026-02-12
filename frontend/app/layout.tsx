import "styles/globals.css";
import type { Metadata } from "next";
import { Providers } from "./providers";

const APP_NAME = "Richard & Isabel Burton Platform";
const DESCRIPTION = `The ${APP_NAME} is an open access online repository with reliable data about Brazilian literature in translation to English, stemmed from the need to preserve the Brazilian cultural and historical heritage as well as its international dissemination.`;
const KEYWORDS =
  "Brazilian, Literature, Richard Burton, Isabel Burton, Richard & Isabel Burton, Translation, English";
const IMAGE_ALT = `${APP_NAME}: A database about Brazilian literature in translation`;

export const metadata: Metadata = {
  title: APP_NAME,
  description: DESCRIPTION,
  authors: [{ name: "Andrés Vidal" }],
  keywords: KEYWORDS,
  openGraph: {
    title: APP_NAME,
    locale: "en_US",
    siteName: APP_NAME,
    description: DESCRIPTION,
    images: [
      {
        url: "/thumbnail.png",
        alt: IMAGE_ALT,
        width: 1200,
        height: 627,
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: APP_NAME,
    description: DESCRIPTION,
    images: {
      url: "/thumbnail.png",
      alt: IMAGE_ALT,
    },
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-screen">
      <head>
        <link rel="shortcut icon" href="/favicon.ico" />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
