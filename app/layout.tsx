import type { Metadata, Viewport } from "next";
import { Vazirmatn } from "next/font/google";
import "./globals.css";

const vazirmatn = Vazirmatn({
  subsets: ["arabic"],
  display: "swap",
  variable: "--font-vazirmatn",
});

export const metadata: Metadata = {
  title: {
    default: "سامانه داخلی خورشید مفاخر",
    template: "%s | خورشید مفاخر",
  },
  applicationName: "خورشید مفاخر",
  description: "سامانه داخلی مدیریت اعضا، باشگاه‌ها و گردش کار سازمان مردم‌نهاد خورشید مفاخر",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "خورشید مفاخر",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: "/khorshid-icon.svg",
    shortcut: "/khorshid-icon.svg",
    apple: "/khorshid-icon.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#172F48",
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fa" dir="rtl">
      <body className={vazirmatn.variable}>{children}</body>
    </html>
  );
}
