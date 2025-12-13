import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "CarpoolConnect - Share Rides, Save Money, Save the Planet",
  description: "Join the modern carpooling revolution. Connect with drivers and passengers heading your way. Safe, affordable, and eco-friendly rides for everyone.",
  keywords: "carpool, rideshare, commute, eco-friendly, ride sharing, travel, sustainable transport",
  openGraph: {
    title: "CarpoolConnect - Share Rides, Save Money, Save the Planet",
    description: "Join the modern carpooling revolution. Connect with drivers and passengers heading your way.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className={`${inter.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}
