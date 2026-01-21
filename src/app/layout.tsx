import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css"; // <--- ВОТ ЭТА СТРОКА ОТВЕЧАЕТ ЗА СТИЛИ

const inter = Inter({ subsets: ["latin", "cyrillic"] });

export const metadata: Metadata = {
  title: "Video Chat App",
  description: "Created with Next.js and Supabase",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body className={inter.className}>{children}</body>
    </html>
  );
}