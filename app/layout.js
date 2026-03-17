import { Geist } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ImpactBanner from "@/components/ImpactBanner";

const geist = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata = {
  title: {
    default: "NCT Recycling | Thrift Boutique, Bins & Wholesale — Fort Collins, CO",
    template: "%s | NCT Recycling — Fort Collins, CO",
  },
  description:
    "Shop our curated thrift boutique, $2/lb bins, or bulk raw weight bags. 60,000 lbs diverted from Colorado landfills monthly. Bins restocked fresh daily. Mon–Thu 10am–4pm.",
  keywords: [
    "thrift boutique Fort Collins",
    "pound bins Fort Collins",
    "donate clothes Fort Collins",
    "textile recycling Fort Collins",
    "bulk clothing wholesale Colorado",
    "clothing donation Northern Colorado",
  ],
  openGraph: {
    siteName: "NCT Recycling",
    locale: "en_US",
    type: "website",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${geist.variable} antialiased`}>
        <Navbar />
        <ImpactBanner />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
