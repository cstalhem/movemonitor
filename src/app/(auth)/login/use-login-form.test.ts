import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockSignInWithOtp = vi.fn();
const mockVerifyOtp = vi.fn();
const mockGetUser = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(() => ({
    auth: {
      signInWithOtp: mockSignInWithOtp,
      verifyOtp: mockVerifyOtp,
      getUser: mockGetUser,
    },
  })),
}));

describe("useLoginForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockGetUser.mockResolvedValue({ data: { user: null } });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("initial state is email phase with empty email and no error", async () => {
    const { useLoginForm } = await import("./use-login-form");
    const form = useLoginForm();

    expect(form.phase).toBe("email");
    expect(form.email).toBe("");
    expect(form.error).toBe(null);
  });

  it("submitEmail calls signInWithOtp with the email", async () => {
    mockSignInWithOtp.mockResolvedValue({ error: null });

    const { useLoginForm } = await import("./use-login-form");
    const form = useLoginForm();
    form.setEmail("test@example.com");
    await form.submitEmail();

    expect(mockSignInWithOtp).toHaveBeenCalledWith({
      email: "test@example.com",
    });
  });

  it("transitions to otp phase after successful OTP send", async () => {
    mockSignInWithOtp.mockResolvedValue({ error: null });

    const { useLoginForm } = await import("./use-login-form");
    const form = useLoginForm();
    form.setEmail("test@example.com");
    await form.submitEmail();

    expect(form.phase).toBe("otp");
  });

  it("submitOtp calls verifyOtp with email, token, and type", async () => {
    mockSignInWithOtp.mockResolvedValue({ error: null });
    mockVerifyOtp.mockResolvedValue({ error: null });

    const { useLoginForm } = await import("./use-login-form");
    const form = useLoginForm();
    form.setEmail("test@example.com");
    await form.submitEmail();
    form.setOtp("123456");
    await form.submitOtp();

    expect(mockVerifyOtp).toHaveBeenCalledWith({
      email: "test@example.com",
      token: "123456",
      type: "email",
    });
  });

  it("failed verification sets error and stays in otp phase", async () => {
    mockSignInWithOtp.mockResolvedValue({ error: null });
    mockVerifyOtp.mockResolvedValue({
      error: { message: "Token has expired or is invalid" },
    });

    const { useLoginForm } = await import("./use-login-form");
    const form = useLoginForm();
    form.setEmail("test@example.com");
    await form.submitEmail();
    await form.submitOtp();

    expect(form.phase).toBe("otp");
    expect(form.error).toBe("Token has expired or is invalid");
  });

  it("resend is disabled during cooldown period", async () => {
    mockSignInWithOtp.mockResolvedValue({ error: null });

    const { useLoginForm } = await import("./use-login-form");
    const form = useLoginForm();
    form.setEmail("test@example.com");
    await form.submitEmail();

    expect(form.canResend).toBe(false);

    // Advance past the cooldown (60s)
    vi.advanceTimersByTime(60_000);
    expect(form.canResend).toBe(true);
  });
});
