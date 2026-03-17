import { describe, it, expect, vi, beforeEach } from "vitest";

const mockDeleteMovement = vi.fn();

vi.mock("@/lib/movements", () => ({
  deleteMovement: mockDeleteMovement,
}));

const mockRevalidatePath = vi.fn();

vi.mock("next/cache", () => ({
  revalidatePath: mockRevalidatePath,
}));

describe("deleteTimelineMovement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDeleteMovement.mockResolvedValue(undefined);
  });

  it("calls deleteMovement with the given id", async () => {
    const { deleteTimelineMovement } = await import("./actions");
    await deleteTimelineMovement("test-id");

    expect(mockDeleteMovement).toHaveBeenCalledWith("test-id");
  });

  it("revalidates /history", async () => {
    const { deleteTimelineMovement } = await import("./actions");
    await deleteTimelineMovement("test-id");

    expect(mockRevalidatePath).toHaveBeenCalledWith("/history");
  });

  it("propagates errors from deleteMovement", async () => {
    mockDeleteMovement.mockRejectedValue(new Error("delete failed"));

    const { deleteTimelineMovement } = await import("./actions");
    await expect(deleteTimelineMovement("test-id")).rejects.toThrow(
      "delete failed",
    );
  });
});
