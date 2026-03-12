import { describe, it, expect, vi } from "vitest";

const mockSignOut = vi.fn().mockResolvedValue({});
const mockRedirect = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { signOut: mockSignOut },
  }),
}));

vi.mock("next/navigation", () => ({
  redirect: mockRedirect,
}));

describe("signOut", () => {
  it("calls supabase.auth.signOut and redirects to /login", async () => {
    const { signOut } = await import("./actions");
    await signOut();

    expect(mockSignOut).toHaveBeenCalled();
    expect(mockRedirect).toHaveBeenCalledWith("/login");
  });
});
