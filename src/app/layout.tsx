import type { Metadata } from "next";
import { Inter, DM_Sans, DM_Mono } from "next/font/google";
import localFont from "next/font/local";
import { ClerkProvider } from "@clerk/nextjs";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
});

const dmRegular = localFont({
  src: "../../public/DMSans-Regular.ttf",
  variable: "--font-dm-regular",
  weight: "400",
});

const dmMono = DM_Mono({
  variable: "--font-dm-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Weavy Clone - AI Workflow Builder",
  description: "Build, run, and manage AI-powered workflows with a visual node-based editor",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning>
        <body
          className={`${inter.variable} ${dmSans.variable} ${dmRegular.variable} ${dmMono.variable} font-sans antialiased bg-[var(--background)] text-[var(--foreground)] transition-colors duration-300`}
          suppressHydrationWarning
        >
          <ThemeProvider>
            {children}
          </ThemeProvider>
          <Toaster
            position="bottom-right"
            richColors
            closeButton
          />
        </body>
      </html>
    </ClerkProvider>
  );
}
