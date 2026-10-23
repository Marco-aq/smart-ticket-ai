import { Shell } from '@/components/shell';
import { TicketForm } from '@/components/ticket-form';
export default function NewTicket() {
  return <Shell><div className="page-heading"><p className="eyebrow">CREATE A REQUEST</p><h1>New ticket</h1><p className="muted">Give your request a category, a priority, and a place in your workspace.</p></div><TicketForm save/></Shell>;
}
