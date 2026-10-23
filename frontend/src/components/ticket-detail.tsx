'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, ApiError, dateLabel, statusLabels, type Ticket } from '@/lib/api';
export function TicketDetail({ id }: { id: string }) {
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [retry, setRetry] = useState(0);
  const router = useRouter();
  useEffect(() => {
    const controller = new AbortController();
    api<Ticket>(`/tickets/${id}`, { signal: controller.signal }).then(setTicket).catch(err => {
      if (controller.signal.aborted) return;
      setError(err instanceof Error ? err.message : 'Could not load ticket.');
      if (err instanceof ApiError && err.status === 401) router.replace('/login');
    });
    return () => controller.abort();
  }, [id, retry, router]);
  async function change(status: string) {
    setBusy(true); setError('');
    try { setTicket(await api<Ticket>(`/tickets/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) })); }
    catch (err) { setError(err instanceof Error ? err.message : 'Update failed.'); }
    finally { setBusy(false); }
  }
  async function remove() {
    setBusy(true); setError('');
    try { await api(`/tickets/${id}`, { method: 'DELETE' }); router.push('/tickets'); }
    catch (err) { setError(err instanceof Error ? err.message : 'Delete failed.'); setBusy(false); }
  }
  return <><Link className="text-button" href="/tickets">← Back to tickets</Link>
    {error && <div role="alert" className="notice error">{error} <button onClick={() => { setError(''); setRetry(retry + 1); }}>Retry</button></div>}
    {!ticket ? <div className="panel empty">{error ? 'Ticket unavailable.' : 'Loading ticket…'}</div> : <>
      <div className="page-heading"><p className="eyebrow">TICKET #{ticket.id.slice(0, 8)}</p><h1 className="detail-title">{ticket.subject}</h1><p className="muted">Created {dateLabel(ticket.created_at)}</p></div>
      <div className="form-grid"><section className="panel"><h2>Description</h2><p className="ticket-body">{ticket.description}</p><hr/><label htmlFor="ticket-status">Status</label><select id="ticket-status" value={ticket.status} disabled={busy} onChange={e => change(e.target.value)}>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><p className="fine-print">Status changes are saved immediately.</p>
      <div className="delete-area">{confirmDelete ? <><p>Delete this ticket permanently?</p><button className="danger" disabled={busy} onClick={remove}>Yes, delete</button><button className="secondary" disabled={busy} onClick={() => setConfirmDelete(false)}>Cancel</button></> : <button className="text-button danger-text" onClick={() => setConfirmDelete(true)}>Delete ticket</button>}</div></section>
      <aside className="panel result-panel"><p className="eyebrow">MODEL SUGGESTION</p><h2>Classification</h2><div className="result-item"><p>Category</p><h3>{ticket.predicted_category}</h3><span>Model score: {(ticket.category_score * 100).toFixed(1)}%</span></div><div className="result-item"><p>Priority</p><h3>{ticket.predicted_priority}</h3><span>Model score: {(ticket.priority_score * 100).toFixed(1)}%</span></div>{ticket.needs_review && <p className="notice">Manual review recommended. At least one score is below 60%.</p>}<p className="fine-print">Scores are not calibrated probabilities. Use human judgment for critical incidents.</p></aside></div>
    </>}
  </>;
}
