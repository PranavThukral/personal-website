import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pranav Thukral",
  description:
    "Personal website for Pranav Thukral, Waterloo CS/BBA student, RBC Innovation Developer, and founder of The Pitch Deck.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
//:)