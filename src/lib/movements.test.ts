import { describe, it, expect, vi, beforeEach } from "vitest";
import { stockholmDayRange } from "@/lib/date";
import { groupByDay } from "@/lib/day-counts";

const mockSingle = vi.fn();
const mockSelectCreate = vi.fn().mockReturnValue({ single: mockSingle });
const mockInsert = vi.fn().mockReturnValue({ select: mockSelectCreate });

const mockOrder = vi.fn();
const mockLt = vi.fn().mockReturnValue({ order: mockOrder });
const mockGte = vi.fn().mockReturnValue({ lt: mockLt });
const mockSelectRead = vi.fn().mockReturnValue({ gte: mockGte });

const mockEqDelete = vi.fn();
const mockDelete = vi.fn().mockReturnValue({ eq: mockEqDelete });

const mockFrom = vi.fn().mockReturnValue({
  insert: mockInsert,
  select: mockSelectRead,
  delete: mockDelete,
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

vi.mock("@/lib/day-counts", () => ({
  groupByDay: vi.fn(),
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

describe("getDayCounts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOrder.mockResolvedValue({ data: [], error: null });
    vi.mocked(stockholmDayRange).mockImplementation((day: string) => {
      if (day === "2026-03-02")
        return {
          start: "2026-03-01T23:00:00.000Z",
          end: "2026-03-02T23:00:00.000Z",
        };
      if (day === "2026-03-15")
        return {
          start: "2026-03-14T23:00:00.000Z",
          end: "2026-03-15T23:00:00.000Z",
        };
      return {
        start: "2026-03-11T23:00:00.000Z",
        end: "2026-03-12T23:00:00.000Z",
      };
    });
    vi.mocked(groupByDay).mockReturnValue([]);
  });

  it("builds query with correct date range", async () => {
    const { getDayCounts } = await import("./movements");
    await getDayCounts("2026-03-02", "2026-03-15");

    expect(stockholmDayRange).toHaveBeenCalledWith("2026-03-02");
    expect(stockholmDayRange).toHaveBeenCalledWith("2026-03-15");
    expect(mockGte).toHaveBeenCalledWith(
      "occurred_at",
      "2026-03-01T23:00:00.000Z",
    );
    expect(mockLt).toHaveBeenCalledWith(
      "occurred_at",
      "2026-03-15T23:00:00.000Z",
    );
  });

  it("selects correct columns", async () => {
    const { getDayCounts } = await import("./movements");
    await getDayCounts("2026-03-02", "2026-03-15");

    expect(mockSelectRead).toHaveBeenCalledWith("intensity, occurred_at");
  });

  it("passes rows to groupByDay and returns its result", async () => {
    const rows = [
      { intensity: "mycket", occurred_at: "2026-03-05T10:00:00Z" },
    ];
    mockOrder.mockResolvedValue({ data: rows, error: null });

    const fakeDayCounts = [
      { day: "2026-03-02", mycket: 1, mellan: 0, lite: 0 },
    ];
    vi.mocked(groupByDay).mockReturnValue(fakeDayCounts);

    const { getDayCounts } = await import("./movements");
    const result = await getDayCounts("2026-03-02", "2026-03-15");

    expect(groupByDay).toHaveBeenCalledWith(rows, "2026-03-02", "2026-03-15");
    expect(result).toEqual(fakeDayCounts);
  });

  it("throws on Supabase error", async () => {
    mockOrder.mockResolvedValue({
      data: null,
      error: { message: "query failed" },
    });

    const { getDayCounts } = await import("./movements");
    await expect(getDayCounts("2026-03-02", "2026-03-15")).rejects.toThrow();
  });
});

describe("deleteMovement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEqDelete.mockResolvedValue({ error: null });
  });

  it("calls Supabase delete with correct id", async () => {
    const { deleteMovement } = await import("./movements");
    await deleteMovement("test-uuid");

    expect(mockFrom).toHaveBeenCalledWith("movements");
    expect(mockDelete).toHaveBeenCalled();
    expect(mockEqDelete).toHaveBeenCalledWith("id", "test-uuid");
  });

  it("throws on Supabase error", async () => {
    mockEqDelete.mockResolvedValue({ error: { message: "delete failed" } });

    const { deleteMovement } = await import("./movements");
    await expect(deleteMovement("test-uuid")).rejects.toThrow();
  });

  it("succeeds when no rows matched (idempotent)", async () => {
    mockEqDelete.mockResolvedValue({ error: null });

    const { deleteMovement } = await import("./movements");
    await expect(deleteMovement("test-uuid")).resolves.toBeUndefined();
  });
});
