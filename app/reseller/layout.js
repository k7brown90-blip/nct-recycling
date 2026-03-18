export const metadata = {
  manifest: "/reseller-manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "NCT Reseller",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function ResellerLayout({ children }) {
  return children;
}
