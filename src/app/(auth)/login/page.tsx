"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LoginForm } from "./use-login-form";
import { createClient } from "@/lib/supabase/client";

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
    <div className='w-full max-w-sm'>
      <h1 className='text-2xl font-bold text-foreground mb-8 text-center'>
        Movemonitor
      </h1>

      {form.error && (
        <div className='mb-4 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive'>
          {form.error}
        </div>
      )}

      {form.phase === "email" ? (
        <form onSubmit={handleEmailSubmit} className='flex flex-col gap-4'>
          <label
            htmlFor='email'
            className='text-sm font-medium text-foreground'
          >
            E-post
          </label>
          <input
            id='email'
            type='email'
            required
            autoFocus
            value={form.email}
            onChange={(e) => {
              form.setEmail(e.target.value);
              kick();
            }}
            placeholder='din@email.se'
            className='rounded-lg border border-input bg-card px-4 py-3 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring'
          />
          <button
            type='submit'
            disabled={form.loading}
            className='rounded-2xl bg-primary px-6 py-4 text-lg font-semibold text-primary-foreground touch-manipulation active:scale-95 transition-transform disabled:opacity-50'
          >
            {form.loading ? "Skickar..." : "Skicka kod"}
          </button>
        </form>
      ) : (
        <form onSubmit={handleOtpSubmit} className='flex flex-col gap-4'>
          <p className='text-sm text-muted-foreground text-center'>
            Ange koden som skickades till {form.email}
          </p>
          <input
            type='text'
            inputMode='numeric'
            pattern='[0-9]*'
            maxLength={6}
            required
            autoFocus
            value={form.otp}
            onChange={(e) => {
              form.setOtp(e.target.value);
              kick();
            }}
            placeholder='000000'
            className='rounded-lg border border-input bg-card px-4 py-3 text-center text-2xl tracking-widest text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring'
          />
          <button
            type='submit'
            disabled={form.loading}
            className='rounded-2xl bg-primary px-6 py-4 text-lg font-semibold text-primary-foreground touch-manipulation active:scale-95 transition-transform disabled:opacity-50'
          >
            {form.loading ? "Verifierar..." : "Logga in"}
          </button>
          <button
            type='button'
            onClick={handleResend}
            disabled={!form.canResend || form.loading}
            className='text-sm text-muted-foreground disabled:opacity-50'
          >
            {form.canResend ? "Skicka ny kod" : "Skicka ny kod (vänta...)"}
          </button>
        </form>
      )}
    </div>
  );
}
