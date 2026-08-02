import type { Metadata } from "next";
import TicketContent from "./TicketContent";

export const metadata: Metadata = {
  title: "Your ticket | Wodflow",
  robots: { index: false, follow: false },
};

export default async function TicketPage({ params }: { params: Promise<{ qrToken: string }> }) {
  const { qrToken } = await params;
  return <TicketContent qrToken={qrToken} />;
}
