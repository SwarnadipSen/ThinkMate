"use client";

import Link from "next/link";
import { LoginForm } from "@/features/auth/login-form";

export default function LoginPage() {
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
              AI-powered learning,
              <br />
              designed to focus.
            </h1>
          </div>

          <div className="mx-auto w-full max-w-xl rounded-3xl border border-white/25 bg-white/10 p-6 backdrop-blur-md">
            <svg
              viewBox="0 0 640 400"
              role="img"
              aria-label="ThinkMate AI learning illustration"
              className="h-auto w-full"
            >
              <defs>
                <linearGradient id="tm-line" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#67e8f9" />
                  <stop offset="100%" stopColor="#c4b5fd" />
                </linearGradient>
                <linearGradient id="tm-card" x1="0" y1="0" x2="0" y2="1">
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

              <circle cx="138" cy="110" r="64" fill="rgba(103,232,249,0.12)" />
              <circle cx="510" cy="300" r="76" fill="rgba(196,181,253,0.14)" />

              <path
                d="M95 265 C170 165, 255 350, 335 245 S485 175, 560 235"
                stroke="url(#tm-line)"
                strokeWidth="6"
                fill="none"
                strokeLinecap="round"
              />
              <path
                d="M90 290 C175 205, 260 365, 340 275 S485 210, 565 255"
                stroke="rgba(255,255,255,0.22)"
                strokeWidth="3"
                fill="none"
                strokeLinecap="round"
              />

              <rect
                x="96"
                y="86"
                width="160"
                height="92"
                rx="16"
                fill="url(#tm-card)"
                stroke="rgba(255,255,255,0.28)"
              />
              <rect
                x="110"
                y="108"
                width="82"
                height="10"
                rx="5"
                fill="rgba(255,255,255,0.8)"
              />
              <rect
                x="110"
                y="126"
                width="58"
                height="8"
                rx="4"
                fill="rgba(255,255,255,0.45)"
              />
              <circle cx="226" cy="130" r="17" fill="rgba(103,232,249,0.9)" />

              <rect
                x="368"
                y="192"
                width="178"
                height="108"
                rx="18"
                fill="url(#tm-card)"
                stroke="rgba(255,255,255,0.28)"
              />
              <rect
                x="386"
                y="220"
                width="120"
                height="10"
                rx="5"
                fill="rgba(255,255,255,0.75)"
              />
              <rect
                x="386"
                y="239"
                width="84"
                height="8"
                rx="4"
                fill="rgba(255,255,255,0.42)"
              />
              <rect
                x="386"
                y="258"
                width="68"
                height="8"
                rx="4"
                fill="rgba(255,255,255,0.3)"
              />
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
            <h1 className="text-3xl font-bold sm:text-4xl">Welcome back</h1>
            <p className="text-muted-foreground">
              Sign in to continue your ThinkMate journey.
            </p>
          </div>

          <div className="mt-8 space-y-6">
            <LoginForm />

            <div className="text-center text-sm text-muted-foreground">
              <p>
                Don't have an account?{" "}
                <Link
                  href="/register"
                  className="font-medium text-primary hover:underline"
                >
                  Sign up
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
