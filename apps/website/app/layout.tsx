import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Inter, Lexend } from "next/font/google";
import { Header } from "../components/Header";
import { Footer } from "../components/Footer";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const lexend = Lexend({ subsets: ["latin"], variable: "--font-lexend", display: "swap", weight: ["500", "600", "700"] });

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://nexaworkforce.example";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Nexa Workforce Solutions — Statutory Payroll & Workforce Compliance for Kenya",
    template: "%s — Nexa Workforce Solutions",
  },
  description:
    "Nexa Workforce Solutions is workforce and payroll infrastructure built for Kenya's statutory environment: accurate PAYE, NSSF, SHIF, and Housing Levy payroll, Employment Act 2007 contract compliance, and AI-assisted contract review — on a secure, multi-tenant platform.",
  openGraph: {
    title: "Nexa Workforce Solutions — Statutory Payroll & Workforce Compliance for Kenya",
    description:
      "Statutory payroll, contract compliance, and AI-assisted review, built for Kenya's regulatory environment.",
    siteName: "Nexa Workforce Solutions",
    locale: "en_KE",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${lexend.variable}`}>
      <body className="flex min-h-screen flex-col font-sans">
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
