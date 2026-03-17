"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavBar() {
  const pathname = usePathname();

  const tabs = [
    { href: "/log", label: "Logga" },
    { href: "/history", label: "Historik" },
  ];

  return (
    <nav className="bg-card pb-safe fixed inset-x-0 bottom-0 z-10 flex">
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          className={`flex-1 py-3 text-center text-sm font-medium ${
            pathname === tab.href ? "text-primary" : "text-muted-foreground"
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
