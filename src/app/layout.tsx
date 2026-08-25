import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  title: "선생잎 | 선생님들의 익명 커뮤니티",
  description: "보육 현장에서 일하는 선생님들이 고민과 자료, 커리어 정보를 나누는 익명 커뮤니티",
  openGraph: { title: "선생잎", description: "선생님들의 고민과 자료, 커리어를 나누는 익명 커뮤니티", siteName: "선생잎", locale: "ko_KR", type: "website", images: ["/opengraph-image"] },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
