import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSingle = vi.fn();
const mockSelectCreate = vi.fn().mockReturnValue({ single: mockSingle });
const mockInsert = vi.fn().mockReturnValue({ select: mockSelectCreate });

const mockOrder = vi.fn();
const mockLt = vi.fn().mockReturnValue({ order: mockOrder });
const mockGte = vi.fn().mockReturnValue({ lt: mockLt });
const mockSelectRead = vi.fn().mockReturnValue({ gte: mockGte });

const mockFrom = vi.fn().mockReturnValue({
  insert: mockInsert,
  select: mockSelectRead,
});
const mockGetUser = vi.fn();

const mockClient = {
  from: mockFrom,
  auth: { getUser: mockGetUser },
};

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue(mockClient),
}));

vi.mock("@/lib/date", () => ({
  stockholmDayRange: vi.fn().mockReturnValue({
    start: "2026-03-11T23:00:00.000Z",
    end: "2026-03-12T23:00:00.000Z",
  }),
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
    expect(mockSelectCreate).toHaveBeenCalledWith("id");
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

describe("getMovementsByDay", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOrder.mockResolvedValue({ data: [], error: null });
  });

  it("builds query with correct day range", async () => {
    const { getMovementsByDay } = await import("./movements");
    await getMovementsByDay("2026-03-12");

    expect(mockFrom).toHaveBeenCalledWith("movements");
    expect(mockSelectRead).toHaveBeenCalledWith("id, intensity, occurred_at");
    expect(mockGte).toHaveBeenCalledWith(
      "occurred_at",
      "2026-03-11T23:00:00.000Z",
    );
    expect(mockLt).toHaveBeenCalledWith(
      "occurred_at",
      "2026-03-12T23:00:00.000Z",
    );
    expect(mockOrder).toHaveBeenCalledWith("occurred_at", { ascending: true });
  });

  it("returns movements array", async () => {
    const movements = [
      { id: "1", intensity: "mycket", occurred_at: "2026-03-12T08:00:00Z" },
    ];
    mockOrder.mockResolvedValue({ data: movements, error: null });

    const { getMovementsByDay } = await import("./movements");
    const result = await getMovementsByDay("2026-03-12");

    expect(result).toEqual(movements);
  });

  it("returns empty array when no data", async () => {
    mockOrder.mockResolvedValue({ data: null, error: null });

    const { getMovementsByDay } = await import("./movements");
    const result = await getMovementsByDay("2026-03-12");

    expect(result).toEqual([]);
  });

  it("throws on Supabase error", async () => {
    mockOrder.mockResolvedValue({
      data: null,
      error: { message: "query failed" },
    });

    const { getMovementsByDay } = await import("./movements");
    await expect(getMovementsByDay("2026-03-12")).rejects.toThrow();
  });
});
