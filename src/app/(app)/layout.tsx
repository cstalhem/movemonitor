import { NavBar } from "@/app/(app)/components/nav-bar";

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <main className="flex flex-1 flex-col overflow-auto pb-16">{children}</main>
      <NavBar />
    </>
  );
}
