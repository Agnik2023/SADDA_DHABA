import React, { useState } from "react";
import { Eye, EyeOff, Loader2, LockKeyhole, LogOut, ShieldCheck } from "lucide-react";
import { useStaffAuth } from "../../context/StaffAuthContext";
import { errorMessage } from "../../lib/errors";

export const LockScreen: React.FC = () => {
  const { session, staff, unlock, signOut } = useStaffAuth();
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy || !password) return;
    setBusy(true);
    setError(null);
    try {
      await unlock(password);
      setPassword("");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-stone-950/95 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm">
        <div className="mb-4 flex items-center justify-center gap-2.5 text-white">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-orange-600 to-amber-500">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <p className="font-heading text-sm font-black">SADDA DHABA</p>
            <p className="text-[10px] text-stone-400">Console locked</p>
          </div>
        </div>

        <div className="rounded-3xl border border-stone-800 bg-stone-900 p-6 shadow-2xl">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-400">
            <LockKeyhole className="h-5 w-5" />
          </div>
          <h1 className="font-heading mt-4 text-xl font-black text-white">Session locked</h1>
          <p className="mt-1 text-xs leading-relaxed text-stone-400">
            {staff?.display_name} · {session?.user.email}
          </p>
          <p className="mt-2 text-[11px] leading-relaxed text-stone-500">
            The console locked after a period of inactivity. Enter your password to continue.
          </p>

          <form onSubmit={submit} className="mt-5 space-y-3">
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Password"
                autoComplete="current-password"
                autoFocus
                className="w-full rounded-xl border border-stone-700 bg-stone-800 px-3.5 py-3 pr-11 text-sm text-white placeholder-stone-500 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-stone-400 hover:bg-stone-700 hover:text-white"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            {error && (
              <div className="rounded-xl border border-rose-900/60 bg-rose-950/40 p-3 text-xs font-semibold text-rose-300">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={busy || !password}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-orange-700 disabled:opacity-40"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LockKeyhole className="h-4 w-4" />}
              {busy ? "Unlocking…" : "Unlock console"}
            </button>
          </form>

          <button
            onClick={() => void signOut()}
            className="mt-3 flex w-full items-center justify-center gap-1.5 text-[11px] font-semibold text-stone-500 hover:text-stone-300"
          >
            <LogOut className="h-3.5 w-3.5" /> Sign out instead
          </button>
        </div>
      </div>
    </div>
  );
};
