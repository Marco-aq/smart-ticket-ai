"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, ApiError, type Prediction, type Ticket } from "@/lib/api";
import { ArrowRight, Sparkles } from "lucide-react";

export function TicketForm({ save = false }: { save?: boolean }) {
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Prediction | null>(null);
  const router = useRouter();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setResult(null);
    try {
      if (save) {
        const ticket = await api<Ticket>("/tickets", {
          method: "POST",
          body: JSON.stringify({
            subject,
            description,
            synthetic_data_confirmed: confirmed,
          }),
        });
        router.push(`/tickets/${ticket.id}`);
      } else {
        setResult(
          await api<Prediction>("/predict", {
            method: "POST",
            body: JSON.stringify({ subject, description }),
          }),
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed.");
      if (err instanceof ApiError && err.status === 401) router.push("/login");
    } finally {
      setLoading(false);
    }
  }
  return (
    <div className="form-grid">
      <form className="panel" onSubmit={submit}>
        <div className="panel-heading">
          <Sparkles size={18} />
          <h2>{save ? "Ticket information" : "Try the classifier"}</h2>
          <span className="tag">ENGLISH</span>
        </div>
        <p className="muted">
          {save
            ? "Classify and save a fictional support request to your workspace."
            : "Classify a fictional request. This demo does not save the text."}
        </p>
        <button
          className="text-button"
          type="button"
          disabled={loading}
          onClick={() => {
            setSubject("Duplicate payment on my account");
            setDescription(
              "My credit card was charged twice for the same subscription this morning. Please investigate the duplicate transaction and help me get a refund.",
            );
            setResult(null);
          }}
        >
          Use a fictional example ↗
        </button>
        <label htmlFor="subject">Subject</label>
        <input
          id="subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          required
          minLength={3}
          maxLength={200}
          placeholder="A short summary of the issue"
          disabled={loading}
        />
        <label htmlFor="description">
          Description <span className="muted">{description.length}/5000</span>
        </label>
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
          minLength={10}
          maxLength={5000}
          rows={7}
          placeholder="Describe what happened, the impact, and what you have tried…"
          disabled={loading}
        />
        {save && (
          <label className="checkbox">
            <input
              type="checkbox"
              required
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            I confirm this is fictional data and contains no personal
            information, credentials, or confidential content.
          </label>
        )}
        {error && (
          <p className="notice error" role="alert">
            {error}
          </p>
        )}
        <div className="form-actions">
          <span className="muted">
            {save ? "Saved to your account only" : "No account needed"}
          </span>
          <button className="primary" disabled={loading}>
            {loading
              ? "Analyzing…"
              : save
                ? "Classify & save"
                : "Classify ticket"}
            <ArrowRight size={16} />
          </button>
        </div>
      </form>
      <aside className="panel result-panel" aria-live="polite">
        <p className="eyebrow">CLASSIFICATION</p>
        <h2>{result ? "Analysis complete" : "From text to action"}</h2>
        {result ? (
          <>
            <div className="result-item">
              <p>Category</p>
              <h3>{result.category}</h3>
              <span>
                Model score: {(result.category_score * 100).toFixed(1)}%
              </span>
            </div>
            <div className="result-item">
              <p>Priority</p>
              <h3>{result.priority}</h3>
              <span>
                Model score: {(result.priority_score * 100).toFixed(1)}%
              </span>
            </div>
            {result.needs_review && (
              <p className="notice">Manual review recommended.</p>
            )}
          </>
        ) : (
          <>
            <p className="muted">
              Two text classifiers suggest a department and a priority for each
              support request.
            </p>
            <ol className="steps">
              <li>Describe the issue in English</li>
              <li>Get category and priority scores</li>
              <li>Review the suggestion before acting</li>
            </ol>
          </>
        )}
        <p className="fine-print">
          Scores are not calibrated probabilities. Trained on synthetic data;
          performance on real requests may differ.{" "}
          <Link href="/privacy">Data policy →</Link>
        </p>
      </aside>
    </div>
  );
}
