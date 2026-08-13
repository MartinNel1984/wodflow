"use server";

import { requireOrganizer } from "@/lib/auth";

import { revalidatePath } from "next/cache";

function slugify(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// brand_kits are readable platform-wide (public event pages need to
// render any org's kit), so nothing stops an organizer from picking
// another org's brand_kit_id off the "New event"/"Edit brand kit"
// dropdown unless the write path itself checks ownership — verify it
// belongs to the caller's own org before ever attaching it to an event.
async function ownedBrandKitId(
  supabase: Awaited<ReturnType<typeof requireOrganizer>>["supabase"],
  organizationId: string,
  rawBrandKitId: string
): Promise<string | null> {
  if (!rawBrandKitId) return null;
  const { data: kit } = await supabase
    .from("brand_kits")
    .select("id, organization_id")
    .eq("id", rawBrandKitId)
    .single();
  return kit?.organization_id === organizationId ? rawBrandKitId : null;
}

export async function createEvent(formData: FormData) {
  const { supabase, organizationId } = await requireOrganizer();
  const name = String(formData.get("name") ?? "").trim();
  const startDate = String(formData.get("startDate") ?? "").trim();
  if (!name || !startDate) return;

  const defaultPrice = Number(formData.get("defaultPrice"));
  const brandKitId = await ownedBrandKitId(
    supabase,
    organizationId,
    String(formData.get("brandKitId") ?? "").trim()
  );

  await supabase.from("events").insert({
    name,
    slug: slugify(name),
    start_date: startDate,
    end_date: String(formData.get("endDate") ?? "").trim() || null,
    venue_name: String(formData.get("venueName") ?? "").trim() || null,
    venue_address: String(formData.get("venueAddress") ?? "").trim() || null,
    contact_email: String(formData.get("contactEmail") ?? "").trim() || null,
    contact_phone: String(formData.get("contactPhone") ?? "").trim() || null,
    waiver_text: String(formData.get("waiverText") ?? "").trim() || null,
    default_price: Number.isNaN(defaultPrice) ? 500 : defaultPrice,
    brand_kit_id: brandKitId,
    organization_id: organizationId,
  });
  revalidatePath("/events");
}

export async function updateEventStatus(formData: FormData) {
  const { supabase } = await requireOrganizer();
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!id || !["draft", "published", "live", "archived"].includes(status)) return;

  await supabase.from("events").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
  revalidatePath("/events");
}

// Lets an organizer rehearse heats/scoring against a real event
// (migration-065) without athletes/spectators seeing it on the public
// leaderboard/heat sheet — those two pages check this flag and show
// the organizer a preview instead of the placeholder everyone else
// gets. Admin/judge scoring pages are unaffected either way.
export async function toggleResultsVisible(formData: FormData) {
  const { supabase } = await requireOrganizer();
  const id = String(formData.get("id") ?? "");
  const resultsVisible = formData.get("resultsVisible") === "true";
  if (!id) return;

  await supabase.from("events").update({ results_visible: resultsVisible }).eq("id", id);
  revalidatePath("/dashboard");
}

