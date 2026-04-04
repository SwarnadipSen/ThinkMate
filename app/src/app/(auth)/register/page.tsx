'use client';

import Link from 'next/link';
import { RegisterForm } from '@/features/auth/register-form';

export default function RegisterPage() {
  return (
    <div className="min-h-screen grid md:grid-cols-2">
      {/* Left Side - Image */}
      <div className="relative hidden md:block bg-gradient-to-br from-purple-900 via-purple-800 to-indigo-900">
        <div className="absolute inset-0 flex flex-col items-center justify-center p-12 text-white">
          <div className="max-w-md text-center space-y-6">
            <h1 className="text-5xl font-bold tracking-tight">
              Join Us Today
            </h1>
            <h2 className="text-4xl font-light">
              Start Your Learning Journey
            </h2>
            <p className="text-lg text-purple-200">
              Experience personalized learning with ThinkMate AI
            </p>
          </div>
        </div>
        <div className="absolute inset-0 bg-black/20"></div>
      </div>

      {/* Right Side - Register Form */}
      <div className="flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md space-y-8">
          <div className="space-y-2 text-center">
            <p className="text-sm text-muted-foreground">Create your account</p>
            <h1 className="text-4xl font-bold">Get Started!</h1>
            <p className="text-muted-foreground">
              Fill in your details to create an account
            </p>
          </div>

          <div className="space-y-6">
            <RegisterForm />

            <div className="text-center text-sm text-muted-foreground">
              Already have an account?{' '}
              <Link href="/login" className="text-primary hover:underline font-medium">
                Sign in
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
