"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PenLine, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/log", label: "Logga", icon: PenLine },
  { href: "/history", label: "Historik", icon: Clock },
];

export function NavBar() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 flex justify-center px-6 pb-[calc(env(safe-area-inset-bottom,0px)/2)]">
      <div className="flex gap-1 rounded-full bg-card p-1.5 shadow-lg border border-border/50">
        {tabs.map((tab) => {
          const isActive = pathname === tab.href;
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-5 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground active:bg-muted"
              )}
            >
              <Icon className="size-4" />
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