// Clones an event's divisions/workouts/teams into a brand-new draft
// event so an organizer can rehearse heat assignment, scoring,
// tie-breaks and points without touching the real event's rows
// (Tjokkie, 2026-08-13 — migration-065's results-hidden toggle still
// meant mucking with real registrations/heats/scores). Heats,
// heat_assignments, scores, judge_assignments and notices are
// deliberately NOT copied — those are exactly what the organizer
// wants to build fresh in the copy. Registrations are copied so
// heat-seeding has real team names to work with, but stripped of
// financial/PII fields that don't belong on a rehearsal: payment
// reset to "waived" (so it never inflates real revenue totals or
// looks like an unpaid team needing a follow-up), captain_profile_id
// and athlete profile_id cleared (so it never shows up in a real
// athlete's own portal), and emails replaced with a non-deliverable
// placeholder (nothing in this codebase emails from a direct insert,
// but this stays true even if that ever changes).
export async function duplicateEvent(formData: FormData) {
  const { supabase, organizationId } = await requireOrganizer();
  const sourceId = String(formData.get("id") ?? "");
  if (!sourceId) return;

  const { data: source } = await supabase
    .from("events")
    .select(
      "name, slug, start_date, end_date, venue_name, venue_address, contact_email, contact_phone, waiver_text, default_price, brand_kit_id, organization_id"
    )
    .eq("id", sourceId)
    .eq("organization_id", organizationId)
    .single();
  if (!source) return;

  const suffix = Date.now().toString(36);
  const { data: clone, error: cloneError } = await supabase
    .from("events")
    .insert({
      name: `${source.name} (Test Copy)`,
      slug: `${source.slug}-test-${suffix}`,
      start_date: source.start_date,
      end_date: source.end_date,
      venue_name: source.venue_name,
      venue_address: source.venue_address,
      contact_email: source.contact_email,
      contact_phone: source.contact_phone,
      waiver_text: source.waiver_text,
      default_price: source.default_price,
      brand_kit_id: source.brand_kit_id,
      organization_id: organizationId,
      status: "draft",
      results_visible: false,
      is_test: true,
      cloned_from_event_id: sourceId,
    })
    .select("id")
    .single();
  if (cloneError || !clone) return;

  const { data: divisions } = await supabase
    .from("divisions")
    .select(
      "id, name, team_size, price_early, price_normal, price_late, early_bird_ends, late_starts, workout_scoring_type, max_entries, scoring_config, gender, season_tier"
    )
    .eq("event_id", sourceId);

  const divisionIdMap = new Map<string, string>();
  for (const d of divisions ?? []) {
    const { data: newDivision } = await supabase
      .from("divisions")
      .insert({
        event_id: clone.id,
        name: d.name,
        team_size: d.team_size,
        price_early: d.price_early,
        price_normal: d.price_normal,
        price_late: d.price_late,
        early_bird_ends: d.early_bird_ends,
        late_starts: d.late_starts,
        workout_scoring_type: d.workout_scoring_type,
        max_entries: d.max_entries,
        scoring_config: d.scoring_config,
        gender: d.gender,
        season_tier: d.season_tier,
      })
      .select("id")
      .single();
    if (newDivision) divisionIdMap.set(d.id, newDivision.id);
  }
  if (divisionIdMap.size === 0) return;

  const sourceDivisionIds = [...divisionIdMap.keys()];

  const { data: workouts } = await supabase
    .from("workouts")
    .select(
      "id, division_id, name, sequence, cap_seconds, scoring_type, tiebreak_enabled, lane_count, heat_duration_minutes, transition_minutes, scoring_config, workout_movements(sequence, name, reps, load, rounds)"
    )
    .in("division_id", sourceDivisionIds);

  for (const w of workouts ?? []) {
    const newDivisionId = divisionIdMap.get(w.division_id);
    if (!newDivisionId) continue;
    const { data: newWorkout } = await supabase
      .from("workouts")
      .insert({
        division_id: newDivisionId,
        name: w.name,
        sequence: w.sequence,
        cap_seconds: w.cap_seconds,
        scoring_type: w.scoring_type,
        tiebreak_enabled: w.tiebreak_enabled,
        lane_count: w.lane_count,
        heat_duration_minutes: w.heat_duration_minutes,
        transition_minutes: w.transition_minutes,
        scoring_config: w.scoring_config,
      })
      .select("id")
      .single();
    if (!newWorkout) continue;

    const movements = w.workout_movements ?? [];
    if (movements.length > 0) {
      await supabase.from("workout_movements").insert(
        movements.map((m) => ({
          workout_id: newWorkout.id,
          sequence: m.sequence,
          name: m.name,
          reps: m.reps,
          load: m.load,
          rounds: m.rounds,
        }))
      );
    }
  }

  const { data: registrations } = await supabase
    .from("registrations")
    .select("id, division_id, team_name, registration_athletes(full_name, is_captain)")
    .in("division_id", sourceDivisionIds);

  for (const [i, r] of (registrations ?? []).entries()) {
    const newDivisionId = divisionIdMap.get(r.division_id);
    if (!newDivisionId) continue;
    const { data: newRegistration } = await supabase
      .from("registrations")
      .insert({
        event_id: clone.id,
        division_id: newDivisionId,
        team_name: r.team_name,
        captain_profile_id: null,
        price_paid: 0,
        payment_status: "waived",
      })
      .select("id")
      .single();
    if (!newRegistration) continue;

    const athletes = r.registration_athletes ?? [];
    if (athletes.length > 0) {
      await supabase.from("registration_athletes").insert(
        athletes.map((a, j) => ({
          registration_id: newRegistration.id,
          profile_id: null,
          full_name: a.full_name,
          email: `test-${i}-${j}-${suffix}@rehearsal.invalid`,
          is_captain: a.is_captain,
        }))
      );
    }
  }

  revalidatePath("/events");
  revalidatePath("/dashboard");
}

export async function updateEventBrandKit(formData: FormData) {
  const { supabase, organizationId } = await requireOrganizer();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const brandKitId = await ownedBrandKitId(
    supabase,
    organizationId,
    String(formData.get("brandKitId") ?? "").trim()
  );

  await supabase.from("events").update({ brand_kit_id: brandKitId, updated_at: new Date().toISOString() }).eq("id", id);
  revalidatePath("/events");
}
