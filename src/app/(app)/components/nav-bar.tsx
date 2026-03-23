"use client";

import { useRef, useState, useEffect, useCallback } from "react";
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
  const activeIndex = tabs.findIndex((t) => t.href === pathname);
  const containerRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const [indicator, setIndicator] = useState<{ left: number; width: number } | null>(null);

  const measure = useCallback(() => {
    const container = containerRef.current;
    const tab = tabRefs.current[activeIndex];
    if (!container || !tab) return;
    setIndicator({
      left: tab.offsetLeft,
      width: tab.offsetWidth,
    });
  }, [activeIndex]);

  useEffect(() => {
    measure();
  }, [measure]);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 flex justify-center px-6 pb-[calc(env(safe-area-inset-bottom,0px)/4)]">
      <div
        ref={containerRef}
        className="relative flex rounded-full bg-card p-1.5 shadow-lg border border-border/50"
      >
        {/* Sliding indicator */}
        {indicator && (
          <div
            className="absolute top-1.5 bottom-1.5 rounded-full bg-primary transition-[left,width] duration-300 ease-out"
            style={{ left: indicator.left, width: indicator.width }}
          />
        )}

        {tabs.map((tab, i) => {
          const isActive = pathname === tab.href;
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              ref={(el) => { tabRefs.current[i] = el; }}
              href={tab.href}
              className={cn(
                "relative z-10 flex items-center gap-1.5 rounded-full px-5 py-2 text-sm font-medium transition-colors duration-200",
                isActive
                  ? "text-primary-foreground"
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
