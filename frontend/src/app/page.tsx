
"use client";

import { FormEvent, useState } from "react";

type Prediction = {
  category: string;
  category_score: number;
  priority: string;
  priority_score: number;
  needs_review: boolean;
};

export default function Home() {
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [result, setResult] = useState<Prediction | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;

      if (!apiUrl) {
        throw new Error("API URL is not configured");
      }

      const response = await fetch(`${apiUrl}/predict`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          subject,
          description,
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data: Prediction = await response.json();
      setResult(data);
    } catch {
      setError(
        "Could not classify the ticket. Check the API connection."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-12 text-white">
      <div className="mx-auto max-w-3xl space-y-8">
        <header>
          <p className="text-sm font-semibold text-teal-400">
            AI-POWERED SUPPORT
          </p>
          <h1 className="mt-2 text-4xl font-bold">
            Smart Ticket AI
          </h1>
          <p className="mt-3 text-slate-400">
            Classify support requests automatically
            using machine learning.
          </p>
        </header>

        <form
          onSubmit={handleSubmit}
          className="space-y-5 rounded-xl border border-slate-800 bg-slate-900 p-6"
        >
          <div className="space-y-2">
            <label htmlFor="subject" className="block text-sm">
              Ticket subject
            </label>
            <input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              minLength={3}
              maxLength={200}
              required
              className="w-full rounded-md border border-slate-700 bg-slate-950 p-3"
              placeholder="Unable to access my account"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="description" className="block text-sm">
              Description
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              minLength={10}
              maxLength={5000}
              rows={5}
              required
              className="w-full rounded-md border border-slate-700 bg-slate-950 p-3"
              placeholder="Describe your issue..."
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-teal-500 px-5 py-3 font-semibold text-slate-950 disabled:opacity-50"
          >
            {loading ? "Analyzing..." : "Classify ticket"}
          </button>

          {error && <p role="alert" className="text-red-400">{error}</p>}
        </form>

        {result && (
          <section className="space-y-4 rounded-xl border border-teal-800 bg-slate-900 p-6">
            <h2 className="text-2xl font-bold">
              Classification result
            </h2>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-sm text-slate-400">Category</p>
                <p className="text-lg font-semibold">
                  {result.category}
                </p>
                <p className="text-sm text-teal-400">
                  Score: {(result.category_score * 100).toFixed(1)}%
                </p>
              </div>

              <div>
                <p className="text-sm text-slate-400">Priority</p>
                <p className="text-lg font-semibold">
                  {result.priority}
                </p>
                <p className="text-sm text-teal-400">
                  Score: {(result.priority_score * 100).toFixed(1)}%
                </p>
              </div>
            </div>

            {result.needs_review && (
              <p className="rounded-md bg-amber-950 p-3 text-amber-300">
                Manual review recommended.
              </p>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
