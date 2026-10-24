import { Shell } from "@/components/shell";
import { TicketDetail } from "@/components/ticket-detail";
export default async function Detail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <Shell>
      <TicketDetail id={id} />
    </Shell>
  );
}
