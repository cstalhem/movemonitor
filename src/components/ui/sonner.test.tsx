// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

let capturedProps: Record<string, unknown> = {};

vi.mock("sonner", () => ({
  Toaster: (props: Record<string, unknown>) => {
    capturedProps = props;
    return <div data-testid="sonner" />;
  },
}));

// Mock lucide-react icons to avoid import issues
vi.mock("lucide-react", () => ({
  CircleCheckIcon: () => null,
  InfoIcon: () => null,
  TriangleAlertIcon: () => null,
  OctagonXIcon: () => null,
  Loader2Icon: () => null,
}));

describe("Toaster", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
    capturedProps = {};
  });

  it("sets desktop offset with safe area inset", async () => {
    const { Toaster } = await import("@/components/ui/sonner");
    render(<Toaster />);

    expect(capturedProps.offset).toEqual({
      top: "calc(env(safe-area-inset-top, 0px) + 24px)",
    });
  });

  it("sets mobile offset with safe area inset", async () => {
    const { Toaster } = await import("@/components/ui/sonner");
    render(<Toaster />);

    expect(capturedProps.mobileOffset).toEqual({
      top: "calc(env(safe-area-inset-top, 0px) + 16px)",
    });
  });
});
