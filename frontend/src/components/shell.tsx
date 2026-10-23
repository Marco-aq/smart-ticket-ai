"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import {
  Activity,
  ArrowUpRight,
  Plus,
  Ticket,
  LogOut,
  Sparkles,
} from "lucide-react";

export function Shell({
  children,
  protect = true,
}: {
  children: React.ReactNode;
  protect?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    api<{ username: string }>("/auth/me", { signal: controller.signal })
      .then((data) => {
        setUser(data.username);
        setError("");
        setChecked(true);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        if (err instanceof ApiError && err.status === 401) {
          setUser(null);
          setChecked(true);
          if (protect) router.replace("/login");
        } else {
          setError("Could not verify the session. Please retry.");
          setChecked(true);
        }
      });
    return () => controller.abort();
  }, [protect, router, retry]);
  async function logout() {
    try {
      await api("/auth/logout", { method: "POST" });
      setUser(null);
      router.push("/login");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Logout failed. Try again.",
      );
    }
  }
  return (
    <div className="workspace">
      <aside className="sidebar">
        <Link className="brand" href="/">
          <span className="brand-icon">
            <Sparkles size={21} />
          </span>
          <span>
            Smart Ticket<span className="brand-sub">AI WORKSPACE</span>
          </span>
        </Link>
        <div className="mobile-session">
          {user ? <button className="quiet" onClick={logout}><LogOut size={15}/> Sign out</button> : <Link href="/login">Sign in →</Link>}
        </div>
        <p className="nav-label">WORKSPACE</p>
        <nav aria-label="Main navigation">
          <Link className={pathname === "/" ? "active" : ""} href="/">
            <ArrowUpRight size={18} /> Overview
          </Link>
          <Link
            className={
              pathname === "/tickets" ||
              (pathname.startsWith("/tickets/") && pathname !== "/tickets/new")
                ? "active"
                : ""
            }
            href="/tickets"
          >
            <Ticket size={18} /> My tickets
          </Link>
          <Link
            className={pathname === "/tickets/new" ? "active" : ""}
            href="/tickets/new"
          >
            <Plus size={18} /> New ticket
          </Link>
          <Link
            className={pathname === "/analytics" ? "active" : ""}
            href="/analytics"
          >
            <Activity size={18} /> Analytics
          </Link>
        </nav>
        <div className="sidebar-bottom">
          <div className="demo-note">
            <span className="dot" /> Portfolio demo
            <p>English tickets · Synthetic data only</p>
          </div>
          <Link href="/privacy">Data & privacy</Link>
          {user ? (
            <>
              <p className="username">{user}</p>
              <button className="quiet" onClick={logout}>
                <LogOut size={16} /> Sign out
              </button>
            </>
          ) : (
            <Link href="/login">Sign in →</Link>
          )}
        </div>
      </aside>
      <div className="main-column">
        <header className="topbar">
          <span>SUPPORT INTELLIGENCE</span>
          <span className="model-badge">TF-IDF + Logistic Regression</span>
        </header>
        <main className="content">
          {error && (
            <p role="alert" className="notice error">
              {error} <button onClick={() => setRetry(retry + 1)}>Retry</button>
            </p>
          )}
          {protect && (!checked || !user) ? (
            <div className="panel empty">
              {error ? "Session check unavailable." : "Checking your session…"}
            </div>
          ) : (
            children
          )}
        </main>
        <footer>
          Smart Ticket AI · Predictions support human decisions.{" "}
          <Link href="/privacy">Privacy</Link>
        </footer>
      </div>
    </div>
  );
}
