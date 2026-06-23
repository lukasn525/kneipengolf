import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SessionProvider } from "@/components/SessionProvider";

export const metadata: Metadata = {
  title: "Kneipen-Golf",
  description:
    "Spiel dich mit Freunden durch die Kneipen – wenig Schlücke, verrückte Spielformen, Golf-Wertung.",
  manifest: "/manifest.json",
  icons: { icon: "/icon-192.png", apple: "/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "Kneipen-Golf", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#16110d",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
