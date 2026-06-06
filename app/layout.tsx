import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "YouTube 高精度検索ツール | EAVAL",
  description: "YouTubeをキーワード・地域・公開日・再生回数・拡散率で高精度に絞り込む",
  icons: {
    icon: "/eaval-logo.png",
    apple: "/eaval-logo.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
