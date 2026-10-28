import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "AII — Artist Identity Interactive",
    template: "%s | AII",
  },
  description: "Make Your Sound Visible. The platform where artists create interactive music experiences and fans participate in them.",
  keywords: ["music", "artist", "interactive", "experience", "creative", "fan"],
  authors: [{ name: "AII" }],
  openGraph: {
    type: "website",
    locale: "ko_KR",
    alternateLocale: "en_US",
    title: "AII — Artist Identity Interactive",
    description: "Make Your Sound Visible.",
    siteName: "AII",
  },
  twitter: {
    card: "summary_large_image",
    title: "AII — Make Your Sound Visible",
    description: "The platform where artists create interactive music experiences.",
  },
  robots: {
    index: true,
    follow: true,
  },
  metadataBase: new URL(
    process.env["NEXT_PUBLIC_SITE_URL"] ?? "http://localhost:3000"
  ),
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body
        className={`${GeistSans.variable} ${GeistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
