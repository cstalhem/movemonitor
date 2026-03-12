import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

// Mock NextResponse
const mockRedirect = vi.fn();
const mockNextResponse = {
  cookies: { set: vi.fn() },
};
const mockNext = vi.fn().mockReturnValue(mockNextResponse);

vi.mock("next/server", () => ({
  NextResponse: {
    next: mockNext,
    redirect: mockRedirect,
  },
}));

// Mock Supabase
const mockGetUser = vi.fn();
const mockCreateServerClient = vi.fn().mockReturnValue({
  auth: { getUser: mockGetUser },
});

vi.mock("@supabase/ssr", () => ({
  createServerClient: mockCreateServerClient,
}));

function makeRequest(pathname: string) {
  const url = new URL(`http://localhost${pathname}`);
  return {
    cookies: {
      getAll: vi.fn().mockReturnValue([]),
      set: vi.fn(),
    },
    nextUrl: {
      pathname,
      clone: () => ({ ...url, pathname: "" }),
    },
    url: url.toString(),
  };
}

describe("proxy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
    mockNext.mockReturnValue(mockNextResponse);
  });

  it("redirects unauthenticated request to /log to /login", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const request = makeRequest("/log");

    const { proxy } = await import("./proxy");
    await proxy(request as unknown as NextRequest);

    expect(mockRedirect).toHaveBeenCalled();
    const redirectUrl = mockRedirect.mock.calls[0][0];
    expect(redirectUrl.pathname).toBe("/login");
  });

  it("passes through unauthenticated request to /login", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const request = makeRequest("/login");

    const { proxy } = await import("./proxy");
    const result = await proxy(request as unknown as NextRequest);

    expect(mockRedirect).not.toHaveBeenCalled();
    expect(result).toBe(mockNextResponse);
  });

  it("passes through unauthenticated request to /auth/confirm", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const request = makeRequest("/auth/confirm");

    const { proxy } = await import("./proxy");
    const result = await proxy(request as unknown as NextRequest);

    expect(mockRedirect).not.toHaveBeenCalled();
    expect(result).toBe(mockNextResponse);
  });

  it("passes through authenticated request to /log", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    const request = makeRequest("/log");

    const { proxy } = await import("./proxy");
    const result = await proxy(request as unknown as NextRequest);

    expect(mockRedirect).not.toHaveBeenCalled();
    expect(result).toBe(mockNextResponse);
  });

  it("calls getUser on every request", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    const request = makeRequest("/log");

    const { proxy } = await import("./proxy");
    await proxy(request as unknown as NextRequest);

    expect(mockGetUser).toHaveBeenCalledOnce();
  });
});
