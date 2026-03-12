import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

const mockVerifyOtp = vi.fn();
const mockRedirect = vi.fn((url: URL) => ({ redirected: true, url: url.toString() }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { verifyOtp: mockVerifyOtp },
  }),
}));

vi.mock("next/server", () => ({
  NextResponse: {
    redirect: mockRedirect,
  },
}));

function makeRequest(searchParams: Record<string, string>) {
  const url = new URL("http://localhost/auth/confirm");
  Object.entries(searchParams).forEach(([k, v]) => url.searchParams.set(k, v));
  return { url: url.toString() } as unknown as NextRequest;
}

describe("GET /auth/confirm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects to /log on valid token", async () => {
    mockVerifyOtp.mockResolvedValue({ error: null });

    const { GET } = await import("./route");
    await GET(makeRequest({ token_hash: "abc", type: "email" }));

    expect(mockVerifyOtp).toHaveBeenCalledWith({ token_hash: "abc", type: "email" });
    expect(mockRedirect).toHaveBeenCalledWith(
      expect.objectContaining({ pathname: "/log" })
    );
  });

  it("redirects to custom next path", async () => {
    mockVerifyOtp.mockResolvedValue({ error: null });

    const { GET } = await import("./route");
    await GET(makeRequest({ token_hash: "abc", type: "email", next: "/history" }));

    expect(mockRedirect).toHaveBeenCalledWith(
      expect.objectContaining({ pathname: "/history" })
    );
  });

  it("blocks open redirect with https://evil.com", async () => {
    mockVerifyOtp.mockResolvedValue({ error: null });

    const { GET } = await import("./route");
    await GET(makeRequest({ token_hash: "abc", type: "email", next: "https://evil.com" }));

    expect(mockRedirect).toHaveBeenCalledWith(
      expect.objectContaining({ pathname: "/log" })
    );
  });

  it("blocks open redirect with //evil.com", async () => {
    mockVerifyOtp.mockResolvedValue({ error: null });

    const { GET } = await import("./route");
    await GET(makeRequest({ token_hash: "abc", type: "email", next: "//evil.com" }));

    expect(mockRedirect).toHaveBeenCalledWith(
      expect.objectContaining({ pathname: "/log" })
    );
  });

  it("redirects to /login?error=auth when token_hash is missing", async () => {
    const { GET } = await import("./route");
    await GET(makeRequest({}));

    expect(mockVerifyOtp).not.toHaveBeenCalled();
    expect(mockRedirect).toHaveBeenCalledWith(
      expect.objectContaining({ pathname: "/login" })
    );
  });

  it("redirects to /login?error=auth on verification failure", async () => {
    mockVerifyOtp.mockResolvedValue({ error: { message: "bad token" } });

    const { GET } = await import("./route");
    await GET(makeRequest({ token_hash: "bad", type: "email" }));

    expect(mockRedirect).toHaveBeenCalledWith(
      expect.objectContaining({ pathname: "/login" })
    );
  });
});
