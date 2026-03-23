import { describe, it, expect, vi } from "vitest";

// Mock next/font/google to avoid side effects
vi.mock("next/font/google", () => ({
  Geist: () => ({ variable: "--font-geist-sans" }),
}));

describe("root layout metadata", () => {
  it("sets title", async () => {
    const { metadata } = await import("./layout");
    expect(metadata.title).toBe("Movemonitor");
  });

  it("configures Apple web app", async () => {
    const { metadata } = await import("./layout");
    expect(metadata.appleWebApp).toEqual({
      capable: true,
      statusBarStyle: "black-translucent",
      title: "Movemonitor",
    });
  });

  it("sets Apple touch icon", async () => {
    const { metadata } = await import("./layout");
    expect(metadata.icons).toEqual({
      apple: "/apple-touch-icon.png",
    });
  });
});
