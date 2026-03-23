import { createClient } from "@/lib/supabase/client";

type Phase = "email" | "otp";

const COOLDOWN_SECONDS = 30;

export class LoginForm {
  phase: Phase = "email";
  email = "";
  otp = "";
  error: string | null = null;
  loading = false;
  canResend = false;
  cooldownSeconds = 0;
  private cooldownTimer: ReturnType<typeof setInterval> | null = null;
  private onTick: (() => void) | null = null;
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

  setOnTick(cb: (() => void) | null) {
    this.onTick = cb;
  }

  private startCooldown() {
    if (this.cooldownTimer) clearInterval(this.cooldownTimer);
    this.cooldownSeconds = COOLDOWN_SECONDS;
    this.cooldownTimer = setInterval(() => {
      this.cooldownSeconds--;
      if (this.cooldownSeconds <= 0) {
        this.cooldownSeconds = 0;
        this.canResend = true;
        if (this.cooldownTimer) clearInterval(this.cooldownTimer);
        this.cooldownTimer = null;
      }
      this.onTick?.();
    }, 1_000);
  }

  dispose() {
    if (this.cooldownTimer) clearInterval(this.cooldownTimer);
  }
}

export function useLoginForm() {
  return new LoginForm();
}
