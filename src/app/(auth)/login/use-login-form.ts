import { createClient } from "@/lib/supabase/client";

type Phase = "email" | "otp";

export class LoginForm {
  phase: Phase = "email";
  email = "";
  otp = "";
  error: string | null = null;
  loading = false;
  canResend = false;
  private cooldownTimer: ReturnType<typeof setTimeout> | null = null;
  private _supabase: ReturnType<typeof createClient> | null = null;

  private get supabase() {
    if (!this._supabase) this._supabase = createClient();
    return this._supabase;
  }

  setEmail(email: string) {
    this.email = email;
  }

  setOtp(otp: string) {
    this.otp = otp;
  }

  async submitEmail() {
    this.loading = true;
    this.error = null;

    const { error } = await this.supabase.auth.signInWithOtp({
      email: this.email,
    });

    this.loading = false;

    if (error) {
      this.error = error.message;
      return;
    }

    this.phase = "otp";
    this.canResend = false;
    this.startCooldown();
  }

  async submitOtp(): Promise<boolean> {
    this.loading = true;
    this.error = null;

    const { error } = await this.supabase.auth.verifyOtp({
      email: this.email,
      token: this.otp,
      type: "email",
    });

    this.loading = false;

    if (error) {
      this.error = error.message;
      return false;
    }

    return true;
  }

  async resend() {
    if (!this.canResend) return;
    await this.submitEmail();
  }

  private startCooldown() {
    if (this.cooldownTimer) clearTimeout(this.cooldownTimer);
    this.cooldownTimer = setTimeout(() => {
      this.canResend = true;
    }, 60_000);
  }

  dispose() {
    if (this.cooldownTimer) clearTimeout(this.cooldownTimer);
  }
}

export function useLoginForm() {
  return new LoginForm();
}
