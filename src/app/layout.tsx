import type { ReactNode } from "react";

export const metadata = {
  title: "DB設計 練習",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ja">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          maxWidth: 640,
          margin: "40px auto",
          padding: "0 16px",
          lineHeight: 1.6,
        }}
      >
        {children}
      </body>
    </html>
  );
}
