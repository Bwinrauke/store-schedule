"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function safeNext(next?: string) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

export function LoginForm({ next }: { next?: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<"password" | "link">("link");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createClient();

    if (mode === "password") {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) {
        setError(error.message);
        setBusy(false);
        return;
      }
      router.push(safeNext(next));
      router.refresh();
      return;
    }

    const redirectTo = new URL("/auth/callback", window.location.origin);
    redirectTo.searchParams.set("next", safeNext(next));
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      // Only people an executive has invited can sign in.
      options: { emailRedirectTo: redirectTo.toString(), shouldCreateUser: false },
    });
    setBusy(false);
    if (error) setError(error.message);
    else setSent(true);
  }

  if (sent) {
    return (
      <div className="card p-6 text-center">
        <p className="font-medium">Check your email</p>
        <p className="mt-2 text-sm text-gray-500">
          We sent a sign-in link to <b>{email}</b>.
        </p>
        <button className="mt-4 text-sm text-brand-600 hover:underline" onClick={() => setSent(false)}>
          Back
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="card space-y-4 p-6">
      <div>
        <label className="label" htmlFor="email">Work email</label>
        <input id="email" type="email" required autoComplete="email" className="input"
          value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      {mode === "password" && (
        <div>
          <label className="label" htmlFor="password">Password</label>
          <input id="password" type="password" required autoComplete="current-password" className="input"
            value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button type="submit" className="btn btn-primary w-full" disabled={busy}>
        {busy ? "Working…" : mode === "password" ? "Sign in" : "Email me a sign-in link"}
      </button>
      <button type="button" className="w-full text-center text-sm text-gray-500 hover:text-gray-800"
        onClick={() => setMode(mode === "password" ? "link" : "password")}>
        {mode === "password" ? "Use an email link instead" : "Use a password instead"}
      </button>
    </form>
  );
}
