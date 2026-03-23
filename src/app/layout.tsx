import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "Movemonitor",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Movemonitor",
  },
  icons: {
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} bg-background text-foreground pt-safe flex h-dvh flex-col overflow-hidden font-sans antialiased`}
      >
        {/* Enable :active CSS pseudo-class on iOS Safari */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "document.addEventListener('touchstart',function(){},{passive:true})",
          }}
        />
        {children}
      </body>
    </html>
  );
}
