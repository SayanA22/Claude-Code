import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ServiceWorkerRegistration } from "@/components/pwa/service-worker-registration";
import { ToastProvider } from "@/components/ui/toast";

export const metadata: Metadata = {
  title: { default: "DayOS", template: "%s · DayOS" },
  description:
    "DayOS turns everything you have to do into a plan for today, so you always know what to work on next.",
  applicationName: "DayOS",
  appleWebApp: { capable: true, title: "DayOS", statusBarStyle: "default" },
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/apple-touch-icon.png",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfbfd" },
    { media: "(prefers-color-scheme: dark)", color: "#101018" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/*
          Apply the stored appearance before first paint, so there is no flash
          of the wrong theme, accent or text size. Keep this in sync with
          lib/appearance.ts.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var d=document.documentElement,t=localStorage.getItem('dayos-theme');if(t==='dark'||(!t&&matchMedia('(prefers-color-scheme: dark)').matches))d.classList.add('dark');d.dataset.accent=localStorage.getItem('dayos-accent')||'indigo';var s=localStorage.getItem('dayos-text');if(s)d.dataset.text=s}catch(e){document.documentElement.dataset.accent='indigo'}`,
          }}
        />
      </head>
      <body className="min-h-svh">
        <ToastProvider>{children}</ToastProvider>
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
