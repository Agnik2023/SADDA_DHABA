import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Eye,
  EyeOff,
  Loader2,
  LockKeyhole,
  ShieldCheck,
  Utensils,
} from "lucide-react";
import { useStaffAuth } from "../../context/StaffAuthContext";
import { errorMessage } from "../../lib/errors";

export const AdminLogin: React.FC = () => {
  const { signIn } = useStaffAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setError(null);

    if (!email.trim() || !password) {
      setError("Enter your staff email and password.");
      return;
    }

    setBusy(true);
    try {
      await signIn(email, password);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-stone-100">
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-stone-950 p-10 text-white lg:flex">
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-orange-600/20 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-amber-500/10 blur-3xl" />

        <div className="relative flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-orange-600 to-amber-500 shadow-lg shadow-orange-600/30">
            <Utensils className="h-6 w-6" />
          </div>
          <div>
            <p className="font-heading text-xl font-black tracking-tight">SADDA DHABA</p>
            <p className="text-[11px] text-stone-400">Staff operations console</p>
          </div>
        </div>

        <div className="relative max-w-md">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-orange-400">
            Counter · Kitchen · Dev
          </p>
          <h1 className="font-heading mt-4 text-4xl font-black leading-tight">
            One queue.
            <br />
            Paid orders only.
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-stone-400">
            Counter staff verify the payment. Only then does an order appear on the kitchen
            screen. No online payment, no card data, no unpaid tickets in the kitchen.
          </p>
          <div className="mt-8 grid gap-3 text-xs">
            <div className="flex items-center gap-2.5 rounded-xl border border-stone-800 bg-stone-900/70 p-3">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              <span>Role-based access enforced by the database</span>
            </div>
            <div className="flex items-center gap-2.5 rounded-xl border border-stone-800 bg-stone-900/70 p-3">
              <LockKeyhole className="h-4 w-4 text-amber-400" />
              <span>Dev actions require an authenticator code</span>
            </div>
            <div className="flex items-center gap-2.5 rounded-xl border border-stone-800 bg-stone-900/70 p-3">
              <Utensils className="h-4 w-4 text-orange-400" />
              <span>Live order updates for the counter and kitchen</span>
            </div>
          </div>
        </div>

        <p className="relative text-[11px] text-stone-600">
          SADDA DHABA · Staff access only · Actions are audited
        </p>
      </div>

      <div className="flex flex-1 items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-md">
          <div className="mb-6 flex items-center justify-between lg:hidden">
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-orange-600 to-amber-500 text-white shadow-md">
                <Utensils className="h-5 w-5" />
              </div>
              <div>
                <p className="font-heading text-base font-black leading-tight text-stone-900">
                  SADDA DHABA
                </p>
                <p className="text-[10px] leading-tight text-stone-500">Staff console</p>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-stone-200 bg-white p-6 shadow-xl sm:p-8">
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-orange-600">
              Staff sign in
            </p>
            <h2 className="font-heading mt-2 text-2xl font-black text-stone-900">
              Open the console
            </h2>
            <p className="mt-1 text-xs text-stone-500">
              Use the staff account created by the owner in Supabase. Customer accounts do not work
              here.
            </p>

            <form onSubmit={onSubmit} className="mt-6 space-y-4">
              <div>
                <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-stone-600">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="username"
                  placeholder="counter@saddadhaba.in"
                  className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3.5 py-3 text-sm focus:border-orange-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                />
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-stone-600">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3.5 py-3 pr-11 text-sm focus:border-orange-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={busy}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-stone-900 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-stone-900/20 transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LockKeyhole className="h-4 w-4" />}
                {busy ? "Signing in…" : "Sign in"}
              </button>
            </form>

            <div className="mt-5 rounded-xl bg-stone-50 p-3 text-[11px] leading-relaxed text-stone-500">
              Dev accounts are asked for a 6-digit authenticator code after the password. Counter
              and kitchen accounts sign in with a password only.
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between px-1">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-500 hover:text-stone-800"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Customer menu
            </Link>
            <span className="text-[11px] text-stone-400">Sessions clear when the tab closes</span>
          </div>
        </div>
      </div>
    </div>
  );
};
