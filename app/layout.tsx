import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FindIt — Find Your Device. Protect What Matters.",
  description:
    "FindIt is a consent-based device recovery service for enrolled phones and devices.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
