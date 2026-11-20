import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toast";

export const metadata: Metadata = {
  title: {
    default: "Umar Baig — Private Membership & Rewards Platform",
    template: "%s · Umar Baig",
  },
  description:
    "A private advertising, membership and rewards platform demonstration. All payments, rewards and withdrawals are simulated.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white antialiased">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
