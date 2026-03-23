// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  usePathname: vi.fn().mockReturnValue("/log"),
}));

// Mock next/link to render a plain anchor with ref forwarding
import { forwardRef } from "react";
vi.mock("next/link", () => ({
  default: forwardRef<
    HTMLAnchorElement,
    { children: React.ReactNode; href: string; className?: string }
  >(({ children, href, className }, ref) => (
    <a href={href} className={className} ref={ref}>
      {children}
    </a>
  )),
}));

describe("NavBar", () => {
  afterEach(() => cleanup());
  it("renders icons alongside tab labels", async () => {
    const { NavBar } = await import("./nav-bar");
    render(<NavBar />);

    // Lucide icons render as SVG elements
    const links = screen.getAllByRole("link");
    links.forEach((link) => {
      expect(link.querySelector("svg")).toBeInTheDocument();
    });
  });

  it("highlights active tab with sliding indicator", async () => {
    const { NavBar } = await import("./nav-bar");
    const { container } = render(<NavBar />);

    const activeLink = screen.getByRole("link", { name: /logga/i });
    expect(activeLink).toHaveClass("text-primary-foreground");

    // The sliding indicator is a sibling div with bg-primary
    const indicator = container.querySelector("nav > div > div.bg-primary");
    expect(indicator).toBeInTheDocument();
  });

  it("renders as a floating pill", async () => {
    const { NavBar } = await import("./nav-bar");
    const { container } = render(<NavBar />);

    // The inner pill container should have rounded-full
    const pill = container.querySelector("nav > div");
    expect(pill).toHaveClass("rounded-full");
  });

  it("does not highlight inactive tab", async () => {
    const { NavBar } = await import("./nav-bar");
    render(<NavBar />);

    const inactiveLink = screen.getByRole("link", { name: /historik/i });
    expect(inactiveLink).not.toHaveClass("bg-primary");
    expect(inactiveLink).toHaveClass("text-muted-foreground");
  });
});
