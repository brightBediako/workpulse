import type { Metadata } from "next";
import localFont from "next/font/local";
import { Providers } from "./providers";
import "./globals.css";

/** Self-hosted — avoids Google Fonts fetch during Vercel/CI builds. */
const plusJakarta = localFont({
  src: "../fonts/PlusJakartaSans-latin-wght-normal.woff2",
  variable: "--font-plus-jakarta",
  weight: "100 800",
  display: "swap",
});

const ibmPlex = localFont({
  src: [
    {
      path: "../fonts/IBMPlexMono-latin-400-normal.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../fonts/IBMPlexMono-latin-600-normal.woff2",
      weight: "600",
      style: "normal",
    },
  ],
  variable: "--font-ibm-plex",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "WorkPulse Connect",
    template: "%s · WorkPulse Connect",
  },
  description:
    "Find trusted skilled workers in Ghana. Hire verified professionals for plumbing, electrical, cleaning, and more.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${plusJakarta.variable} ${ibmPlex.variable} antialiased bg-background text-on-surface font-sans`}
        suppressHydrationWarning
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
