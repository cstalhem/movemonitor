import { NavBar } from "@/app/(app)/components/nav-bar";
import { Toaster } from "@/components/ui/sonner";

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <main className="flex flex-1 flex-col overflow-auto pb-16">{children}</main>
      <NavBar />
      <Toaster />
    </>
  );
}
