import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, ArrowLeft, ArrowRight, CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Modal } from "../common/Modal";
import { useCart } from "../../context/CartContext";
import { useMenu, useSettings } from "../../hooks/useMenu";
import { useToast } from "../../context/ToastContext";
import { createOrder, quoteOrder } from "../../lib/api";
import { estimateTax, formatPaise } from "../../lib/money";
import { errorMessage } from "../../lib/errors";
import { generateAccessToken, generateIdempotencyKey } from "../../lib/ids";
import { saveLastOrderToken } from "../../lib/customerToken";
import type { CheckoutDetails, OrderType, Quote } from "../../types";

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const DETAILS_KEY = "sadda-checkout-details-v1";

function normalizePhone(value: string): string {
  let digits = value.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  return digits;
}

function readSavedDetails(): CheckoutDetails {
  try {
    const raw = window.sessionStorage.getItem(DETAILS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        name: typeof parsed.name === "string" ? parsed.name : "",
        phone: typeof parsed.phone === "string" ? parsed.phone : "",
        orderType: parsed.orderType === "TAKEAWAY" ? "TAKEAWAY" : "DINE_IN",
        table: typeof parsed.table === "string" ? parsed.table : "",
        notes: typeof parsed.notes === "string" ? parsed.notes : "",
      };
    }
  } catch {
    // ignore corrupt storage
  }
  return { name: "", phone: "", orderType: "DINE_IN", table: "", notes: "" };
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({ isOpen, onClose }) => {
  const { lines, clear } = useCart();
  const { data: menu } = useMenu();
  const { data: settings } = useSettings();
  const { notify } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [details, setDetails] = useState<CheckoutDetails>(readSavedDetails);
  const [step, setStep] = useState<"details" | "review">("details");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tokenRef = useRef<string | null>(null);
  const idempotencyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setStep("details");
    setQuote(null);
    setError(null);
    setBusy(false);
  }, [isOpen]);

  const phone = normalizePhone(details.phone);
  const phoneValid = /^[6-9]\d{9}$/.test(phone);
  const nameValid = details.name.trim().length >= 2 && details.name.trim().length <= 80;
  const tableValid = details.table.trim().length <= 20;
  const notesValid = details.notes.trim().length <= 500;
  const detailsValid = nameValid && phoneValid && tableValid && notesValid;

  const itemById = useMemo(
    () => new Map((menu?.items ?? []).map((item) => [item.id, item])),
    [menu]
  );

  const estimatedSubtotal = lines.reduce((sum, line) => {
    const item = itemById.get(line.menuItemId);
    return item ? sum + item.price_paise * line.qty : sum;
  }, 0);
  const estimatedTax = estimateTax(estimatedSubtotal, settings?.tax_rate_bps ?? 500);

  const updateDetails = (patch: Partial<CheckoutDetails>) => {
    setDetails((current) => {
      const next = { ...current, ...patch };
      try {
        window.sessionStorage.setItem(DETAILS_KEY, JSON.stringify(next));
      } catch {
        // ignore storage failure
      }
      return next;
    });
  };

  const handleReview = async () => {
    setError(null);
    if (!detailsValid) {
      setError("Please check your name, phone number and table number.");
      return;
    }
    if (lines.length === 0) {
      setError("Your cart is empty.");
      return;
    }

    setBusy(true);
    try {
      const result = await quoteOrder(lines);
      setQuote(result);
      setStep("review");
    } catch (err) {
      setError(errorMessage(err));
      void queryClient.invalidateQueries({ queryKey: ["menu"] });
    } finally {
      setBusy(false);
    }
  };

  const handlePlaceOrder = async () => {
    if (busy) return;
    setError(null);

    if (!tokenRef.current) tokenRef.current = generateAccessToken();
    if (!idempotencyRef.current) idempotencyRef.current = generateIdempotencyKey();

    setBusy(true);
    try {
      const result = await createOrder({
        name: details.name.trim(),
        phone,
        orderType: details.orderType,
        table: details.orderType === "DINE_IN" ? details.table.trim() : "",
        lines,
        notes: details.notes.trim(),
        accessToken: tokenRef.current,
        idempotencyKey: idempotencyRef.current,
      });

      const token = tokenRef.current;
      saveLastOrderToken(token);
      clear();
      notify(
        `Order ${result.order_code} placed. Show the code at the counter and pay ${formatPaise(
          result.total_paise
        )}.`,
        "success"
      );
      navigate(`/order#${token}`);

      tokenRef.current = null;
      idempotencyRef.current = null;
      setStep("details");
      setQuote(null);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
      void queryClient.invalidateQueries({ queryKey: ["menu"] });
    } finally {
      setBusy(false);
    }
  };

  const setOrderType = (orderType: OrderType) => updateDetails({ orderType });

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        if (!busy) onClose();
      }}
      title={
        <span className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-orange-600" />
          {step === "details" ? "Checkout" : "Confirm your order"}
        </span>
      }
      maxWidth="2xl"
    >
      {step === "details" ? (
        <div className="space-y-5">
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] leading-relaxed text-amber-900">
            <strong>Pay at the counter.</strong> No card or UPI details are collected here. Your
            order goes to the kitchen only after counter staff verify the payment.
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-stone-600">
                Your name *
              </label>
              <input
                type="text"
                value={details.name}
                onChange={(event) => updateDetails({ name: event.target.value })}
                maxLength={80}
                placeholder="e.g. Rahul"
                autoComplete="name"
                className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3.5 py-2.5 text-sm focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
              />
              {details.name.length > 0 && !nameValid && (
                <p className="mt-1 text-[11px] font-semibold text-rose-600">
                  Enter at least 2 characters.
                </p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-stone-600">
                Mobile number *
              </label>
              <div className="flex overflow-hidden rounded-xl border border-stone-200 bg-stone-50 focus-within:border-orange-400 focus-within:ring-2 focus-within:ring-orange-500/30">
                <span className="flex items-center border-r border-stone-200 bg-stone-100 px-3 text-xs font-bold text-stone-500">
                  +91
                </span>
                <input
                  type="tel"
                  inputMode="numeric"
                  value={details.phone}
                  onChange={(event) => updateDetails({ phone: event.target.value })}
                  maxLength={14}
                  placeholder="98765 43210"
                  autoComplete="tel-national"
                  className="min-w-0 flex-1 bg-transparent px-3.5 py-2.5 text-sm focus:outline-none"
                />
              </div>
              {details.phone.length > 0 && !phoneValid && (
                <p className="mt-1 text-[11px] font-semibold text-rose-600">
                  Enter a valid 10-digit mobile number starting with 6–9.
                </p>
              )}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-stone-600">
              Order type *
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  { value: "DINE_IN" as const, label: "Dine in", hint: "Eat at the dhaba" },
                  { value: "TAKEAWAY" as const, label: "Takeaway", hint: "Collect from counter" },
                ] satisfies Array<{ value: OrderType; label: string; hint: string }>
              ).map((option) => {
                const active = details.orderType === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setOrderType(option.value)}
                    className={`rounded-xl border p-3 text-left transition ${
                      active
                        ? "border-orange-500 bg-orange-50 ring-2 ring-orange-500/20"
                        : "border-stone-200 bg-white hover:border-stone-300"
                    }`}
                  >
                    <span
                      className={`block text-sm font-bold ${
                        active ? "text-orange-800" : "text-stone-800"
                      }`}
                    >
                      {option.label}
                    </span>
                    <span className="mt-0.5 block text-[11px] text-stone-500">{option.hint}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {details.orderType === "DINE_IN" && (
            <div>
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-stone-600">
                Table number <span className="font-medium normal-case text-stone-400">(optional)</span>
              </label>
              <input
                type="text"
                value={details.table}
                onChange={(event) => updateDetails({ table: event.target.value })}
                maxLength={20}
                placeholder="e.g. 4"
                className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3.5 py-2.5 text-sm focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
              />
              {!tableValid && (
                <p className="mt-1 text-[11px] font-semibold text-rose-600">
                  Table number is too long.
                </p>
              )}
            </div>
          )}

          <div>
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-stone-600">
              Kitchen notes <span className="font-medium normal-case text-stone-400">(optional)</span>
            </label>
            <textarea
              value={details.notes}
              onChange={(event) => updateDetails({ notes: event.target.value })}
              maxLength={500}
              rows={2}
              placeholder="Less spicy, no onion, allergy notes…"
              className="w-full resize-none rounded-xl border border-stone-200 bg-stone-50 px-3.5 py-2.5 text-sm focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
            />
            <div className="mt-1 flex justify-between text-[11px] text-stone-400">
              <span>{notesValid ? "" : "Please shorten the notes."}</span>
              <span>{details.notes.length}/500</span>
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex items-center justify-between rounded-xl bg-stone-50 p-3">
            <div className="text-xs text-stone-500">
              <p>Estimated total incl. GST</p>
              <p className="font-heading text-lg font-black text-stone-900">
                {formatPaise(estimatedSubtotal + estimatedTax)}
              </p>
            </div>
            <span className="max-w-[12rem] text-right text-[10px] leading-relaxed text-stone-400">
              The server calculates the final total using live menu prices.
            </span>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="rounded-xl px-4 py-2.5 text-xs font-semibold text-stone-600 transition hover:text-stone-900 disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleReview()}
              disabled={busy || !detailsValid || lines.length === 0}
              className="flex items-center gap-2 rounded-xl bg-orange-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-orange-600/20 transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {busy ? "Checking prices…" : "Review order"}
              {!busy && <ArrowRight className="h-4 w-4" />}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {quote ? (
            <>
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
                <p className="flex items-center gap-1.5 font-bold">
                  <CheckCircle2 className="h-4 w-4" /> Prices confirmed by the server
                </p>
                <p className="mt-1 leading-relaxed">
                  Review the order below, then place it. Payment is still collected at the counter.
                </p>
              </div>

              <div className="space-y-2">
                {quote.lines.map((line) => (
                  <div
                    key={line.menu_item_id}
                    className="flex items-start justify-between gap-3 rounded-xl border border-stone-200 bg-white p-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-stone-900">
                        <span className="mr-1.5 text-orange-600">{line.qty}×</span>
                        {line.name}
                      </p>
                      <p className="mt-0.5 text-[11px] text-stone-400">
                        {formatPaise(line.unit_price_paise)} each {line.is_veg ? "· Veg" : "· Non-veg"}
                      </p>
                    </div>
                    <span className="shrink-0 font-heading text-sm font-bold text-stone-900">
                      {formatPaise(line.unit_price_paise * line.qty)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="space-y-1.5 rounded-xl bg-stone-50 p-4 text-xs text-stone-600">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span className="font-semibold text-stone-900">
                    {formatPaise(quote.subtotal_paise)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>GST ({quote.tax_rate_bps / 100}%)</span>
                  <span className="font-semibold text-stone-900">
                    {formatPaise(quote.tax_paise)}
                  </span>
                </div>
                <div className="flex items-baseline justify-between border-t border-stone-200 pt-2">
                  <span className="font-bold text-stone-900">Pay at counter</span>
                  <span className="font-heading text-xl font-black text-orange-600">
                    {formatPaise(quote.total_paise)}
                  </span>
                </div>
              </div>

              <div className="grid gap-2 rounded-xl border border-stone-200 p-4 text-xs sm:grid-cols-2">
                <p>
                  <span className="text-stone-400">Name:</span>{" "}
                  <span className="font-semibold text-stone-800">{details.name.trim()}</span>
                </p>
                <p>
                  <span className="text-stone-400">Mobile:</span>{" "}
                  <span className="font-semibold text-stone-800">+91 {phone}</span>
                </p>
                <p>
                  <span className="text-stone-400">Order:</span>{" "}
                  <span className="font-semibold text-stone-800">
                    {details.orderType === "DINE_IN" ? "Dine in" : "Takeaway"}
                    {details.orderType === "DINE_IN" && details.table.trim()
                      ? ` · Table ${details.table.trim()}`
                      : ""}
                  </span>
                </p>
                <p className="truncate">
                  <span className="text-stone-400">Notes:</span>{" "}
                  <span className="font-semibold text-stone-800">
                    {details.notes.trim() || "—"}
                  </span>
                </p>
              </div>

              {error && (
                <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setStep("details")}
                  disabled={busy}
                  className="flex items-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-semibold text-stone-600 transition hover:text-stone-900 disabled:opacity-40"
                >
                  <ArrowLeft className="h-4 w-4" /> Edit details
                </button>
                <button
                  type="button"
                  onClick={() => void handlePlaceOrder()}
                  disabled={busy}
                  className="flex items-center gap-2 rounded-xl bg-orange-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-orange-600/25 transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                  {busy ? "Placing order…" : `Place order · ${formatPaise(quote.total_paise)}`}
                </button>
              </div>
            </>
          ) : (
            <p className="text-sm text-stone-500">Preparing your order summary…</p>
          )}
        </div>
      )}
    </Modal>
  );
};
