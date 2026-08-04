import { ChangePasswordForm } from "@/components/ChangePasswordForm";

export default function SettingsPage() {
  return (
    <div className="max-w-md mx-auto space-y-8">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <ChangePasswordForm className="bg-white border border-ink/10 rounded-xl p-6 space-y-4" />
    </div>
  );
}
