import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "sonner";
import { AppHeader } from "@/components/app-header";
import "./globals.css";

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Bonus Manager",
  description: "Offline bonus management application",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          storageKey="bonus-theme"
        >
          <div className="min-h-screen flex flex-col bg-background text-foreground">
            <AppHeader />
            <main className="flex-1">{children}</main>
          </div>
          <Toaster richColors closeButton />
        </ThemeProvider>
      </body>
    </html>
  );
}
