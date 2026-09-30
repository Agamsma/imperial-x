import type { Metadata, Viewport } from "next";
import { Geist_Mono, Inter, Playfair_Display } from "next/font/google";
import "./globals.css";
import { SITE_URL } from "@/lib/site";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  style: ["normal", "italic"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const DESCRIPTION =
  "VajraNow is a web dashboard that tells officials which storm hazard is coming, exactly where, how sure we are, and how many minutes they have. SIH 2026 idea by Team OmniSense.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "VajraNow | Storm nowcasting for India",
  description: DESCRIPTION,
  openGraph: {
    title: "VajraNow | Storm nowcasting for India",
    description: DESCRIPTION,
    siteName: "VajraNow",
    type: "website",
    locale: "en_IN",
  },
  twitter: { card: "summary_large_image", title: "VajraNow | Storm nowcasting for India", description: DESCRIPTION },
};

export const viewport: Viewport = {
  themeColor: "#05080d",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${playfair.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
