"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Settings, LayoutGrid } from "lucide-react";
import { cn } from "@/lib/utils";

export function AppHeader() {
  const pathname = usePathname();

  return (
    <header className="border-b border-border bg-card text-card-foreground">
      <div className="mx-auto max-w-7xl flex items-center justify-between px-4 py-3">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          Bonus Manager
        </Link>
        <nav className="flex items-center gap-1">
          <Link
            href="/"
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
              pathname === "/"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
          >
            <LayoutGrid className="h-4 w-4" />
            <span className="hidden sm:inline">Главная</span>
          </Link>
          <Link
            href="/settings"
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
              pathname === "/settings"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
          >
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">Настройки</span>
          </Link>
        </nav>
      </div>
    </header>
  );
}
