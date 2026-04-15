import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Monk Demo - Next.js + Stripe",
  description: "Demo application showcasing Monk's ability to deploy Next.js backend to containers, frontend to specialized hosting, and integrate Stripe in one go.",
  keywords: ["monk", "nextjs", "stripe", "deployment", "saas"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
