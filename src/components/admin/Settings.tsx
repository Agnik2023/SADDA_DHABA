import React, { useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  ReceiptText,
  RefreshCw,
  Save,
  Settings2,
  ShieldCheck,
  Timer,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useSettings } from "../../hooks/useMenu";
import { useStaffAuth } from "../../context/StaffAuthContext";
import { useToast } from "../../context/ToastContext";
import { updateSettings } from "../../lib/api";
import { errorMessage } from "../../lib/errors";
import { formatPaise, taxPercent } from "../../lib/money";

interface FormState {
  restaurantName: string;
  taxPercent: string;
  unpaidTimeout: string;
}

export const Settings: React.FC = () => {
  const { data: settings, isLoading, isError, error, refetch, isFetching } = useSettings();
  const { staff, currentLevel } = useStaffAuth();
  const { notify } = useToast();
  const queryClient = useQueryClient();

  const [form, setForm] = useState<FormState>({
    restaurantName: "",
    taxPercent: "5",
    unpaidTimeout: "30",
  });
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!settings) return;
    setForm({
      restaurantName: settings.restaurant_name,
      taxPercent: String(taxPercent(settings.tax_rate_bps)),
      unpaidTimeout: String(settings.unpaid_timeout_minutes),
    });
  }, [settings]);

  const isDev = staff?.role === "dev";
  const mfaReady = currentLevel === "aal2";

  const validate = (): { name: string; taxBps: number; timeout: number } | null => {
    const name = form.restaurantName.trim();
    if (name.length < 2 || name.length > 80) {
      setFormError("Restaurant name must be between 2 and 80 characters.");
      return null;
    }

    const taxValue = Number.parseFloat(form.taxPercent);
    if (!Number.isFinite(taxValue) || taxValue < 0 || taxValue > 28) {
      setFormError("GST must be between 0% and 28%.");
      return null;
    }
    const taxBps = Math.round(taxValue * 100);

    const timeout = Number.parseInt(form.unpaidTimeout, 10);
    if (!Number.isFinite(timeout) || timeout < 5 || timeout > 240) {
      setFormError("Unpaid timeout must be between 5 and 240 minutes.");
      return null;
    }

    return { name, taxBps, timeout };
  };

  const save = async () => {
    if (busy || !isDev) return;
    setFormError(null);

    const valid = validate();
    if (!valid) return;

    setBusy(true);
    try {
      await updateSettings({
        restaurant_name: valid.name,
        tax_rate_bps: valid.taxBps,
        unpaid_timeout_minutes: valid.timeout,
      });
      notify("Settings saved. New quotes use the updated values.", "success");
      await queryClient.invalidateQueries({ queryKey: ["settings"] });
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-sm text-stone-500">
        <Loader2 className="h-5 w-5 animate-spin text-orange-600" /> Loading settings…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-orange-600">
            Dev
          </p>
          <h1 className="font-heading text-2xl font-black tracking-tight text-stone-900">
            Restaurant settings
          </h1>
          <p className="mt-0.5 text-xs text-stone-500">
            These values are read by the server for every new quote and order.
          </p>
        </div>
        <button
          onClick={() => void refetch()}
          className="rounded-xl border border-stone-200 bg-white p-2.5 text-stone-500 shadow-sm transition hover:text-stone-800"
          title="Refresh"
        >
          <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
        </button>
      </div>

      {!mfaReady && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            <strong>Two-factor verification is required.</strong> Settings changes are blocked by
            the database until this dev session is at AAL2. Sign out and sign in again, then enter
            your authenticator code.
          </span>
        </div>
      )}

      {isError && (
        <div className="flex items-start justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
          <span className="flex gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {errorMessage(error)}
          </span>
          <button onClick={() => void refetch()} className="shrink-0 font-bold underline">
            Retry
          </button>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
            <h2 className="flex items-center gap-2 text-sm font-black text-stone-900">
              <Settings2 className="h-4 w-4 text-orange-600" /> General
            </h2>

            <div className="mt-3 space-y-3">
              <div>
                <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-stone-600">
                  Restaurant name
                </label>
                <input
                  value={form.restaurantName}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, restaurantName: event.target.value }))
                  }
                  maxLength={80}
                  disabled={!isDev}
                  className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3.5 py-2.5 text-sm focus:border-orange-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/30 disabled:opacity-60"
                />
                <p className="mt-1 text-[10px] text-stone-400">
                  Used in receipts and customer-facing labels.
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
            <h2 className="flex items-center gap-2 text-sm font-black text-stone-900">
              <ReceiptText className="h-4 w-4 text-orange-600" /> Tax
            </h2>

            <div className="mt-3 space-y-3">
              <div className="max-w-xs">
                <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-stone-600">
                  GST rate (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="28"
                  step="0.01"
                  value={form.taxPercent}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, taxPercent: event.target.value }))
                  }
                  disabled={!isDev}
                  className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3.5 py-2.5 text-sm focus:border-orange-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/30 disabled:opacity-60"
                />
                <p className="mt-1 text-[10px] text-stone-400">
                  Default is 5%. Confirm inclusive/exclusive pricing with your accountant before
                  changing this in production.
                </p>
              </div>

              <div className="rounded-xl border border-stone-200 bg-stone-50 p-3 text-[11px] text-stone-600">
                <p className="font-bold text-stone-800">Example at the current rate</p>
                <div className="mt-1.5 flex justify-between">
                  <span>Subtotal ₹500.00</span>
                  <span>GST {formatPaise(50000 * (settings?.tax_rate_bps ?? 500) / 10000)}</span>
                  <span className="font-black text-stone-900">
                    Total {formatPaise(50000 + Math.round((50000 * (settings?.tax_rate_bps ?? 500)) / 10000))}
                  </span>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
            <h2 className="flex items-center gap-2 text-sm font-black text-stone-900">
              <Timer className="h-4 w-4 text-orange-600" /> Unpaid orders
            </h2>

            <div className="mt-3 max-w-xs">
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-stone-600">
                Auto-cancel after (minutes)
              </label>
              <input
                type="number"
                min="5"
                max="240"
                step="1"
                value={form.unpaidTimeout}
                onChange={(event) =>
                  setForm((current) => ({ ...current, unpaidTimeout: event.target.value }))
                }
                disabled={!isDev}
                className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3.5 py-2.5 text-sm focus:border-orange-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/30 disabled:opacity-60"
              />
              <p className="mt-1 text-[10px] leading-relaxed text-stone-400">
                The scheduled database job sweeps unpaid orders every 5 minutes. Default is 30
                minutes. The customer tracking page shows the cancellation reason.
              </p>
            </div>
          </section>

          {formError && (
            <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {formError}
            </div>
          )}

          <div className="flex justify-end">
            <button
              onClick={() => void save()}
              disabled={busy || !isDev || !mfaReady}
              className="flex items-center gap-2 rounded-xl bg-orange-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-orange-600/20 transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {busy ? "Saving…" : "Save settings"}
            </button>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-900">
            <p className="flex items-center gap-1.5 font-black">
              <CheckCircle2 className="h-4 w-4" /> Server-enforced
            </p>
            <p className="mt-1.5 leading-relaxed">
              Prices, tax and totals are calculated inside the database. Changing settings never
              edits existing orders — their totals are snapshotted when they are created.
            </p>
          </div>

          <div className="rounded-2xl border border-stone-200 bg-white p-4 text-xs text-stone-600 shadow-sm">
            <p className="font-black text-stone-900">Staff roles</p>
            <ul className="mt-2 space-y-1.5 text-[11px] leading-relaxed">
              <li>
                <strong className="text-violet-700">Dev</strong> — full access, menu edits,
                settings, refunds. Requires TOTP.
              </li>
              <li>
                <strong className="text-sky-700">Counter</strong> — collect payments, walk-in
                orders, cancel unpaid, toggle availability, history.
              </li>
              <li>
                <strong className="text-emerald-700">Kitchen</strong> — paid orders only and
                preparation status.
              </li>
            </ul>
            <p className="mt-2 text-[10px] leading-relaxed text-stone-400">
              Roles live in the <code className="font-mono">staff</code> table. Change them in
              Supabase, never in the browser.
            </p>
          </div>

          <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4 text-[11px] leading-relaxed text-stone-500">
            <p className="font-bold text-stone-800">Last updated</p>
            <p className="mt-0.5">
              {settings?.updated_at
                ? new Date(settings.updated_at).toLocaleString("en-IN")
                : "Not available"}
            </p>
            <p className="mt-2">
              Database migrations live in{" "}
              <code className="rounded bg-white px-1 py-0.5 font-mono">supabase/migrations</code>.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
};
