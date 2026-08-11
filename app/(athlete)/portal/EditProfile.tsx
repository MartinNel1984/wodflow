"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

// Column-level grant for self-updates (full_name, email, phone,
// id_number, gym_name, updated_at) already exists — migration-035
// locked profiles_update_self down to exactly these columns after
// finding an athlete could otherwise PATCH their own role (migration-060
// extended the grant to add gym_name). Email is handled separately below
// via supabase.auth.updateUser rather than a plain table write, since
// email is also the login credential (auth.users), not just profile
// data — migration-059 syncs profiles.email once the athlete confirms
// the change from their inbox.
export default function EditProfile({
  profileId,
  initialFullName,
  initialPhone,
  initialEmail,
  initialGymName,
}: {
  profileId: string;
  initialFullName: string;
  initialPhone: string;
  initialEmail: string;
  initialGymName: string;
}) {
  const [open, setOpen] = useState(false);
  const [fullName, setFullName] = useState(initialFullName);
  const [phone, setPhone] = useState(initialPhone);
  const [gymName, setGymName] = useState(initialGymName);
  const [savingDetails, setSavingDetails] = useState(false);
  const [detailsError, setDetailsError] = useState("");
  const [detailsSaved, setDetailsSaved] = useState(false);

  const [email, setEmail] = useState(initialEmail);
  const [savingEmail, setSavingEmail] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [emailSent, setEmailSent] = useState(false);

  async function saveDetails(e: React.FormEvent) {
    e.preventDefault();
    setSavingDetails(true);
    setDetailsError("");
    setDetailsSaved(false);
    const supabase = createClient();
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: fullName.trim(), phone: phone.trim() || null, gym_name: gymName.trim() || null })
      .eq("id", profileId);
    setSavingDetails(false);
    if (error) {
      setDetailsError(error.message);
      return;
    }
    setDetailsSaved(true);
  }

  async function changeEmail(e: React.FormEvent) {
    e.preventDefault();
    setSavingEmail(true);
    setEmailError("");
    setEmailSent(false);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ email: email.trim().toLowerCase() });
    setSavingEmail(false);
    if (error) {
      setEmailError(error.message);
      return;
    }
    setEmailSent(true);
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-xs text-paper/60 hover:text-paper underline">
        Edit my details
      </button>
    );
  }

  return (
    <div className="w-full bg-white text-ink border-2 border-ink rounded-xl p-5 space-y-6">
      <form onSubmit={saveDetails} className="space-y-3">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider mb-1">Full name</label>
          <input
            type="text"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full bg-paper rounded-lg px-3 py-2 text-sm border border-ink/10 focus:outline-none focus:border-accent"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider mb-1">Phone</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full bg-paper rounded-lg px-3 py-2 text-sm border border-ink/10 focus:outline-none focus:border-accent"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider mb-1">Gym name</label>
          <input
            type="text"
            value={gymName}
            onChange={(e) => setGymName(e.target.value)}
            className="w-full bg-paper rounded-lg px-3 py-2 text-sm border border-ink/10 focus:outline-none focus:border-accent"
          />
        </div>
        {detailsError && <p className="text-red-700 text-xs">{detailsError}</p>}
        {detailsSaved && <p className="text-green-700 text-xs">Saved.</p>}
        <button
          type="submit"
          disabled={savingDetails}
          className="bg-accent text-white rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50"
        >
          {savingDetails ? "Saving…" : "Save"}
        </button>
      </form>

      <form onSubmit={changeEmail} className="space-y-3 border-t border-ink/10 pt-4">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider mb-1">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-paper rounded-lg px-3 py-2 text-sm border border-ink/10 focus:outline-none focus:border-accent"
          />
          <p className="text-ink/50 text-xs mt-1">
            Changing this sends a confirmation link to the new address — it only takes effect once you click it.
          </p>
        </div>
        {emailError && <p className="text-red-700 text-xs">{emailError}</p>}
        {emailSent && <p className="text-green-700 text-xs">Check your inbox at {email} to confirm.</p>}
        <button
          type="submit"
          disabled={savingEmail || email.trim().toLowerCase() === initialEmail.toLowerCase()}
          className="bg-ink text-white rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50"
        >
          {savingEmail ? "Sending…" : "Update email"}
        </button>
      </form>

      <button type="button" onClick={() => setOpen(false)} className="text-xs text-ink/50 hover:text-ink underline">
        Close
      </button>
    </div>
  );
}
