import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import {
  addAthleteManually,
  removeAthlete,
  resendPaymentLink,
  markPaidAndSendConfirmation,
  updateTeamName,
  moveRegistrationDivision,
} from "./actions";
import { SendPaymentLinkButton } from "@/components/SendPaymentLinkButton";
import { MarkPaidButton } from "@/components/MarkPaidButton";
import { TeamNameField } from "@/components/TeamNameField";
import { MoveDivisionField } from "@/components/MoveDivisionField";

export default async function AthletesPage({
  params,
}: {
  params: Promise<{ eventId: string; divisionId: string }>;
}) {
  const { eventId, divisionId } = await params;
  const supabase = await createClient();

  const [{ data: division }, { data: registrations }, { data: otherDivisions }] = await Promise.all([
    supabase.from("divisions").select("name, team_size").eq("id", divisionId).single(),
    supabase
      .from("registrations")
      .select(
        "id, team_name, payment_status, registration_athletes(id, full_name, email, id_number, is_minor, waiver_signed_name, waiver_signed_at, is_captain)"
      )
      .eq("division_id", divisionId)
      .order("created_at", { ascending: true }),
    supabase
      .from("divisions")
      .select("id, name")
      .eq("event_id", eventId)
      .neq("id", divisionId)
      .order("created_at", { ascending: true }),
  ]);

  const registrationIds = (registrations ?? []).map((r) => r.id);
  const { data: emailLogRows } = registrationIds.length
    ? await supabase
        .from("email_log")
        .select("registration_id, recipient_email, status, created_at")
        .in("registration_id", registrationIds)
        .eq("email_type", "athlete_confirmation")
        .order("created_at", { ascending: false })
    : { data: [] };

  // Most recent attempt per (registration, recipient) wins — a resend
  // after an earlier failure should show as sent, not failed.
  const confirmationStatusByKey = new Map<string, "sent" | "failed">();
  for (const row of emailLogRows ?? []) {
    const key = `${row.registration_id}:${row.recipient_email}`;
    if (!confirmationStatusByKey.has(key)) {
      confirmationStatusByKey.set(key, row.status as "sent" | "failed");
    }
  }

  const athletes = (registrations ?? []).flatMap((r) =>
    (r.registration_athletes ?? []).map((a) => ({
      ...a,
      teamName: r.team_name,
      paymentStatus: r.payment_status,
      registrationId: r.id,
      confirmationStatus: confirmationStatusByKey.get(`${r.id}:${a.email}`) ?? null,
    }))
  );

  // A spot is only reserved once payment has actually gone through (or been
  // waived by an organizer for a manual entry). "pending"/"refunded" never
  // completed payment, so they don't hold a spot — park them in the archive.
  const confirmedAthletes = athletes.filter(
    (a) => a.paymentStatus === "paid" || a.paymentStatus === "waived"
  );
  const archivedAthletes = athletes.filter(
    (a) => a.paymentStatus !== "paid" && a.paymentStatus !== "waived"
  );

  // Team-completeness rollup: a paid team can start the event with a member
  // who never signed their own waiver (captain pays, teammates sign later
  // via their invite). Surface those so they can be chased before check-in.
  const incompleteTeams = (registrations ?? [])
    .filter((r) => (r.registration_athletes ?? []).length > 1)
    .map((r) => {
      const roster = r.registration_athletes ?? [];
      const signed = roster.filter((a) => a.waiver_signed_at).length;
      return {
        id: r.id,
        teamName: r.team_name ?? "Unnamed team",
        paymentStatus: r.payment_status,
        signed,
        total: roster.length,
      };
    })
    .filter((t) => t.signed < t.total);

  const isTeamDivision = (division?.team_size ?? 1) > 1;

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <a href={`/events/${eventId}/divisions`} className="text-accent text-sm hover:underline">
          ← Divisions
        </a>
        <h1 className="text-2xl font-semibold mt-1">{division?.name ?? "Division"} — Athletes</h1>
      </div>

      {incompleteTeams.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-1">
          <p className="font-semibold text-sm text-amber-800">Teams with unsigned waivers</p>
          {incompleteTeams.map((t) => (
            <p key={t.id} className="text-sm text-amber-700">
              {t.teamName} — {t.signed}/{t.total} signed
              {t.paymentStatus === "paid" ? " · paid" : ` · ${t.paymentStatus}`}
            </p>
          ))}
        </div>
      )}

      <div>
        <h2 className="font-semibold mb-3">Confirmed — spot reserved ({confirmedAthletes.length})</h2>
        <AthleteTable
          athletes={confirmedAthletes}
          eventId={eventId}
          divisionId={divisionId}
          isTeam={isTeamDivision}
          otherDivisions={otherDivisions ?? []}
          emptyMessage="No confirmed athletes yet."
        />
      </div>

      {archivedAthletes.length > 0 && (
        <details className="bg-white border border-ink/10 rounded-xl">
          <summary className="px-4 py-3 font-semibold cursor-pointer text-ink/70">
            Archive — never completed payment ({archivedAthletes.length})
          </summary>
          <div className="border-t border-ink/10">
            <AthleteTable
              athletes={archivedAthletes}
              eventId={eventId}
              divisionId={divisionId}
              isTeam={isTeamDivision}
              otherDivisions={otherDivisions ?? []}
              emptyMessage="Nothing archived."
            />
          </div>
        </details>
      )}

      <form
        action={addAthleteManually}
        className="bg-white border border-ink/10 rounded-xl p-6 space-y-4"
      >
        <input type="hidden" name="eventId" value={eventId} />
        <input type="hidden" name="divisionId" value={divisionId} />
        <h2 className="font-semibold">
          {isTeamDivision ? "Add team manually" : "Add athlete manually"}
        </h2>
        <p className="text-ink/60 text-sm">
          For walk-up entries who didn&apos;t go through the public registration wizard. Marked as
          waived (no payment).
        </p>
        {isTeamDivision ? (
          <>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-2">Team name</label>
              <input
                type="text"
                name="teamName"
                required
                className="w-full bg-paper rounded-lg px-4 py-3 text-sm border border-ink/10 focus:outline-none focus:border-accent"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              {Array.from({ length: division!.team_size }, (_, i) => (
                <div key={i}>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-2">
                    Athlete {i + 1}
                  </label>
                  <input
                    type="text"
                    name="athleteName"
                    required
                    className="w-full bg-paper rounded-lg px-4 py-3 text-sm border border-ink/10 focus:outline-none focus:border-accent"
                  />
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-2">Full name</label>
              <input
                type="text"
                name="fullName"
                required
                className="w-full bg-paper rounded-lg px-4 py-3 text-sm border border-ink/10 focus:outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-2">
                Email (optional)
              </label>
              <input
                type="email"
                name="email"
                className="w-full bg-paper rounded-lg px-4 py-3 text-sm border border-ink/10 focus:outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-2">
                ID number (optional)
              </label>
              <input
                type="text"
                name="idNumber"
                className="w-full bg-paper rounded-lg px-4 py-3 text-sm border border-ink/10 focus:outline-none focus:border-accent"
              />
            </div>
          </div>
        )}
        <button type="submit" className="bg-accent text-white rounded-lg px-5 py-2.5 text-sm font-semibold">
          {isTeamDivision ? "Add team" : "Add athlete"}
        </button>
      </form>
    </div>
  );
}

function AthleteTable({
  athletes,
  eventId,
  divisionId,
  isTeam,
  otherDivisions,
  emptyMessage,
}: {
  athletes: Array<{
    id: string;
    full_name: string;
    id_number: string | null;
    is_minor: boolean;
    waiver_signed_at: string | null;
    teamName: string | null;
    paymentStatus: string;
    registrationId: string;
    is_captain: boolean;
    confirmationStatus: "sent" | "failed" | null;
  }>;
  eventId: string;
  divisionId: string;
  isTeam: boolean;
  otherDivisions: Array<{ id: string; name: string }>;
  emptyMessage: string;
}) {
  return (
    <div className="bg-white border border-ink/10 rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-ink/5 text-left">
            <th className="px-4 py-2">Name</th>
            <th className="px-4 py-2">ID number</th>
            <th className="px-4 py-2">Waiver</th>
            <th className="px-4 py-2">Payment</th>
            <th className="px-4 py-2" />
            <th className="px-4 py-2" />
            <th className="px-4 py-2" />
          </tr>
        </thead>
        <tbody>
          {athletes.map((a) => (
            <tr key={a.id} className="border-t border-ink/10">
              <td className="px-4 py-2">
                {a.full_name}
                {a.is_minor && (
                  <span className="ml-2 text-xs font-semibold uppercase tracking-wider text-accent">
                    Minor
                  </span>
                )}
                {a.teamName && <span className="ml-2 text-ink/40 text-xs">({a.teamName})</span>}
                {isTeam && a.is_captain && (
                  <TeamNameField
                    registrationId={a.registrationId}
                    eventId={eventId}
                    divisionId={divisionId}
                    teamName={a.teamName}
                    action={updateTeamName}
                  />
                )}
                {a.is_captain && otherDivisions.length > 0 && (
                  <MoveDivisionField
                    registrationId={a.registrationId}
                    eventId={eventId}
                    divisionId={divisionId}
                    otherDivisions={otherDivisions}
                    action={moveRegistrationDivision}
                  />
                )}
              </td>
              <td className="px-4 py-2 font-data">{a.id_number || "—"}</td>
              <td className="px-4 py-2">
                {a.waiver_signed_at ? (
                  <span className="text-green-700">✓ Signed</span>
                ) : (
                  <span className="text-amber-700 font-semibold">Not signed</span>
                )}
              </td>
              <td className="px-4 py-2 capitalize">
                {a.paymentStatus}
                {a.paymentStatus === "paid" && (
                  <div className="mt-0.5">
                    {a.confirmationStatus === "sent" && (
                      <span className="text-green-700 text-xs font-semibold normal-case">
                        ✓ Confirmation email sent
                      </span>
                    )}
                    {a.confirmationStatus === "failed" && (
                      <span className="text-red-700 text-xs font-semibold normal-case">
                        ✗ Confirmation email failed
                      </span>
                    )}
                    {a.confirmationStatus === null && (
                      <span className="text-ink/40 text-xs normal-case">No confirmation email logged</span>
                    )}
                  </div>
                )}
              </td>
              <td className="px-4 py-2 text-right">
                {a.waiver_signed_at && (
                  <Link
                    href={`/events/${eventId}/divisions/${divisionId}/athletes/${a.id}/waiver`}
                    className="text-accent text-xs font-semibold hover:underline"
                  >
                    View waiver
                  </Link>
                )}
              </td>
              <td className="px-4 py-2 text-right whitespace-nowrap">
                {a.paymentStatus === "pending" && a.is_captain && (
                  <span className="mr-3">
                    <SendPaymentLinkButton registrationId={a.registrationId} action={resendPaymentLink} />
                  </span>
                )}
                {a.paymentStatus === "pending" && a.is_captain && (
                  <MarkPaidButton
                    registrationId={a.registrationId}
                    eventId={eventId}
                    divisionId={divisionId}
                    action={markPaidAndSendConfirmation}
                  />
                )}
              </td>
              <td className="px-4 py-2 text-right">
                <form action={removeAthlete}>
                  <input type="hidden" name="eventId" value={eventId} />
                  <input type="hidden" name="divisionId" value={divisionId} />
                  <input type="hidden" name="athleteId" value={a.id} />
                  <button type="submit" className="text-xs text-ink/40 hover:text-ink/70">
                    Remove
                  </button>
                </form>
              </td>
            </tr>
          ))}
          {athletes.length === 0 && (
            <tr>
              <td colSpan={7} className="px-4 py-6 text-center text-ink/60 text-sm">
                {emptyMessage}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
