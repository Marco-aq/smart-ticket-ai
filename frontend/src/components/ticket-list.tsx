'use client';
import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Plus, ChevronLeft, ChevronRight, Ticket as TicketIcon } from 'lucide-react';
import { api, ApiError, dateLabel, statusLabels, type Ticket } from '@/lib/api';

type Listing = { items: Ticket[]; total: number; page: number; page_size: number; priorities: string[] };
export function TicketList() {
  const [draft, setDraft] = useState('');
  const [filters, setFilters] = useState({ q: '', priority: '', status: '', page: 1 });
  const [data, setData] = useState<Listing | null>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const router = useRouter();
  useEffect(() => {
    const controller = new AbortController();
    const query = new URLSearchParams({ page: String(filters.page), page_size: '10' });
    for (const key of ['q', 'priority', 'status'] as const) if (filters[key]) query.set(key, filters[key]);
    async function load() {
      setData(null); setError('');
      try { setData(await api<Listing>(`/tickets?${query}`, { signal: controller.signal })); }
      catch (err) {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : 'Could not load tickets.');
        if (err instanceof ApiError && err.status === 401) router.replace('/login');
      }
    }
    void load();
    return () => controller.abort();
  }, [filters, retry, router]);
  function search(event: FormEvent) { event.preventDefault(); setFilters({ ...filters, q: draft.trim(), page: 1 }); }
  return <><div className="page-heading heading-row"><div><p className="eyebrow">YOUR SUPPORT QUEUE</p><h1>My tickets</h1><p className="muted">Review predictions and move requests toward resolution.</p></div><Link href="/tickets/new" className="primary"><Plus size={17}/> New ticket</Link></div>
    <div className="panel table-panel"><form className="toolbar" onSubmit={search}>
      <div className="search-box"><Search size={18}/><input aria-label="Search ticket subjects" maxLength={200} placeholder="Search subjects…" value={draft} onChange={e => setDraft(e.target.value)}/></div><button className="secondary" type="submit">Search</button>
      <select aria-label="Filter by priority" value={filters.priority} onChange={e => setFilters({ ...filters, priority: e.target.value, page: 1 })}><option value="">All priorities</option>{Array.from(new Set([...(data?.priorities || []), ...(filters.priority ? [filters.priority] : [])])).map(p => <option key={p}>{p}</option>)}</select>
      <select aria-label="Filter by status" value={filters.status} onChange={e => setFilters({ ...filters, status: e.target.value, page: 1 })}><option value="">All statuses</option>{Object.entries(statusLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select>
      {(filters.q || filters.status || filters.priority) && <button type="button" className="text-button" onClick={() => { setDraft(''); setFilters({ q: '', priority: '', status: '', page: 1 }); }}>Clear</button>}
    </form>
    {error ? <div className="empty"><p role="alert">{error}</p><button className="secondary" onClick={() => setRetry(retry + 1)}>Retry</button></div> : !data ? <div className="empty" role="status">Loading tickets…</div> : <>
      <div className="table-scroll"><table><thead><tr><th>Subject</th><th>Category</th><th>Priority</th><th>Status</th><th>Created</th></tr></thead><tbody>{data.items.map(ticket => <tr key={ticket.id}><td><Link className="ticket-subject" href={`/tickets/${ticket.id}`}>{ticket.subject}</Link><div className="ticket-id">#{ticket.id.slice(0, 8)} {ticket.needs_review && <span className="review-text">· Review suggested</span>}</div></td><td>{ticket.predicted_category}</td><td><span className="badge priority">{ticket.predicted_priority}</span></td><td><span className={`badge ${ticket.status}`}>{statusLabels[ticket.status]}</span></td><td className="date-cell">{dateLabel(ticket.created_at)}</td></tr>)}</tbody></table></div>
      {data.items.length === 0 && <div className="empty"><TicketIcon size={30}/><h2>{data.total ? 'No tickets on this page' : 'No tickets found'}</h2><p className="muted">Create a fictional ticket or adjust your filters.</p><Link href="/tickets/new" className="text-button">Create a ticket →</Link></div>}
      <div className="pagination"><span>{data.total === 0 ? '0' : `${(data.page - 1) * data.page_size + 1}–${Math.min(data.page * data.page_size, data.total)}`} of {data.total} tickets</span><div><button aria-label="Previous page" className="secondary" disabled={data.page <= 1} onClick={() => setFilters({ ...filters, page: filters.page - 1 })}><ChevronLeft size={16}/></button><span>Page {data.page} / {Math.max(1, Math.ceil(data.total / data.page_size))}</span><button aria-label="Next page" className="secondary" disabled={data.page * data.page_size >= data.total} onClick={() => setFilters({ ...filters, page: filters.page + 1 })}><ChevronRight size={16}/></button></div></div>
    </>}</div></>;
}
