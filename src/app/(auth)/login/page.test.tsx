// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

// Mock next/navigation
const mockReplace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

// Mock supabase client — return no user (show login form)
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
    },
  }),
}));

// Mock LoginForm class
vi.mock("./use-login-form", () => ({
  LoginForm: class {
    email = "";
    otp = "";
    phase = "email" as const;
    loading = false;
    error = null;
    canResend = false;
    setEmail(v: string) { this.email = v; }
    setOtp(v: string) { this.otp = v; }
    async submitEmail() {}
    async submitOtp() { return false; }
    async resend() {}
    dispose() {}
  },
}));

describe("LoginPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  it("renders login title with uppercase tracking", async () => {
    const { default: LoginPage } = await import("./page");
    render(<LoginPage />);

    const heading = screen.getByRole("heading", { name: /movemonitor/i });
    expect(heading).toHaveClass("uppercase");
    expect(heading).toHaveClass("tracking-[1.5px]");
  });

  it("applies spring-press to email submit button", async () => {
    const { default: LoginPage } = await import("./page");
    render(<LoginPage />);

    const button = screen.getByRole("button", { name: /skicka kod/i });
    expect(button).toHaveClass("spring-press");
    expect(button.className).not.toContain("active:scale-95");
  });
});
