import { NavBar } from "@/app/(app)/components/nav-bar";
import { Toaster } from "@/components/ui/sonner";

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <main className="flex min-h-0 flex-1 flex-col overflow-hidden pb-18">
        {children}
      </main>
      <NavBar />
      <Toaster />
    </>
  );
}
