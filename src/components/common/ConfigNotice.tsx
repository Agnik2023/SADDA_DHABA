import React from "react";
import { AlertTriangle, ExternalLink } from "lucide-react";

export const ConfigNotice: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  if (compact) {
    return (
      <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <p className="font-bold">Supabase is not configured</p>
          <p className="mt-0.5 leading-relaxed">
            Add <code className="font-mono">VITE_SUPABASE_URL</code> and{" "}
            <code className="font-mono">VITE_SUPABASE_ANON_KEY</code> to{" "}
            <code className="font-mono">.env.local</code>, then restart the app.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-100 p-4">
      <div className="w-full max-w-lg rounded-3xl border border-stone-200 bg-white p-6 shadow-xl sm:p-8">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-heading text-xl font-black text-stone-900">
              Backend not configured
            </h1>
            <p className="text-xs text-stone-500">
              SADDA DHABA needs its Supabase project before it can take orders.
            </p>
          </div>
        </div>

        <div className="mt-5 rounded-2xl bg-stone-900 p-4 font-mono text-[11px] leading-relaxed text-stone-200">
          <p className="text-stone-400"># .env.local</p>
          <p>VITE_SUPABASE_URL=https://your-project.supabase.co</p>
          <p>VITE_SUPABASE_ANON_KEY=your-anon-key</p>
        </div>

        <ol className="mt-5 space-y-2.5 text-xs text-stone-600">
          <li className="flex gap-2">
            <span className="font-black text-orange-600">1.</span>
            Create a free project at supabase.com and run the migrations in{" "}
            <code className="rounded bg-stone-100 px-1 py-0.5 font-mono">supabase/migrations</code>.
          </li>
          <li className="flex gap-2">
            <span className="font-black text-orange-600">2.</span>
            Create the staff users and insert their roles into the{" "}
            <code className="rounded bg-stone-100 px-1 py-0.5 font-mono">staff</code> table.
          </li>
          <li className="flex gap-2">
            <span className="font-black text-orange-600">3.</span>
            Restart the dev server after saving the environment variables.
          </li>
          <li className="flex gap-2">
            <span className="font-black text-orange-600">4.</span>
            On Cloudflare Pages, add both variables under Settings → Environment variables.
          </li>
        </ol>

        <a
          href="https://supabase.com/dashboard"
          target="_blank"
          rel="noreferrer"
          className="mt-5 inline-flex items-center gap-1.5 text-xs font-bold text-orange-700 hover:text-orange-800"
        >
          Open Supabase dashboard <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>
    </div>
  );
};
