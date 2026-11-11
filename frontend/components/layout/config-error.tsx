import { Logo } from "./logo";

export function ConfigError({ missing }: { missing: string[] }) {
  return (
    <div className="flex min-h-dvh items-center justify-center p-6">
      <div className="w-full max-w-lg rounded-xl border border-border bg-surface p-6">
        <Logo />
        <h1 className="mt-5 text-lg font-semibold">FinTrack isn&apos;t configured yet</h1>
        <p className="mt-1 text-sm text-fg-muted">
          The frontend needs these environment variables. Copy <code className="font-mono text-xs">frontend/.env.example</code> to{" "}
          <code className="font-mono text-xs">frontend/.env.local</code>, fill in your Supabase project values and restart the dev server.
        </p>
        <ul className="mt-4 space-y-1.5">
          {missing.map((m) => (
            <li key={m} className="rounded-md bg-surface-2 px-3 py-2 font-mono text-xs text-negative">
              {m}
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-fg-subtle">Use the anon / publishable key only — never the service-role key.</p>
      </div>
    </div>
  );
}
