"use server";

import { requirePrivileged } from "@/lib/auth";

type TicketRow = {
  id: string;
  ticket_type: "spectator";
  buyer_name: string;
  quantity: number;
  checked_in_count: number;
  payment_status: "pending" | "paid" | "refunded";
};

export async function lookupTicket(
  eventId: string,
  scannedValue: string
): Promise<{ ticket: TicketRow } | { error: string }> {
  const { supabase } = await requirePrivileged();

  // A scan may yield the raw qr_token or (if someone photographs a
  // printed ticket page URL instead of the code itself) a full URL —
  // accept either by taking the last non-empty path segment.
  const trimmed = scannedValue.trim();
  const token = trimmed.split("/").filter(Boolean).pop() ?? trimmed;
  if (!token) return { error: "Empty scan." };

  const { data, error } = await supabase
    .from("event_tickets")
    .select("id, ticket_type, buyer_name, quantity, checked_in_count, payment_status")
    .eq("qr_token", token)
    .eq("event_id", eventId)
    .maybeSingle();

  if (error) {
    console.error("Ticket lookup failed", error);
    return { error: "Lookup failed." };
  }
  if (!data) return { error: "No matching ticket for this event." };
  if (data.payment_status !== "paid") return { error: "This ticket hasn't been paid for." };

  return { ticket: data as TicketRow };
}

export async function confirmCheckin(
  ticketId: string
): Promise<{ checkedInCount: number; quantity: number } | { error: string }> {
  const { supabase } = await requirePrivileged();

  // Single atomic RPC (migration-044) — increments checked_in_count
  // only if there's still room, in one statement, so two staff
  // confirming the same ticket within the same second can't both
  // succeed and push the count past quantity.
  const { data, error } = await supabase.rpc("check_in_ticket", { p_ticket_id: ticketId }).single();

  if (error || !data) {
    console.error("Check-in failed", error);
    return { error: "Check-in failed." };
  }

  const row = data as { checked_in_count: number; quantity: number; already_full: boolean };
  if (row.already_full) {
    return { error: `Already fully used — ${row.quantity}/${row.quantity} checked in.` };
  }
  return { checkedInCount: row.checked_in_count, quantity: row.quantity };
}
