import React, { useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Copy,
  KeyRound,
  Loader2,
  LogOut,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useStaffAuth } from "../../context/StaffAuthContext";
import { useToast } from "../../context/ToastContext";
import { errorMessage } from "../../lib/errors";

interface Enrollment {
  id: string;
  qrCode: string;
  secret: string;
}

export const MfaChallenge: React.FC = () => {
  const { staff, factors, refresh, signOut } = useStaffAuth();
  const { notify } = useToast();
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const verifiedFactor = useMemo(
    () => factors.find((factor) => factor.status === "verified"),
    [factors]
  );

  const startEnrollment = async () => {
    setBusy(true);
    setError(null);
    try {
      const { data: list } = await supabase.auth.mfa.listFactors();
      for (const factor of list?.all ?? []) {
        if (factor.status === "unverified") {
          await supabase.auth.mfa.unenroll({ factorId: factor.id });
        }
      }

      const { data, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "SADDA DHABA Dev",
      });
      if (enrollError) throw new Error(enrollError.message);
      if (!data) throw new Error("ENROLLMENT_FAILED");

      setEnrollment({
        id: data.id,
        qrCode: data.totp.qr_code,
        secret: data.totp.secret,
      });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const verify = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setError(null);

    const factorId = enrollment?.id ?? verifiedFactor?.id;
    if (!factorId) {
      setError("Set up an authenticator first.");
      return;
    }
    if (!/^\d{6}$/.test(code.trim())) {
      setError("Enter the 6-digit code from your authenticator app.");
      return;
    }

    setBusy(true);
    try {
      const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
        factorId,
        code: code.trim(),
      });
      if (verifyError) throw new Error(verifyError.message);

      notify("Two-factor verification complete.", "success");
      setCode("");
      setEnrollment(null);
      await refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const copySecret = async () => {
    if (!enrollment) return;
    try {
      await navigator.clipboard.writeText(enrollment.secret);
      notify("Setup key copied.", "success");
    } catch {
      notify("Could not copy the setup key.", "error");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-950 p-4">
      <div className="w-full max-w-md">
        <div className="mb-5 flex items-center justify-between text-white">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-orange-600 to-amber-500 shadow-md">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="font-heading text-base font-black leading-tight">SADDA DHABA</p>
              <p className="text-[10px] leading-tight text-stone-400">
                Dev verification · {staff?.display_name ?? "staff"}
              </p>
            </div>
          </div>
          <button
            onClick={() => void signOut()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-stone-800 px-3 py-2 text-[11px] font-bold text-stone-300 hover:bg-stone-900"
          >
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </button>
        </div>

        <div className="rounded-3xl border border-stone-200 bg-white p-6 shadow-2xl sm:p-8">
          {!verifiedFactor && !enrollment ? (
            <>
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-100 text-orange-700">
                <KeyRound className="h-5 w-5" />
              </div>
              <h1 className="font-heading mt-4 text-2xl font-black text-stone-900">
                Secure the dev account
              </h1>
              <p className="mt-2 text-xs leading-relaxed text-stone-500">
                Dev accounts have owner-level access: menu changes, settings, and refunds. Before
                opening the console, add this account to an authenticator app (Google
                Authenticator, 1Password, Authy, etc.).
              </p>
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] leading-relaxed text-amber-900">
                The authenticator code is required every time this account signs in. Keep a secure
                backup of the setup key.
              </div>
              {error && (
                <div className="mt-4 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
                </div>
              )}
              <button
                onClick={() => void startEnrollment()}
                disabled={busy}
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-stone-900 px-4 py-3 text-sm font-bold text-white hover:bg-stone-800 disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Smartphone className="h-4 w-4" />}
                {busy ? "Preparing QR code…" : "Set up authenticator"}
              </button>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 text-emerald-700">
                <ShieldCheck className="h-5 w-5" />
                <span className="text-[11px] font-black uppercase tracking-[0.18em]">
                  Dev verification
                </span>
              </div>
              <h1 className="font-heading mt-2 text-2xl font-black text-stone-900">
                {enrollment ? "Scan and verify" : "Enter your authenticator code"}
              </h1>
              <p className="mt-1 text-xs leading-relaxed text-stone-500">
                {enrollment
                  ? "Scan this QR code with your authenticator app, then enter the 6-digit code it shows."
                  : "Open your authenticator app and enter the current 6-digit code for SADDA DHABA Dev."}
              </p>

              {enrollment && (
                <div className="mt-4 rounded-2xl border border-stone-200 bg-stone-50 p-4">
                  <div
                    className="mx-auto h-44 w-44 overflow-hidden rounded-xl bg-white p-1 [&_svg]:h-full [&_svg]:w-full"
                    dangerouslySetInnerHTML={{ __html: enrollment.qrCode }}
                  />
                  <div className="mt-3">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-stone-500">
                      Manual setup key
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                      <code className="min-w-0 flex-1 break-all rounded-lg bg-white px-2 py-1.5 font-mono text-[11px] text-stone-700">
                        {enrollment.secret}
                      </code>
                      <button
                        type="button"
                        onClick={() => void copySecret()}
                        className="rounded-lg border border-stone-200 bg-white p-2 text-stone-500 hover:text-stone-800"
                        aria-label="Copy setup key"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <form onSubmit={verify} className="mt-4 space-y-3">
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={code}
                  onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="000000"
                  autoFocus
                  className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-center font-mono text-2xl font-bold tracking-[0.35em] text-stone-900 focus:border-orange-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                />

                {error && (
                  <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={busy || code.length !== 6}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-orange-600/20 transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  {busy ? "Verifying…" : "Verify and continue"}
                </button>
              </form>

              {!enrollment && (
                <button
                  onClick={() => setEnrollment(null)}
                  className="mt-3 w-full text-center text-[11px] font-semibold text-stone-400 hover:text-stone-700"
                >
                  Lost your authenticator? Sign out and ask the owner to reset the dev account.
                </button>
              )}
            </>
          )}
        </div>

        <p className="mt-4 text-center text-[11px] text-stone-600">
          Protected by Supabase Auth · TOTP required for dev actions
        </p>
      </div>
    </div>
  );
};
