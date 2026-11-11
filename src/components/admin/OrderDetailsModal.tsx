import React, { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Copy,
  ExternalLink,
  Loader2,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  XCircle,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Modal } from "../common/Modal";
import { Badge, OrderStatusBadge, OrderTypeBadge, PaymentBadge } from "../common/Badge";
import { useOrderDetails } from "../../hooks/useMenu";
import { useStaffAuth } from "../../context/StaffAuthContext";
import { useToast } from "../../context/ToastContext";
import {
  cancelOrder,
  refundOrder,
  reissueOrderToken,
  updateOrderStatus,
} from "../../lib/api";
import { errorMessage } from "../../lib/errors";
import { formatDateTime } from "../../lib/datetime";
import { formatPaise } from "../../lib/money";
import { PAYMENT_METHOD_LABEL } from "../../lib/orderStatus";
import type { OrderEvent } from "../../types";

interface OrderDetailsModalProps {
  orderId: string | null;
  onClose: () => void;
}

const EVENT_LABELS: Record<string, string> = {
  ORDER_CREATED: "Order created",
  PAYMENT_COLLECTED: "Payment collected",
  STATUS_CHANGED: "Status changed",
  ORDER_CANCELLED: "Order cancelled",
  ORDER_CANCELLED_REFUNDED: "Order cancelled and refunded",
  TOKEN_REISSUED: "Customer link reissued",
  AUTO_CANCELLED: "Auto-cancelled",
};

function eventDetail(event: OrderEvent): string {
  const details = event.details ?? {};
  if (event.event_type === "PAYMENT_COLLECTED") {
    const method = typeof details.method === "string" ? details.method : "";
    const reference = typeof details.reference === "string" ? details.reference : "";
    const amount =
      typeof details.amount_paise === "number" ? formatPaise(details.amount_paise) : "";
    return [method, amount, reference ? `ref ${reference}` : ""].filter(Boolean).join(" · ");
  }
  if (event.event_type === "STATUS_CHANGED") {
    const from = typeof details.from === "string" ? details.from : "";
    const to = typeof details.to === "string" ? details.to : "";
    return `${from} → ${to}`;
  }
  if (event.event_type === "TOKEN_REISSUED") {
    return "The previous customer tracking link was replaced.";
  }
  if (typeof details.reason === "string") return details.reason;
  if (typeof details.source === "string") return `Source: ${details.source}`;
  return "";
}

