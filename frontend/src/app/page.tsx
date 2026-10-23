import Link from 'next/link';
import { Shell } from '@/components/shell';
import { TicketForm } from '@/components/ticket-form';
import { ArrowUpRight, Layers, ShieldCheck, Workflow } from 'lucide-react';
export default function Home() {
  return <Shell protect={false}><section className="hero"><div><p className="eyebrow">SMARTER SUPPORT, ONE TICKET AT A TIME</p><h1>Less sorting.<br/><span>More solving.</span></h1><p className="hero-copy">Turn support requests into organized work. Classify tickets, review predictions, and track your workspace with machine learning.</p><div className="hero-actions"><Link className="primary" href="/tickets/new">Open your workspace <ArrowUpRight size={17}/></Link><a className="secondary" href="#demo">Try a prediction</a></div></div><div className="hero-card"><span className="tag">HOW IT WORKS</span><div><Layers/><h3>Understand the request</h3><p>Subject and description become text features.</p></div><div><Workflow/><h3>Route with context</h3><p>Separate models suggest category and priority.</p></div><div><ShieldCheck/><h3>Keep people in control</h3><p>Low scores flag a ticket for manual review.</p></div></div></section><section id="demo"><div className="section-title"><div><p className="eyebrow">LIVE MODEL DEMO</p><h2>See a prediction in action</h2></div><span className="tag">No text stored</span></div><TicketForm/></section></Shell>;
}
