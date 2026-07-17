"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";
import { Zap } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

function safeNextPath(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/discover";
  return raw;
}

function LoginForm() {
  const { login } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(username.trim(), password);
      router.push(safeNextPath(searchParams.get("next")));
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Login failed. Try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-[440px] bg-surface-container-lowest border border-outline-variant p-xl rounded-xl shadow-lg shadow-on-surface/5">
      <div className="mb-lg">
        <h1 className="font-display text-primary mb-xs">Welcome back</h1>
        <p className="text-on-surface-variant">
          Log in to manage your gigs and connect with local professionals in
          Ghana.
        </p>
      </div>
      <form className="space-y-lg" onSubmit={onSubmit}>
        <Input
          label="Username, Email or Phone"
          name="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="e.g. kojo@email.com"
          required
        />
        <Input
          label="Password"
          name="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={error || undefined}
          required
        />
        <Button type="submit" className="w-full" loading={loading}>
          Log in
        </Button>
      </form>
      <p className="mt-lg font-body-dense text-on-surface-variant text-center">
        New here?{" "}
        <Link
          href="/register"
          className="text-primary-container font-semibold hover:underline"
        >
          Create an account
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden bg-[#f4f6f5]">
      <header className="w-full h-20 flex items-center px-margin-mobile md:px-margin-desktop absolute top-0 z-10">
        <Link href="/" className="flex items-center gap-sm">
          <div className="w-10 h-10 bg-primary-container rounded-lg flex items-center justify-center text-primary-fixed-dim">
            <Zap className="w-5 h-5" fill="currentColor" />
          </div>
          <span className="font-page-title text-primary">
            WorkPulse <span className="font-light opacity-60">Connect</span>
          </span>
        </Link>
      </header>

      <div className="absolute -top-[20%] -right-[10%] w-[600px] h-[600px] bg-primary-fixed opacity-10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute -bottom-[10%] -left-[5%] w-[400px] h-[400px] bg-secondary-fixed opacity-10 blur-[100px] rounded-full pointer-events-none" />

      <main className="flex-grow flex items-center justify-center px-margin-mobile py-24 relative z-20">
        <Suspense fallback={<p className="text-on-surface-variant">Loading…</p>}>
          <LoginForm />
        </Suspense>
      </main>
    </div>
  );
}