export const OrderDetailsModal: React.FC<OrderDetailsModalProps> = ({ orderId, onClose }) => {
  const { data, isLoading, isError, error, refetch } = useOrderDetails(orderId);
  const { staff } = useStaffAuth();
  const { notify } = useToast();
  const queryClient = useQueryClient();

  const [panel, setPanel] = useState<"cancel" | "refund" | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [reissued, setReissued] = useState<{ order_code: string; access_token: string } | null>(
    null
  );

  useEffect(() => {
    setPanel(null);
    setReason("");
    setBusy(false);
    setActionError(null);
    setReissued(null);
  }, [orderId]);

  const order = data?.order;
  const events = data?.events ?? [];
  const canManage = staff?.role === "counter" || staff?.role === "dev";
  const isDev = staff?.role === "dev";

  const actionLink = useMemo(
    () => (reissued ? `${window.location.origin}/order#${reissued.access_token}` : ""),
    [reissued]
  );

  const refreshAll = async () => {
    await queryClient.invalidateQueries({ queryKey: ["orders"] });
    await queryClient.invalidateQueries({ queryKey: ["order-details"] });
  };

  const runStatus = async (status: string, successMessage: string) => {
    if (!order || busy) return;
    setBusy(true);
    setActionError(null);
    try {
      await updateOrderStatus(order.id, status);
      notify(successMessage, "success");
      await refreshAll();
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const submitReasonAction = async () => {
    if (!order || busy) return;
    if (reason.trim().length < 3) {
      setActionError("Enter a reason of at least 3 characters.");
      return;
    }

    setBusy(true);
    setActionError(null);
    try {
      if (panel === "refund") {
        await refundOrder(order.id, reason.trim());
        notify(`${order.order_code} refunded and cancelled.`, "success");
      } else {
        await cancelOrder(order.id, reason.trim());
        notify(`${order.order_code} cancelled.`, "success");
      }
      setPanel(null);
      setReason("");
      await refreshAll();
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const reissue = async () => {
    if (!order || busy) return;
    const confirmed = window.confirm(
      "Reissue the customer link? The customer's current tracking link will stop working."
    );
    if (!confirmed) return;

    setBusy(true);
    setActionError(null);
    try {
      const result = await reissueOrderToken(order.id);
      setReissued(result);
      notify("New customer link created. Copy it now.", "success");
      await refreshAll();
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const copyLink = async () => {
    if (!actionLink) return;
    try {
      await navigator.clipboard.writeText(actionLink);
      notify("Customer link copied.", "success");
    } catch {
      notify("Could not copy the link.", "error");
    }
  };

  return (
    <Modal
      isOpen={Boolean(orderId)}
      onClose={() => {
        if (!busy) onClose();
      }}
      title={
        <span className="flex items-center gap-2">
          <span>Order details</span>
          {order && (
            <span className="font-mono text-sm font-black text-orange-600">{order.order_code}</span>
          )}
        </span>
      }
      maxWidth="3xl"
    >
      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-12 text-sm text-stone-500">
          <Loader2 className="h-5 w-5 animate-spin text-orange-600" /> Loading order…
        </div>
      ) : isError || !order ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-semibold text-rose-800">
          <p>{errorMessage(error)}</p>
          <button
            onClick={() => void refetch()}
            className="mt-2 inline-flex items-center gap-1.5 font-bold text-rose-700"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Retry
          </button>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <OrderStatusBadge status={order.status} />
            <PaymentBadge status={order.payment_status} />
            <OrderTypeBadge orderType={order.order_type} tableNumber={order.table_number} />
            {order.payment_method && (
              <Badge variant="neutral">{PAYMENT_METHOD_LABEL[order.payment_method]}</Badge>
            )}
            <span className="ml-auto text-[11px] text-stone-400">
              Placed {formatDateTime(order.created_at)}
            </span>
          </div>

          {order.status === "AWAITING_PAYMENT" && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              <strong>Unpaid — not visible to the kitchen.</strong> Collect{" "}
              {formatPaise(order.total_paise)} at the counter and confirm the payment from the
              Counter tab.
            </div>
          )}

          <div className="grid gap-4 rounded-2xl border border-stone-200 bg-stone-50 p-4 sm:grid-cols-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-stone-400">
                Customer
              </p>
              <p className="mt-0.5 text-sm font-bold text-stone-900">{order.customer_name}</p>
              <p className="text-[11px] text-stone-500">
                {order.customer_phone ? `+91 ${order.customer_phone}` : "No phone"}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-stone-400">
                Service
              </p>
              <p className="mt-0.5 text-sm font-bold text-stone-900">
                {order.order_type === "DINE_IN" ? "Dine in" : "Takeaway"}
              </p>
              <p className="text-[11px] text-stone-500">
                {order.table_number ? `Table ${order.table_number}` : "No table set"}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-stone-400">
                Total
              </p>
              <p className="font-heading mt-0.5 text-lg font-black text-stone-900">
                {formatPaise(order.total_paise)}
              </p>
              <p className="text-[11px] text-stone-500">
                {order.paid_at ? `Paid ${formatDateTime(order.paid_at)}` : "Awaiting payment"}
              </p>
            </div>
          </div>

          <div>
            <h3 className="font-heading mb-2 text-sm font-black text-stone-900">Items</h3>
            <div className="divide-y divide-stone-100 rounded-xl border border-stone-200">
              {(order.order_items ?? []).map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-3 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-stone-800">
                      <span className="mr-1.5 font-black text-orange-600">{item.qty}×</span>
                      {item.name_snapshot}
                    </p>
                    <p className="text-[10px] text-stone-400">
                      {formatPaise(item.unit_price_paise)} each
                      {item.is_veg === null ? "" : item.is_veg ? " · Veg" : " · Non-veg"}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs font-bold text-stone-900">
                    {formatPaise(item.unit_price_paise * item.qty)}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-2 space-y-1 rounded-xl bg-stone-50 p-3 text-[11px] text-stone-500">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>{formatPaise(order.subtotal_paise)}</span>
              </div>
              <div className="flex justify-between">
                <span>GST</span>
                <span>{formatPaise(order.tax_paise)}</span>
              </div>
              <div className="flex justify-between border-t border-stone-200 pt-1 text-sm font-bold text-stone-900">
                <span>Total</span>
                <span>{formatPaise(order.total_paise)}</span>
              </div>
            </div>
          </div>

          {order.notes && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              <strong>Kitchen note:</strong> {order.notes}
            </div>
          )}

          {order.cancel_reason && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
              <strong>Cancellation:</strong> {order.cancel_reason}
              {order.payment_status === "REFUNDED" ? " · Payment marked refunded." : ""}
            </div>
          )}

          {reissued && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
              <p className="flex items-center gap-1.5 text-xs font-bold text-emerald-900">
                <CheckCircle2 className="h-4 w-4" /> New customer link
              </p>
              <div className="mt-2 flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded-lg bg-white p-2 font-mono text-[11px] text-stone-700">
                  {actionLink}
                </code>
                <button
                  onClick={() => void copyLink()}
                  className="rounded-lg border border-emerald-200 bg-white p-2 text-emerald-700 hover:bg-emerald-100"
                  aria-label="Copy new link"
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
                <a
                  href={actionLink}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg border border-emerald-200 bg-white p-2 text-emerald-700 hover:bg-emerald-100"
                  aria-label="Open new link"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
              <p className="mt-1.5 text-[10px] text-emerald-800">
                Share this link with the customer now. It cannot be shown again after closing.
              </p>
            </div>
          )}

          {staff?.role !== "kitchen" && events.length > 0 && (
            <div>
              <h3 className="font-heading mb-2 text-sm font-black text-stone-900">Audit trail</h3>
              <div className="space-y-2">
                {events.map((event) => (
                  <div
                    key={event.id}
                    className="flex items-start gap-2.5 rounded-xl border border-stone-200 bg-white p-2.5"
                  >
                    <span
                      className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${
                        event.event_type.includes("CANCEL")
                          ? "bg-rose-500"
                          : event.event_type.includes("PAYMENT")
                            ? "bg-emerald-500"
                            : "bg-sky-500"
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-1">
                        <p className="text-[11px] font-bold text-stone-800">
                          {EVENT_LABELS[event.event_type] ?? event.event_type}
                        </p>
                        <span className="text-[10px] text-stone-400">
                          {formatDateTime(event.created_at)}
                        </span>
                      </div>
                      {eventDetail(event) && (
                        <p className="text-[10px] text-stone-500">{eventDetail(event)}</p>
                      )}
                      <p className="text-[10px] text-stone-400">
                        {event.actor_role ? `By ${event.actor_role}` : "System"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {actionError && (
            <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {actionError}
            </div>
          )}

          {panel ? (
            <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
              <p className="text-xs font-bold text-stone-800">
                {panel === "refund" ? "Refund and cancel this paid order" : "Cancel this unpaid order"}
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-stone-500">
                {panel === "refund"
                  ? "This records a refund and cancels the order. Only refund money you have actually returned."
                  : "The customer will see the cancellation reason on their tracking page."}
              </p>
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                maxLength={240}
                rows={2}
                placeholder="Reason (required)"
                className="mt-2 w-full resize-none rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
              />
              <div className="mt-2 flex justify-end gap-2">
                <button
                  onClick={() => {
                    setPanel(null);
                    setReason("");
                    setActionError(null);
                  }}
                  disabled={busy}
                  className="rounded-lg px-3 py-1.5 text-[11px] font-semibold text-stone-500 hover:text-stone-800"
                >
                  Back
                </button>
                <button
                  onClick={() => void submitReasonAction()}
                  disabled={busy || reason.trim().length < 3}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-40 ${
                    panel === "refund" ? "bg-rose-600 hover:bg-rose-700" : "bg-rose-600 hover:bg-rose-700"
                  }`}
                >
                  {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
                  {panel === "refund" ? "Confirm refund" : "Confirm cancellation"}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-stone-100 pt-3">
              <div className="flex flex-wrap gap-2">
                {canManage && (
                  <button
                    onClick={() => void reissue()}
                    disabled={busy}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3 py-2 text-[11px] font-bold text-stone-600 shadow-sm hover:bg-stone-50 disabled:opacity-40"
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> Reissue customer link
                  </button>
                )}

                {canManage && order.status === "AWAITING_PAYMENT" && (
                  <button
                    onClick={() => setPanel("cancel")}
                    disabled={busy}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-40"
                  >
                    <XCircle className="h-3.5 w-3.5" /> Cancel unpaid
                  </button>
                )}

                {isDev && order.payment_status === "PAID" && order.status !== "CANCELLED" && (
                  <button
                    onClick={() => setPanel("refund")}
                    disabled={busy}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-40"
                  >
                    <ShieldAlert className="h-3.5 w-3.5" /> Refund (dev)
                  </button>
                )}
              </div>

              {canManage &&
                order.payment_status === "PAID" &&
                (order.status === "READY" || order.status === "SERVED") && (
                  <button
                    onClick={() => void runStatus("COMPLETED", `${order.order_code} completed.`)}
                    disabled={busy}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-[11px] font-bold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-40"
                  >
                    {busy ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    )}
                    Complete handover
                  </button>
                )}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
};
