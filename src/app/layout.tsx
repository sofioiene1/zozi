import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Zozi - A Peaceful Walk",
  description: "A little dude walking through an endless Japanese town",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
