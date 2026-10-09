import type { Metadata } from "next";
import { Noto_Sans_SC } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";

const notoSans = Noto_Sans_SC({
  variable: "--font-noto-sans",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = new URL(`${protocol}://${host}`);
  const title = "共听空间｜不用说话，也能一起待着";
  const description = "选择彼此的形象和今晚的地点，在同一个手绘世界里同步听歌、靠近，也一起等城市从黄昏亮到夜晚。";
  return {
    metadataBase: origin,
    title,
    description,
    icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
    openGraph: { title, description, type: "website", images: [{ url: new URL("/og-v2.png", origin).toString(), width: 1672, height: 941, alt: "共听空间：不用说话，也能一起待着" }] },
    twitter: { card: "summary_large_image", title, description, images: [new URL("/og-v2.png", origin).toString()] },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className={notoSans.variable}>{children}</body>
    </html>
  );
}
