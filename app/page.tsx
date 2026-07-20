import { Logo } from "@/components/Logo";

export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center max-w-sm space-y-6">
        <div>
          <h1 className="text-3xl font-semibold"><Logo /></h1>
          <p className="mt-2 text-ink/60 text-sm">Competition management for CrossFit events.</p>
        </div>
        <p className="text-ink/60 text-sm">
          Registering for an event? Use the link your organizer shared with you.
        </p>
        <div className="flex flex-col gap-2">
          <a
            href="/judge-login"
            className="bg-white border border-ink/10 rounded-lg py-3 text-sm font-semibold hover-lift"
          >
            Judge sign-in
          </a>
          <a
            href="/login"
            className="bg-white border border-ink/10 rounded-lg py-3 text-sm font-semibold hover-lift"
          >
            Organizer sign-in
          </a>
        </div>
      </div>
    </main>
  );
}
