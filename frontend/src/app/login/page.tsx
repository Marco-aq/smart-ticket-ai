"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Shell } from "@/components/shell";
import { api } from "@/lib/api";
export default function Login() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      await api("/auth/login", {
        method: "POST",
        body: JSON.stringify({
          username: form.get("username"),
          password: form.get("password"),
        }),
      });
      router.push("/tickets");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed.");
    } finally {
      setLoading(false);
    }
  }
  return (
    <Shell protect={false}>
      <div className="login-wrap">
        <p className="eyebrow">YOUR SUPPORT WORKSPACE</p>
        <h1>Welcome back.</h1>
        <p className="muted">
          Sign in to manage your fictional support tickets.
        </p>
        <form className="panel" onSubmit={submit}>
          <label htmlFor="username">Username</label>
          <input
            id="username"
            name="username"
            required
            minLength={3}
            maxLength={80}
            autoComplete="username"
          />
          <label htmlFor="password">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            required
            maxLength={256}
            autoComplete="current-password"
          />
          {error && (
            <p role="alert" className="notice error">
              {error}
            </p>
          )}
          <button className="primary full" disabled={loading}>
            {loading ? "Signing in…" : "Sign in →"}
          </button>
        </form>
        <p className="fine-print">
          Accounts are provisioned by the demo owner. Contact them for access,
          or try the public classifier on the overview page.
        </p>
      </div>
    </Shell>
  );
}
