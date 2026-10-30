import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const title = "yoinkr | Grab any YouTube video, any quality";
const description =
  "Paste a YouTube link, pick a resolution from 4K down to 144p or grab just the audio, and download it. Free, no sign-up, no app to install.";

export const metadata: Metadata = {
  metadataBase: new URL("https://yoinkr.online"),
  title,
  description,
  openGraph: {
    title,
    description,
    url: "https://yoinkr.online",
    siteName: "yoinkr",
    images: [{ url: "/banner.png", width: 1200, height: 630, alt: "yoinkr" }],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: ["/banner.png"],
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
