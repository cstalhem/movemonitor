import { describe, it, expect } from "vitest";
import manifest from "./manifest";

describe("manifest", () => {
  const result = manifest();

  it("returns app identity fields", () => {
    expect(result.name).toBe("Movemonitor");
    expect(result.short_name).toBe("Movemonitor");
    expect(result.id).toBe("/");
  });

  it("configures standalone display with correct start URL", () => {
    expect(result.display).toBe("standalone");
    expect(result.start_url).toBe("/log");
  });

  it("sets colors to match app background", () => {
    expect(result.background_color).toBe("#EDE0D0");
    expect(result.theme_color).toBe("#EDE0D0");
  });

  it("declares required icon set", () => {
    expect(result.icons).toHaveLength(3);
    expect(result.icons).toContainEqual({
      src: "/icon-192.png",
      sizes: "192x192",
      type: "image/png",
    });
    expect(result.icons).toContainEqual({
      src: "/icon-512.png",
      sizes: "512x512",
      type: "image/png",
    });
    expect(result.icons).toContainEqual({
      src: "/icon-512.png",
      sizes: "512x512",
      type: "image/png",
      purpose: "maskable",
    });
  });
});
