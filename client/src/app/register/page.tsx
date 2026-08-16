"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { Zap } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

type AccountType = "customer" | "worker" | "employer";

export default function RegisterPage() {
  const { register, login } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
    country: "Ghana",
    address: "",
    phone: "",
    accountType: "customer" as AccountType,
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { accountType, ...rest } = form;
      await register({
        ...rest,
        phone: form.phone.trim(),
        isSeller: accountType === "worker",
        isEmployer: accountType === "employer",
      });
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Registration failed."
      );
      return;
    } finally {
      setLoading(false);
    }

    setLoading(true);
    try {
      await login(form.email || form.username, form.password);
      router.push("/discover");
    } catch (err) {
      setError(
        err instanceof ApiError
          ? `Account created, but sign-in failed: ${err.message}. Try logging in.`
          : "Account created, but sign-in failed. Please log in manually."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden bg-[#f4f6f5]">
      <header className="w-full h-20 flex items-center px-margin-mobile md:px-margin-desktop relative z-10">
        <Link href="/" className="flex items-center gap-sm">
          <div className="w-10 h-10 bg-primary-container rounded-lg flex items-center justify-center text-primary-fixed-dim">
            <Zap className="w-5 h-5" fill="currentColor" />
          </div>
          <span className="font-page-title text-primary">WorkPulse Connect</span>
        </Link>
      </header>

      <main className="flex-grow flex items-start justify-center px-margin-mobile py-lg relative z-20">
        <div className="w-full max-w-[520px] bg-surface-container-lowest border border-outline-variant p-xl rounded-xl shadow-lg shadow-on-surface/5 mb-xl">
          <div className="mb-lg">
            <h1 className="font-display text-primary mb-xs">Join WorkPulse</h1>
            <p className="text-on-surface-variant">
              Create an account to hire workers or offer your skills across
              Ghana.
            </p>
          </div>
          <form className="space-y-md" onSubmit={onSubmit}>
            <Input
              label="Username"
              value={form.username}
              onChange={(e) => set("username", e.target.value)}
              required
            />
            <Input
              label="Email"
              type="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              required
            />
            <Input
              label="Password"
              type="password"
              value={form.password}
              onChange={(e) => set("password", e.target.value)}
              required
            />
            <Input
              label="Phone"
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
              placeholder="0557894646 or +233…"
              hint="Ghana local 0XXXXXXXXX is normalized to +233"
              required
            />
            <Input
              label="Address"
              value={form.address}
              onChange={(e) => set("address", e.target.value)}
              required
            />
            <Input
              label="Country"
              value={form.country}
              onChange={(e) => set("country", e.target.value)}
              required
            />
            <fieldset className="flex flex-col gap-sm pt-sm border-0 p-0 m-0">
              <legend className="font-body-dense font-semibold text-on-surface mb-xs">
                Account type
              </legend>
              <label className="flex items-center gap-sm font-body-dense cursor-pointer">
                <input
                  type="radio"
                  name="accountType"
                  value="customer"
                  checked={form.accountType === "customer"}
                  onChange={() => set("accountType", "customer")}
                  className="border-outline-variant"
                />
                Customer — browse and hire workers
              </label>
              <label className="flex items-center gap-sm font-body-dense cursor-pointer">
                <input
                  type="radio"
                  name="accountType"
                  value="worker"
                  checked={form.accountType === "worker"}
                  onChange={() => set("accountType", "worker")}
                  className="border-outline-variant"
                />
                Worker — offer services and take gigs
              </label>
              <label className="flex items-center gap-sm font-body-dense cursor-pointer">
                <input
                  type="radio"
                  name="accountType"
                  value="employer"
                  checked={form.accountType === "employer"}
                  onChange={() => set("accountType", "employer")}
                  className="border-outline-variant"
                />
                Employer — post jobs and hire talent
              </label>
            </fieldset>
            {error ? (
              <p className="font-body-dense text-error">{error}</p>
            ) : null}
            <Button type="submit" className="w-full" loading={loading}>
              Create account
            </Button>
          </form>
          <p className="mt-lg font-body-dense text-center text-on-surface-variant">
            Already have an account?{" "}
            <Link href="/login" className="text-primary-container font-semibold">
              Log in
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
