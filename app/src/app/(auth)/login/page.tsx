'use client';

import Link from 'next/link';
import { LoginForm } from '@/features/auth/login-form';

export default function LoginPage() {
  return (
    <div className="min-h-screen grid md:grid-cols-2">
      {/* Left Side - Image */}
      <div className="relative hidden md:block bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900">
        <div className="absolute inset-0 flex flex-col items-center justify-center p-12 text-white">
          <div className="max-w-md text-center space-y-6">
            <h1 className="text-5xl font-bold tracking-tight">
              AI Generative
            </h1>
            <h2 className="text-4xl font-light">
              Anything you can imagine
            </h2>
            <p className="text-lg text-blue-200">
              Generate anytype of art with Opanartistic
            </p>
          </div>
        </div>
        <div className="absolute inset-0 bg-black/20"></div>
      </div>

      {/* Right Side - Login Form */}
      <div className="flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md space-y-8">
          <div className="space-y-2 text-center">
            <p className="text-sm text-muted-foreground">Login your account</p>
            <h1 className="text-4xl font-bold">Welcome Back!</h1>
            <p className="text-muted-foreground">
              Enter your email and password
            </p>
          </div>

          <div className="space-y-6">
            <LoginForm />

            <div className="text-center space-y-4">
              <Link
                href="/forgot-password"
                className="text-sm text-primary hover:underline"
              >
                Forgot Password?
              </Link>

              <div className="text-sm text-muted-foreground">
                Don't have an account?{' '}
                <Link href="/register" className="text-primary hover:underline font-medium">
                  Sign up
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
