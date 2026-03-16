import { describe, it, expect, vi, beforeEach } from "vitest";

const mockCreateMovement = vi.fn();
const mockDeleteMovement = vi.fn();

vi.mock("@/lib/movements", () => ({
  createMovement: mockCreateMovement,
  deleteMovement: mockDeleteMovement,
}));

const mockRevalidatePath = vi.fn();

vi.mock("next/cache", () => ({
  revalidatePath: mockRevalidatePath,
}));

describe("logMovement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateMovement.mockResolvedValue({ id: "test-uuid" });
  });

  it("calls createMovement with intensity and returns id", async () => {
    const { logMovement } = await import("./actions");
    const result = await logMovement("mycket");

    expect(mockCreateMovement).toHaveBeenCalledWith("mycket");
    expect(result).toEqual({ id: "test-uuid" });
  });

  it("revalidates /history", async () => {
    const { logMovement } = await import("./actions");
    await logMovement("mycket");

    expect(mockRevalidatePath).toHaveBeenCalledWith("/history");
  });
});

describe("undoMovement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDeleteMovement.mockResolvedValue(undefined);
  });

  it("calls deleteMovement with the given id", async () => {
    const { undoMovement } = await import("./actions");
    await undoMovement("test-uuid");

    expect(mockDeleteMovement).toHaveBeenCalledWith("test-uuid");
  });

  it("revalidates /history", async () => {
    const { undoMovement } = await import("./actions");
    await undoMovement("test-uuid");

    expect(mockRevalidatePath).toHaveBeenCalledWith("/history");
  });

  it("propagates errors from deleteMovement", async () => {
    mockDeleteMovement.mockRejectedValue(new Error("delete failed"));

    const { undoMovement } = await import("./actions");
    await expect(undoMovement("test-uuid")).rejects.toThrow("delete failed");
  });
});
