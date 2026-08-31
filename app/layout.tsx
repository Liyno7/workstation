import "./globals.css";

export const metadata = {
  title: "工作站",
  description: "任翔宇的个人工作站",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className="h-full">
      <body className="h-full">{children}</body>
    </html>
  );
}
