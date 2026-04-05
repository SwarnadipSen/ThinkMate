"use client";

import Link from "next/link";
import { RegisterForm } from "@/features/auth/register-form";

export default function RegisterPage() {
  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="relative hidden lg:block overflow-hidden bg-linear-to-br from-slate-950 via-indigo-900 to-cyan-800">
        <div className="absolute -top-24 -left-14 h-72 w-72 rounded-full bg-cyan-400/20 blur-3xl" />
        <div className="absolute -bottom-20 right-0 h-64 w-64 rounded-full bg-indigo-300/25 blur-3xl" />

        <div className="relative z-10 flex h-full flex-col justify-between p-12 text-white">
          <div className="space-y-4">
            <p className="inline-flex w-fit rounded-full border border-white/30 bg-white/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-100">
              ThinkMate
            </p>
            <h1 className="max-w-lg text-4xl font-bold leading-tight xl:text-5xl">
              Create your account,
              <br />
              start learning faster.
            </h1>
          </div>

          <div className="mx-auto w-full max-w-xl rounded-3xl border border-white/25 bg-white/10 p-6 backdrop-blur-md">
            <svg
              viewBox="0 0 640 400"
              role="img"
              aria-label="ThinkMate account setup illustration"
              className="h-auto w-full"
            >
              <defs>
                <linearGradient id="tm-signup-line" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#67e8f9" />
                  <stop offset="100%" stopColor="#c4b5fd" />
                </linearGradient>
                <linearGradient id="tm-signup-card" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgba(255,255,255,0.35)" />
                  <stop offset="100%" stopColor="rgba(255,255,255,0.08)" />
                </linearGradient>
              </defs>

              <rect
                x="20"
                y="20"
                width="600"
                height="360"
                rx="28"
                fill="rgba(2,6,23,0.35)"
                stroke="rgba(255,255,255,0.18)"
              />

              <path
                d="M88 130 C155 90, 230 95, 305 148 S470 235, 552 190"
                stroke="rgba(255,255,255,0.2)"
                strokeWidth="4"
                fill="none"
                strokeLinecap="round"
              />
              <path
                d="M90 300 C165 225, 255 332, 340 252 S495 170, 560 225"
                stroke="url(#tm-signup-line)"
                strokeWidth="6"
                fill="none"
                strokeLinecap="round"
              />

              <rect
                x="90"
                y="86"
                width="184"
                height="116"
                rx="18"
                fill="url(#tm-signup-card)"
                stroke="rgba(255,255,255,0.28)"
              />
              <circle cx="126" cy="123" r="14" fill="rgba(103,232,249,0.92)" />
              <rect
                x="150"
                y="114"
                width="92"
                height="10"
                rx="5"
                fill="rgba(255,255,255,0.8)"
              />
              <rect
                x="150"
                y="133"
                width="68"
                height="8"
                rx="4"
                fill="rgba(255,255,255,0.45)"
              />
              <rect
                x="108"
                y="161"
                width="148"
                height="8"
                rx="4"
                fill="rgba(255,255,255,0.3)"
              />

              <rect
                x="350"
                y="190"
                width="196"
                height="124"
                rx="20"
                fill="url(#tm-signup-card)"
                stroke="rgba(255,255,255,0.28)"
              />
              <rect
                x="372"
                y="218"
                width="102"
                height="9"
                rx="4"
                fill="rgba(255,255,255,0.8)"
              />
              <rect
                x="372"
                y="235"
                width="142"
                height="9"
                rx="4"
                fill="rgba(255,255,255,0.5)"
              />
              <rect
                x="372"
                y="252"
                width="126"
                height="9"
                rx="4"
                fill="rgba(255,255,255,0.34)"
              />

              <circle cx="520" cy="110" r="40" fill="rgba(196,181,253,0.2)" />
            </svg>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center bg-background p-6 sm:p-8">
        <div className="w-full max-w-md rounded-2xl border border-border/70 bg-card p-8 shadow-xl shadow-black/5 sm:p-10">
          <div className="space-y-2 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Student and Teacher Portal
            </p>
            <h1 className="text-3xl font-bold sm:text-4xl">Create account</h1>
            <p className="text-muted-foreground">
              Join ThinkMate and set up your learning workspace.
            </p>
          </div>

          <div className="mt-8 space-y-6">
            <RegisterForm />

            <div className="text-center text-sm text-muted-foreground">
              <p>
                Already have an account?{" "}
                <Link
                  href="/login"
                  className="font-medium text-primary hover:underline"
                >
                  Sign in
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
