import type { Metadata } from "next";
import Header from "@/components/Header";
import "./globals.css";

export const metadata: Metadata = {
  title: "블로그 카드 스튜디오",
  description:
    "블로그 글과 브랜드 페르소나를 넣으면 카드뉴스 카피와 gpt-image-2 이미지를 만들어 주는 도구. 한글은 웹에서 정확하게 합성하고 PNG로 내려받습니다.",
};

const FONT_HREF =
  "https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;600;800&family=Black+Han+Sans&family=Do+Hyeon&family=Jua&family=Gowun+Dodum&family=Nanum+Myeongjo:wght@400;800&family=Gaegu:wght@400;700&display=swap";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* 캔버스에서 한글을 직접 그리기 때문에 실제 폰트 이름이 필요하다 */}
        <link rel="stylesheet" href={FONT_HREF} />
      </head>
      <body className="min-h-screen antialiased">
        <Header />
        {children}
      </body>
    </html>
  );
}
