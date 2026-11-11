import React, { useEffect, useState } from "react";
import {
  AlertCircle,
  Banknote,
  CheckCircle2,
  CreditCard,
  Loader2,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Modal } from "../common/Modal";
import type { Order, PaymentMethod } from "../../types";
import { markPaid } from "../../lib/api";
import { errorMessage } from "../../lib/errors";
import { formatPaise } from "../../lib/money";
import { PAYMENT_METHOD_LABEL } from "../../lib/orderStatus";
import { useToast } from "../../context/ToastContext";

interface CollectPaymentModalProps {
  order: Order | null;
  onClose: () => void;
}

const METHODS: Array<{
  value: PaymentMethod;
  label: string;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { value: "CASH", label: "Cash", hint: "Notes / coins received", icon: Banknote },
  { value: "UPI_COUNTER", label: "UPI", hint: "Paid to the counter QR", icon: Smartphone },
  { value: "CARD_COUNTER", label: "Card", hint: "Paid on the card machine", icon: CreditCard },
];

export const CollectPaymentModal: React.FC<CollectPaymentModalProps> = ({ order, onClose }) => {
  const [method, setMethod] = useState<PaymentMethod>("CASH");
  const [reference, setReference] = useState("");
  const [verified, setVerified] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { notify } = useToast();

  useEffect(() => {
    if (!order) return;
    setMethod("CASH");
    setReference("");
    setVerified(false);
    setBusy(false);
    setError(null);
  }, [order?.id]);

  if (!order) return null;

  const submit = async () => {
    if (busy) return;
    setError(null);

    if (!verified) {
      setError("Confirm that you have physically verified the payment first.");
      return;
    }

    setBusy(true);
    try {
      await markPaid(order.id, method, reference);
      notify(
        `${order.order_code} marked paid · ${formatPaise(order.total_paise)} · ${
          PAYMENT_METHOD_LABEL[method]
        }. Sent to the kitchen.`,
        "success"
      );
      await queryClient.invalidateQueries({ queryKey: ["orders"] });
      await queryClient.invalidateQueries({ queryKey: ["order-details"] });
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      isOpen={Boolean(order)}
      onClose={() => {
        if (!busy) onClose();
      }}
      title={
        <span className="flex items-center gap-2">
          <Banknote className="h-5 w-5 text-amber-600" />
          Collect payment · {order.order_code}
        </span>
      }
      maxWidth="md"
    >
      <div className="space-y-4">
        <div className="rounded-2xl bg-stone-900 p-4 text-white">
          <p className="text-[11px] font-bold uppercase tracking-wider text-stone-400">
            Amount to collect
          </p>
          <p className="font-heading mt-1 text-4xl font-black tracking-tight">
            {formatPaise(order.total_paise)}
          </p>
          <p className="mt-1 text-xs text-stone-400">
            {order.customer_name} ·{" "}
            {order.order_type === "DINE_IN"
              ? `Dine-in${order.table_number ? ` · Table ${order.table_number}` : ""}`
              : "Takeaway"}
          </p>
        </div>

        <div>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-stone-600">
            Payment method
          </p>
          <div className="grid grid-cols-3 gap-2">
            {METHODS.map((option) => {
              const Icon = option.icon;
              const active = method === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setMethod(option.value)}
                  className={`rounded-xl border p-3 text-left transition ${
                    active
                      ? "border-orange-500 bg-orange-50 ring-2 ring-orange-500/20"
                      : "border-stone-200 bg-white hover:border-stone-300"
                  }`}
                >
                  <Icon
                    className={`h-4 w-4 ${active ? "text-orange-600" : "text-stone-400"}`}
                  />
                  <span
                    className={`mt-1.5 block text-xs font-black ${
                      active ? "text-orange-900" : "text-stone-800"
                    }`}
                  >
                    {option.label}
                  </span>
                  <span className="mt-0.5 block text-[10px] leading-tight text-stone-400">
                    {option.hint}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-stone-600">
            Reference <span className="font-medium normal-case text-stone-400">(optional)</span>
          </label>
          <input
            type="text"
            value={reference}
            onChange={(event) => setReference(event.target.value)}
            maxLength={120}
            placeholder={
              method === "CASH"
                ? "e.g. exact change"
                : method === "UPI_COUNTER"
                  ? "UPI transaction reference"
                  : "Card machine reference / last 4 digits"
            }
            className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3.5 py-2.5 text-sm focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
          />
        </div>

        <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
          <input
            type="checkbox"
            checked={verified}
            onChange={(event) => setVerified(event.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-emerald-300 text-emerald-600 focus:ring-emerald-500"
          />
          <span className="text-xs leading-relaxed text-emerald-900">
            <strong>I have physically verified this payment.</strong> The money has been received
            at the counter. I understand this sends the order to the kitchen.
          </span>
        </label>

        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
          </div>
        )}

        <div className="flex items-center justify-between rounded-xl bg-stone-50 p-3 text-[11px] text-stone-500">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            Payment is recorded against your staff account.
          </span>
          <span className="font-mono text-stone-400">{order.order_code}</span>
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-xl px-4 py-2.5 text-xs font-semibold text-stone-600 hover:text-stone-900 disabled:opacity-40"
          >
            Not yet
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={busy || !verified}
            className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-emerald-600/20 transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            {busy ? "Recording payment…" : `Confirm payment · ${formatPaise(order.total_paise)}`}
          </button>
        </div>
      </div>
    </Modal>
  );
};
