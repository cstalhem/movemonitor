"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LoginForm } from "./use-login-form";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { REGEXP_ONLY_DIGITS } from "input-otp";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";

export default function LoginPage() {
  const router = useRouter();
  const [form] = useState(() => new LoginForm());
  const [, rerender] = useState(0);
  const kick = useCallback(() => rerender((n) => n + 1), []);

  // Redirect if already logged in
  useEffect(() => {
    createClient()
      .auth.getUser()
      .then(({ data: { user } }) => {
        if (user) router.replace("/log");
      });
  }, [router]);

  // Cleanup cooldown timer
  useEffect(() => {
    return () => form.dispose();
  }, [form]);

  const handleEmailSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    await form.submitEmail();
    kick();
  };

  const handleOtpSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const success = await form.submitOtp();
    if (success) {
      router.replace("/log");
    } else {
      kick();
    }
  };

  const handleResend = async () => {
    await form.resend();
    kick();
  };

  return (
    <div className="w-full max-w-sm">
      <h1 className="text-foreground mb-8 text-center text-2xl font-bold">
        Movemonitor
      </h1>

      {form.error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{form.error}</AlertDescription>
        </Alert>
      )}

      {form.phase === "email" ? (
        <form onSubmit={handleEmailSubmit} className="flex flex-col gap-4">
          <Label htmlFor="email">E-post</Label>
          <Input
            id="email"
            type="text"
            inputMode="email"
            required
            autoFocus
            value={form.email}
            onChange={(e) => {
              form.setEmail(e.target.value);
              kick();
            }}
            placeholder="din@email.se"
            className="bg-card h-12"
          />
          <Button
            type="submit"
            disabled={form.loading}
            className="h-12 touch-manipulation rounded-2xl px-6 text-lg font-semibold transition-transform active:scale-95"
          >
            {form.loading ? "Skickar..." : "Skicka kod"}
          </Button>
        </form>
      ) : (
        <form onSubmit={handleOtpSubmit} className="flex flex-col gap-4">
          <p className="text-muted-foreground text-center text-sm">
            Ange koden som skickades till {form.email}
          </p>
          <InputOTP
            maxLength={6}
            pattern={REGEXP_ONLY_DIGITS}
            value={form.otp}
            onChange={(value) => {
              form.setOtp(value);
              kick();
            }}
            autoFocus
          >
            <InputOTPGroup className="w-full justify-center">
              <InputOTPSlot index={0} className="bg-card size-12 text-lg" />
              <InputOTPSlot index={1} className="bg-card size-12 text-lg" />
              <InputOTPSlot index={2} className="bg-card size-12 text-lg" />
              <InputOTPSlot index={3} className="bg-card size-12 text-lg" />
              <InputOTPSlot index={4} className="bg-card size-12 text-lg" />
              <InputOTPSlot index={5} className="bg-card size-12 text-lg" />
            </InputOTPGroup>
          </InputOTP>
          <Button
            type="submit"
            disabled={form.loading}
            className="h-12 touch-manipulation rounded-2xl px-6 text-lg font-semibold transition-transform active:scale-95"
          >
            {form.loading ? "Verifierar..." : "Logga in"}
          </Button>
          <Button
            type="button"
            variant="link"
            onClick={handleResend}
            disabled={!form.canResend || form.loading}
            className="text-muted-foreground text-sm"
          >
            {form.canResend ? "Skicka ny kod" : "Skicka ny kod (vänta...)"}
          </Button>
        </form>
      )}
    </div>
  );
}
