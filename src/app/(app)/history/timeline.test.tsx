// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Timeline } from "./timeline";
import { type Movement } from "@/lib/movements";

// Mock sonner + actions (hoisted so vi.mock factories can reference them)
const { mockToastError, mockDeleteTimelineMovement } = vi.hoisted(() => ({
  mockToastError: vi.fn(),
  mockDeleteTimelineMovement: vi.fn(),
}));

vi.mock("sonner", () => {
  const toast = Object.assign(vi.fn(), { error: mockToastError });
  return { toast };
});

vi.mock("./actions", () => ({
  deleteTimelineMovement: mockDeleteTimelineMovement,
}));

// Mock date
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

beforeEach(() => {
  vi.clearAllMocks();
  mockDeleteTimelineMovement.mockResolvedValue(undefined);
});

const movements: Movement[] = [
  { id: "1", intensity: "mycket", occurred_at: "2026-03-12T08:23:00Z" },
  { id: "2", intensity: "mellan", occurred_at: "2026-03-12T10:45:00Z" },
  { id: "3", intensity: "lite", occurred_at: "2026-03-12T14:12:00Z" },
];

describe("Timeline", () => {
  it("renders all movements", () => {
    render(<Timeline movements={movements} />);
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(3);
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
    const buttons = screen.getAllByRole("button");
    expect(buttons[0]).toHaveTextContent("09:23");
    expect(buttons[0]).toHaveTextContent("Mycket");
    expect(buttons[2]).toHaveTextContent("15:12");
    expect(buttons[2]).toHaveTextContent("Lite");
  });

  it("tapping an entry opens the confirmation dialog", async () => {
    const user = userEvent.setup();
    render(<Timeline movements={movements} />);

    const entries = screen.getAllByRole("button");
    await user.click(entries[0]);

    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveTextContent("Radera rörelse?");
  });

  it('tapping "Avbryt" closes the dialog without deleting', async () => {
    const user = userEvent.setup();
    render(<Timeline movements={movements} />);

    const entries = screen.getAllByRole("button");
    await user.click(entries[0]);

    await screen.findByRole("alertdialog");

    const cancelButton = screen.getByRole("button", { name: "Avbryt" });
    await user.click(cancelButton);

    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(mockDeleteTimelineMovement).not.toHaveBeenCalled();
  });

  it("tapping confirm calls delete action with correct id", async () => {
    const user = userEvent.setup();
    render(<Timeline movements={movements} />);

    const entries = screen.getAllByRole("button");
    await user.click(entries[0]);

    await screen.findByRole("alertdialog");

    const confirmButton = screen.getByRole("button", { name: "Radera" });
    await user.click(confirmButton);

    await vi.waitFor(() => {
      expect(mockDeleteTimelineMovement).toHaveBeenCalledWith("1");
    });
  });

  it("shows error toast when delete fails", async () => {
    mockDeleteTimelineMovement.mockRejectedValueOnce(new Error("fail"));

    const user = userEvent.setup();
    render(<Timeline movements={movements} />);

    const entries = screen.getAllByRole("button");
    await user.click(entries[0]);

    await screen.findByRole("alertdialog");

    const confirmButton = screen.getByRole("button", { name: "Radera" });
    await user.click(confirmButton);

    await vi.waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Radering misslyckades");
    });
  });
});
