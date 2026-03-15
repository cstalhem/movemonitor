// @vitest-environment jsdom
/// <reference types="@testing-library/jest-dom/vitest" />
import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Timeline } from "./timeline";
import { type Movement } from "@/lib/movements";

vi.mock("@/lib/date", () => ({
  formatTime: vi.fn((iso: string) => {
    const map: Record<string, string> = {
      "2026-03-12T08:23:00Z": "09:23",
      "2026-03-12T10:45:00Z": "11:45",
      "2026-03-12T14:12:00Z": "15:12",
    };
    return map[iso] ?? "00:00";
  }),
}));

afterEach(cleanup);

const movements: Movement[] = [
  { id: "1", intensity: "mycket", occurred_at: "2026-03-12T08:23:00Z" },
  { id: "2", intensity: "mellan", occurred_at: "2026-03-12T10:45:00Z" },
  { id: "3", intensity: "lite", occurred_at: "2026-03-12T14:12:00Z" },
];

describe("Timeline", () => {
  it("renders all movements", () => {
    render(<Timeline movements={movements} />);
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(3);
  });

  it("displays formatted times", () => {
    render(<Timeline movements={movements} />);
    expect(screen.getByText("09:23")).toBeInTheDocument();
    expect(screen.getByText("11:45")).toBeInTheDocument();
    expect(screen.getByText("15:12")).toBeInTheDocument();
  });

  it("displays intensity labels", () => {
    render(<Timeline movements={movements} />);
    expect(screen.getByText("Mycket")).toBeInTheDocument();
    expect(screen.getByText("Mellan")).toBeInTheDocument();
    expect(screen.getByText("Lite")).toBeInTheDocument();
  });

  it("renders in chronological order", () => {
    render(<Timeline movements={movements} />);
    const items = screen.getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("09:23");
    expect(items[0]).toHaveTextContent("Mycket");
    expect(items[2]).toHaveTextContent("15:12");
    expect(items[2]).toHaveTextContent("Lite");
  });
});
