import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSingle = vi.fn();
const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
const mockInsert = vi.fn().mockReturnValue({ select: mockSelect });
const mockFrom = vi.fn().mockReturnValue({ insert: mockInsert });
const mockGetUser = vi.fn();

const mockClient = {
  from: mockFrom,
  auth: { getUser: mockGetUser },
};

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue(mockClient),
}));

describe("createMovement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: "mock-uid" } } });
    mockSingle.mockResolvedValue({ data: { id: "test-uuid" }, error: null });
  });

  it("inserts with correct intensity and user_id", async () => {
    const { createMovement } = await import("./movements");
    await createMovement("mycket");

    expect(mockFrom).toHaveBeenCalledWith("movements");
    expect(mockInsert).toHaveBeenCalledWith({
      intensity: "mycket",
      user_id: "mock-uid",
    });
    expect(mockSelect).toHaveBeenCalledWith("id");
  });

  it("returns the movement id", async () => {
    const { createMovement } = await import("./movements");
    const result = await createMovement("mycket");

    expect(result).toEqual({ id: "test-uuid" });
  });

  it("throws when not authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const { createMovement } = await import("./movements");
    await expect(createMovement("mycket")).rejects.toThrow("Not authenticated");
  });

  it("throws when Supabase returns an error", async () => {
    mockSingle.mockResolvedValue({
      data: null,
      error: { message: "insert failed" },
    });

    const { createMovement } = await import("./movements");
    await expect(createMovement("mycket")).rejects.toThrow();
  });
});
