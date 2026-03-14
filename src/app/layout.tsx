import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "音控小組自動排班系統",
  description: "自動排班與人員管理系統",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-TW">
      <body className={`${inter.className} bg-black text-white`}>
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="flex-1 p-8 ml-64 overflow-auto">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
