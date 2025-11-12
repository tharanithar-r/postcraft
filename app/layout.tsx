import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import {Providers} from "./providers";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
      <html lang="en" className='dark'>
        <body
        className={`${inter.variable} font-sans antialiased`}
        >
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
