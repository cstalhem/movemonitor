// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { DayCarousel } from "./day-carousel";
import type { DayCount } from "@/lib/day-counts";

// Mock next/navigation
const mockReplace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

// Mock date helpers
vi.mock("@/lib/date", () => ({
  formatDayLabel: vi.fn((day: string, today: string) => {
    if (day === today) return "Idag";
    if (day === "2026-03-14") return "Igår";
    return `mock ${day}`;
  }),
  offsetDay: vi.fn((day: string, offset: number) => {
    const d = parseInt(day.slice(-2)) + offset;
    return `2026-03-${String(d).padStart(2, "0")}`;
  }),
  stockholmDayRange: vi.fn((day: string) => ({
    start: `${day}T00:00:00.000Z`,
    end: `${day}T23:59:59.999Z`,
  })),
}));

// Mock browser Supabase client
vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        gte: vi.fn(() => ({
          lt: vi.fn(() => ({
            order: vi.fn(() => Promise.resolve({ data: [], error: null })),
          })),
        })),
      })),
    })),
  })),
}));

// Mock IntersectionObserver
const mockObserve = vi.fn();
const mockDisconnect = vi.fn();
beforeEach(() => {
  mockReplace.mockClear();
  mockObserve.mockClear();
  mockDisconnect.mockClear();

  global.IntersectionObserver = vi.fn().mockImplementation(function () {
    return {
      observe: mockObserve,
      unobserve: vi.fn(),
      disconnect: mockDisconnect,
    };
  }) as unknown as typeof IntersectionObserver;

  // Mock scrollIntoView
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  cleanup();
});

const TODAY = "2026-03-15";

const sampleCounts: DayCount[] = [
  { day: "2026-03-13", mycket: 3, mellan: 2, lite: 1 },
  { day: "2026-03-14", mycket: 0, mellan: 0, lite: 0 },
  { day: "2026-03-15", mycket: 1, mellan: 4, lite: 2 },
];

describe("DayCarousel", () => {
  it("renders a bar for each day in dayCounts", () => {
    render(
      <DayCarousel dayCounts={sampleCounts} selectedDay={TODAY} today={TODAY} />,
    );
    const bars = screen.getAllByTestId("stacked-bar");
    expect(bars).toHaveLength(3);
  });

  it("shows a fixed center indicator above the bars", () => {
    render(
      <DayCarousel dayCounts={sampleCounts} selectedDay={TODAY} today={TODAY} />,
    );
    const dot = screen.getByTestId("selected-indicator");
    expect(dot).toBeInTheDocument();
  });

  it("shows the correct date label for the selected day", () => {
    render(
      <DayCarousel dayCounts={sampleCounts} selectedDay={TODAY} today={TODAY} />,
    );
    expect(screen.getByText("Idag")).toBeInTheDocument();
  });

  it("shows legend with per-intensity counts for selected day", () => {
    render(
      <DayCarousel dayCounts={sampleCounts} selectedDay={TODAY} today={TODAY} />,
    );
    // Selected day (2026-03-15) has mycket:1, mellan:4, lite:2
    expect(screen.getByText("Mycket")).toBeInTheDocument();
    expect(screen.getByText("Mellan")).toBeInTheDocument();
    expect(screen.getByText("Lite")).toBeInTheDocument();
    // Counts rendered as large numbers above labels
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
  });

  it("renders no colored segments for empty days", () => {
    render(
      <DayCarousel dayCounts={sampleCounts} selectedDay="2026-03-14" today={TODAY} />,
    );
    const bars = screen.getAllByTestId("stacked-bar");
    // The empty day (index 1, 2026-03-14) should have no segment children
    const emptyBar = bars[1];
    const segments = emptyBar.querySelectorAll("[data-testid='bar-segment']");
    expect(segments).toHaveLength(0);
  });

  it("updates legend when dayCounts prop changes (e.g. after delete)", () => {
    const { rerender } = render(
      <DayCarousel dayCounts={sampleCounts} selectedDay={TODAY} today={TODAY} />,
    );
    // Before: selected day (2026-03-15) has mycket:1, mellan:4, lite:2
    expect(screen.getByText("4")).toBeInTheDocument();

    // Simulate server re-render after deleting one "mellan" movement
    const updatedCounts: DayCount[] = [
      { day: "2026-03-13", mycket: 3, mellan: 2, lite: 1 },
      { day: "2026-03-14", mycket: 0, mellan: 0, lite: 0 },
      { day: "2026-03-15", mycket: 1, mellan: 3, lite: 2 },
    ];
    rerender(
      <DayCarousel dayCounts={updatedCounts} selectedDay={TODAY} today={TODAY} />,
    );
    // After: mellan should be 3, not 4
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.queryByText("4")).toBeNull();
  });

  it("scales bar heights proportionally", () => {
    render(
      <DayCarousel dayCounts={sampleCounts} selectedDay={TODAY} today={TODAY} />,
    );
    const bars = screen.getAllByTestId("bar-stack");
    // Day 1 total = 6 (max), Day 3 total = 7 (max). maxTotal = 7
    // Day 1 height = (6/7)*64 ≈ 54.86
    // Day 2 height = 0 (empty)
    // Day 3 height = (7/7)*64 = 64
    const day3Stack = bars[2];
    expect(day3Stack.style.height).toBe("64px");
  });
});
