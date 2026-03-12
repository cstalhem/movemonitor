import { describe, it, expect, vi, beforeEach } from "vitest";

const mockCreateServerClient = vi.fn();
vi.mock("@supabase/ssr", () => ({
  createServerClient: mockCreateServerClient,
}));

const mockCookieStore = {
  getAll: vi.fn().mockReturnValue([]),
  set: vi.fn(),
};
vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue(mockCookieStore),
}));

describe("createClient (server)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
    mockCreateServerClient.mockReturnValue({});
  });

  it("calls createServerClient with URL, key, and cookie adapter", async () => {
    const { createClient } = await import("./server");
    await createClient();

    expect(mockCreateServerClient).toHaveBeenCalledWith(
      "https://test.supabase.co",
      "test-anon-key",
      expect.objectContaining({
        cookies: expect.objectContaining({
          getAll: expect.any(Function),
          setAll: expect.any(Function),
        }),
      })
    );
  });

  it("setAll calls cookieStore.set for each cookie", async () => {
    const { createClient } = await import("./server");
    await createClient();

    const cookiesArg = mockCreateServerClient.mock.calls[0][2].cookies;
    cookiesArg.setAll([
      { name: "a", value: "1", options: { path: "/" } },
      { name: "b", value: "2", options: { path: "/" } },
    ]);

    expect(mockCookieStore.set).toHaveBeenCalledTimes(2);
    expect(mockCookieStore.set).toHaveBeenCalledWith("a", "1", { path: "/" });
    expect(mockCookieStore.set).toHaveBeenCalledWith("b", "2", { path: "/" });
  });

  it("setAll does not throw when cookieStore.set throws", async () => {
    mockCookieStore.set.mockImplementation(() => {
      throw new Error("Read-only context");
    });

    const { createClient } = await import("./server");
    await createClient();

    const cookiesArg = mockCreateServerClient.mock.calls[0][2].cookies;
    expect(() =>
      cookiesArg.setAll([{ name: "a", value: "1", options: {} }])
    ).not.toThrow();
  });
});
