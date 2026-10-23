"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, ApiError, statusLabels } from "@/lib/api";
type Group = { label: string; count: number };
type Stats = {
  total: number;
  needs_review: number;
  review_rate: number;
  categories: Group[];
  priorities: Group[];
  statuses: Group[];
};
function Breakdown({
  title,
  rows,
  total,
}: {
  title: string;
  rows: Group[];
  total: number;
}) {
  return (
    <section className="panel">
      <h2>{title}</h2>
      {!rows.length ? (
        <p className="muted">No data yet.</p>
      ) : (
        <ul className="breakdown">
          {[...rows]
            .sort((a, b) => b.count - a.count)
            .map((row) => (
              <li key={row.label}>
                <div>
                  <span>{row.label}</span>
                  <strong>
                    {row.count}{" "}
                    <small>({Math.round((row.count / total) * 100)}%)</small>
                  </strong>
                </div>
                <progress
                  max={total}
                  value={row.count}
                  aria-label={`${row.label}: ${row.count} tickets`}
                />
              </li>
            ))}
        </ul>
      )}
    </section>
  );
}
export function Analytics() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const router = useRouter();
  useEffect(() => {
    const controller = new AbortController();
    api<Stats>("/analytics", { signal: controller.signal })
      .then((data) => {
        setStats(data);
        setError("");
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setError(
          err instanceof Error ? err.message : "Could not load analytics.",
        );
        if (err instanceof ApiError && err.status === 401)
          router.replace("/login");
      });
    return () => controller.abort();
  }, [retry, router]);
  return (
    <>
      <div className="page-heading">
        <p className="eyebrow">A CLEARER VIEW OF YOUR QUEUE</p>
        <h1>Workspace analytics</h1>
        <p className="muted">
          Statistics from your saved demo tickets, across all pages.
        </p>
      </div>
      {error ? (
        <div role="alert" className="notice error">
          {error} <button onClick={() => setRetry(retry + 1)}>Retry</button>
        </div>
      ) : !stats ? (
        <div className="panel empty">Loading analytics…</div>
      ) : (
        <>
          <div className="stat-grid">
            <div className="panel stat">
              <span>Total tickets</span>
              <strong>{stats.total}</strong>
              <small>In your workspace</small>
            </div>
            <div className="panel stat">
              <span>Review suggested</span>
              <strong>{stats.needs_review}</strong>
              <small>At least one score below 60%</small>
            </div>
            <div className="panel stat">
              <span>Review rate</span>
              <strong>{(stats.review_rate * 100).toFixed(1)}%</strong>
              <small>Of all saved tickets</small>
            </div>
          </div>
          {!stats.total && (
            <p className="notice">
              Your workspace is empty.{" "}
              <Link href="/tickets/new">Create a fictional ticket →</Link>
            </p>
          )}
          <div className="analytics-grid">
            <Breakdown
              title="By category"
              rows={stats.categories}
              total={stats.total}
            />
            <Breakdown
              title="By priority"
              rows={stats.priorities}
              total={stats.total}
            />
            <Breakdown
              title="By status"
              rows={stats.statuses.map((s) => ({
                ...s,
                label:
                  statusLabels[s.label as keyof typeof statusLabels] || s.label,
              }))}
              total={stats.total}
            />
          </div>
          <p className="fine-print">
            These figures describe the demo queue. They do not measure model
            accuracy or a real company’s performance.
          </p>
        </>
      )}
    </>
  );
}
