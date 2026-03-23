// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";

// Mock sonner
const mockToastPromise = vi.fn().mockReturnValue("toast-1");
const mockToastDismiss = vi.fn();
const mockToastError = vi.fn();

vi.mock("sonner", () => {
  const toast = vi.fn();
  toast.promise = mockToastPromise;
  toast.dismiss = mockToastDismiss;
  toast.error = mockToastError;
  return { toast };
});

// Mock actions
const mockLogMovement = vi.fn().mockResolvedValue({ id: "mov-1" });
const mockUndoMovement = vi.fn().mockResolvedValue(undefined);

vi.mock("./actions", () => ({
  logMovement: mockLogMovement,
  undoMovement: mockUndoMovement,
}));

const mockSignOut = vi.fn();
vi.mock("@/app/(auth)/login/actions", () => ({
  signOut: mockSignOut,
}));

// Mock constants (to control button rendering)
vi.mock("@/lib/constants", () => ({
  intensities: [
    {
      value: "mycket",
      label: "Mycket",
      icon: () => null,
      color: "chart-1" as const,
    },
  ],
}));

describe("LogPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
    mockLogMovement.mockResolvedValue({ id: "mov-1" });
    mockUndoMovement.mockResolvedValue(undefined);
    mockToastPromise.mockReturnValue("toast-1");
  });

  it("calls toast.promise with logMovement when button is clicked", async () => {
    const { default: LogPage } = await import("./page");
    render(<LogPage />);

    const button = screen.getByRole("button", { name: /Mycket/i });
    await userEvent.click(button);

    await vi.waitFor(() => {
      expect(mockToastPromise).toHaveBeenCalledTimes(1);
    });

    const [promise, options] = mockToastPromise.mock.calls[0];
    expect(promise).toBeInstanceOf(Promise);
    expect(options).toHaveProperty("loading");
    expect(options).toHaveProperty("success");
    expect(options).toHaveProperty("error");
    expect(options.loading).toBe("Registrerar...");
    expect(options.error).toBe("Kunde inte registrera");
  });

  it("success callback returns message with undo action", async () => {
    const { default: LogPage } = await import("./page");
    render(<LogPage />);

    const button = screen.getByRole("button", { name: /Mycket/i });
    await userEvent.click(button);

    await vi.waitFor(() => {
      expect(mockToastPromise).toHaveBeenCalledTimes(1);
    });

    const [, options] = mockToastPromise.mock.calls[0];
    const successResult = options.success({ id: "mov-1" });

    expect(successResult).toMatchObject({
      message: "Rörelse registrerad",
      action: {
        label: "Ångra",
        onClick: expect.any(Function),
      },
    });
  });

  it("undo action calls undoMovement with correct id", async () => {
    const { default: LogPage } = await import("./page");
    render(<LogPage />);

    const button = screen.getByRole("button", { name: /Mycket/i });
    await userEvent.click(button);

    await vi.waitFor(() => {
      expect(mockToastPromise).toHaveBeenCalledTimes(1);
    });

    const [, options] = mockToastPromise.mock.calls[0];
    const successResult = options.success({ id: "mov-1" });

    // Trigger the undo action
    successResult.action.onClick();

    await vi.waitFor(() => {
      expect(mockUndoMovement).toHaveBeenCalledWith("mov-1");
    });
  });

  it("dismisses previous toast on new log", async () => {
    const { default: LogPage } = await import("./page");
    render(<LogPage />);

    const button = screen.getByRole("button", { name: /Mycket/i });

    // First click
    await userEvent.click(button);
    await vi.waitFor(() => {
      expect(mockToastPromise).toHaveBeenCalledTimes(1);
    });

    // Reset debounce by advancing time
    vi.spyOn(Date, "now").mockReturnValue(Date.now() + 1000);

    // Second click — should dismiss the first toast
    mockToastPromise.mockReturnValue("toast-2");
    await userEvent.click(button);

    await vi.waitFor(() => {
      expect(mockToastDismiss).toHaveBeenCalledWith("toast-1");
      expect(mockToastPromise).toHaveBeenCalledTimes(2);
    });

    vi.restoreAllMocks();
  });

  it("shows error toast when undo fails", async () => {
    mockUndoMovement.mockRejectedValue(new Error("undo failed"));

    const { default: LogPage } = await import("./page");
    render(<LogPage />);

    const button = screen.getByRole("button", { name: /Mycket/i });
    await userEvent.click(button);

    await vi.waitFor(() => {
      expect(mockToastPromise).toHaveBeenCalledTimes(1);
    });

    const [, options] = mockToastPromise.mock.calls[0];
    const successResult = options.success({ id: "mov-1" });

    // Trigger failing undo
    successResult.action.onClick();

    await vi.waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Ångra misslyckades");
    });
  });

  it("renders MOVEMONITOR heading", async () => {
    const { default: LogPage } = await import("./page");
    render(<LogPage />);
    expect(screen.getByRole("heading", { name: /movemonitor/i })).toBeInTheDocument();
  });

  it("renders a logout button", async () => {
    const { default: LogPage } = await import("./page");
    const { container } = render(<LogPage />);
    const logoutBtn = container.querySelector("form button");
    expect(logoutBtn).toBeInTheDocument();
    expect(logoutBtn?.querySelector("svg")).toBeInTheDocument();
  });

  it("applies spring-press class to log buttons", async () => {
    const { default: LogPage } = await import("./page");
    render(<LogPage />);
    const button = screen.getByRole("button", { name: /Mycket/i });
    expect(button).toHaveClass("spring-press");
    expect(button.className).not.toContain("active:scale-95");
  });
});
