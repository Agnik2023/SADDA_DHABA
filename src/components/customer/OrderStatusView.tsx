import React, { useEffect } from "react";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  ChefHat,
  Clock,
  Copy,
  Loader2,
  ReceiptText,
  RefreshCw,
  ShieldCheck,
  Utensils,
  XCircle,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useOrderByToken } from "../../hooks/useMenu";
import { Badge, OrderStatusBadge, OrderTypeBadge, PaymentBadge } from "../common/Badge";
import { ORDER_STATUS_LABEL, PAYMENT_METHOD_LABEL, orderTimeline } from "../../lib/orderStatus";
import { formatDateTime, formatElapsed } from "../../lib/datetime";
import { formatPaise } from "../../lib/money";
import { saveLastOrderToken } from "../../lib/customerToken";
import { errorMessage } from "../../lib/errors";
import { useToast } from "../../context/ToastContext";
import type { OrderStatus } from "../../types";

export const OrderStatusView: React.FC<{ token: string }> = ({ token }) => {
  const { data: order, isLoading, isError, error, refetch, isFetching } = useOrderByToken(token);
  const { notify } = useToast();

  useEffect(() => {
    saveLastOrderToken(token);
  }, [token]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/order#${token}`);
      notify("Order link copied.", "success");
    } catch {
      notify("Could not copy the link. Please copy it from the address bar.", "error");
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-stone-500">
        <Loader2 className="h-7 w-7 animate-spin text-orange-600" />
        <p className="text-sm font-semibold">Finding your order…</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="mx-auto max-w-lg p-4">
        <div className="rounded-3xl border border-rose-200 bg-white p-6 text-center shadow-sm">
          <AlertCircle className="mx-auto h-10 w-10 text-rose-500" />
          <h2 className="font-heading mt-3 text-lg font-black text-stone-900">
            Could not load the order
          </h2>
          <p className="mt-1 text-sm text-stone-500">{errorMessage(error)}</p>
          <button
            onClick={() => void refetch()}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-stone-900 px-4 py-2.5 text-xs font-bold text-white"
          >
            <RefreshCw className="h-4 w-4" /> Try again
          </button>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="mx-auto max-w-lg p-4">
        <div className="rounded-3xl border border-stone-200 bg-white p-8 text-center shadow-sm">
          <ReceiptText className="mx-auto h-12 w-12 stroke-1 text-stone-300" />
          <h2 className="font-heading mt-3 text-xl font-black text-stone-900">
            Order not found
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-stone-500">
            This order link is invalid or has been replaced by the counter. Ask staff for a new
            tracking link, or show them your order code.
          </p>
          <Link
            to="/"
            className="mt-5 inline-flex items-center gap-1.5 rounded-xl bg-orange-600 px-5 py-2.5 text-xs font-bold text-white shadow hover:bg-orange-700"
          >
            <Utensils className="h-4 w-4" /> Back to the menu
          </Link>
        </div>
      </div>
    );
  }

  const timeline = orderTimeline(order);
  const isCancelled = order.status === "CANCELLED";
  const isAwaitingPayment = order.status === "AWAITING_PAYMENT";

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4 pb-12">
      <div className="overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-sm">
        <div className="border-b border-stone-100 bg-stone-50 px-5 py-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-stone-400">
                Order code
              </p>
              <h1 className="font-heading text-3xl font-black tracking-tight text-stone-900">
                {order.order_code}
              </h1>
              <p className="mt-1 text-xs text-stone-500">
                Placed {formatElapsed(order.created_at)} · {formatDateTime(order.created_at)}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <OrderStatusBadge status={order.status} />
              <PaymentBadge status={order.payment_status} />
            </div>
          </div>
        </div>

        {isAwaitingPayment && (
          <div className="border-b border-amber-200 bg-amber-50 px-5 py-4">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
              <div>
                <p className="text-sm font-black text-amber-900">
                  Pay {formatPaise(order.total_paise)} at the counter
                </p>
                <p className="mt-1 text-xs leading-relaxed text-amber-800">
                  Show the code <strong>{order.order_code}</strong> to counter staff. The kitchen
                  will not start preparing this order until the payment is verified.
                </p>
              </div>
            </div>
          </div>
        )}

        {isCancelled && (
          <div className="border-b border-rose-200 bg-rose-50 px-5 py-4">
            <div className="flex items-start gap-3">
              <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
              <div>
                <p className="text-sm font-black text-rose-900">This order was cancelled</p>
                <p className="mt-1 text-xs leading-relaxed text-rose-800">
                  {order.cancel_reason || "Please ask counter staff for details."}
                  {order.payment_status === "REFUNDED"
                    ? " The payment has been recorded as refunded."
                    : ""}
                </p>
              </div>
            </div>
          </div>
        )}

        {!isAwaitingPayment && !isCancelled && (
          <div className="border-b border-emerald-200 bg-emerald-50 px-5 py-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
              <div>
                <p className="text-sm font-black text-emerald-900">
                  Payment confirmed
                  {order.payment_method
                    ? ` · ${PAYMENT_METHOD_LABEL[order.payment_method]}`
                    : ""}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-emerald-800">
                  {order.status === "QUEUED"
                    ? "Your order is in the kitchen queue."
                    : order.status === "PREPARING"
                      ? "The kitchen is preparing your food."
                      : order.status === "READY"
                        ? "Your takeaway order is ready at the counter."
                        : order.status === "SERVED"
                          ? "Your food has been served. Enjoy your meal!"
                          : "Thank you for dining with SADDA DHABA."}
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="px-5 py-5">
          {isCancelled ? (
            <div className="rounded-2xl bg-stone-50 p-4 text-center text-xs text-stone-500">
              The status timeline is not available for cancelled orders.
            </div>
          ) : (
            <div className="space-y-0">
              {timeline.map((step, index) => {
                const Icon = step.done || step.current ? Check : Clock;
                const isLast = index === timeline.length - 1;
                return (
                  <div key={step.key} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div
                        className={`flex h-8 w-8 items-center justify-center rounded-full border-2 ${
                          step.done
                            ? "border-emerald-600 bg-emerald-600 text-white"
                            : step.current
                              ? "border-orange-500 bg-orange-50 text-orange-600"
                              : "border-stone-200 bg-white text-stone-300"
                        }`}
                      >
                        {step.current ? (
                          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-orange-500" />
                        ) : (
                          <Icon className="h-4 w-4" />
                        )}
                      </div>
                      {!isLast && (
                        <div
                          className={`h-8 w-0.5 ${
                            step.done ? "bg-emerald-300" : "bg-stone-200"
                          }`}
                        />
                      )}
                    </div>
                    <div className={`pb-4 ${isLast ? "pb-0" : ""}`}>
                      <p
                        className={`text-sm font-bold ${
                          step.current ? "text-orange-700" : step.done ? "text-stone-900" : "text-stone-400"
                        }`}
                      >
                        {step.label}
                      </p>
                      <p className="text-[11px] text-stone-400">{step.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="font-heading flex items-center gap-2 text-base font-black text-stone-900">
            <ChefHat className="h-4 w-4 text-orange-600" /> Your items
          </h2>
          <OrderTypeBadge orderType={order.order_type} tableNumber={order.table_number} />
        </div>

        <div className="mt-4 space-y-2.5">
          {order.items.map((item, index) => (
            <div
              key={`${item.name}-${index}`}
              className="flex items-start justify-between gap-3 text-sm"
            >
              <div>
                <p className="font-semibold text-stone-800">
                  <span className="mr-1.5 font-bold text-orange-600">{item.qty}×</span>
                  {item.name}
                </p>
                <p className="text-[11px] text-stone-400">
                  {formatPaise(item.unit_price_paise)} each
                  {item.is_veg === null ? "" : item.is_veg ? " · Veg" : " · Non-veg"}
                </p>
              </div>
              <span className="shrink-0 font-semibold text-stone-900">
                {formatPaise(item.unit_price_paise * item.qty)}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-4 space-y-1.5 border-t border-stone-100 pt-4 text-xs text-stone-600">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span className="font-semibold text-stone-900">
              {formatPaise(order.subtotal_paise)}
            </span>
          </div>
          <div className="flex justify-between">
            <span>GST</span>
            <span className="font-semibold text-stone-900">{formatPaise(order.tax_paise)}</span>
          </div>
          <div className="flex items-baseline justify-between border-t border-stone-100 pt-2">
            <span className="font-bold text-stone-900">Total</span>
            <span className="font-heading text-xl font-black text-orange-600">
              {formatPaise(order.total_paise)}
            </span>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-stone-200 bg-white p-5 text-xs shadow-sm">
        <h2 className="font-heading text-base font-black text-stone-900">Order details</h2>
        <dl className="mt-3 grid gap-2.5 sm:grid-cols-2">
          <div>
            <dt className="text-stone-400">Name</dt>
            <dd className="font-semibold text-stone-800">{order.customer_name}</dd>
          </div>
          <div>
            <dt className="text-stone-400">Order type</dt>
            <dd className="font-semibold text-stone-800">
              {order.order_type === "DINE_IN" ? "Dine in" : "Takeaway"}
              {order.table_number ? ` · Table ${order.table_number}` : ""}
            </dd>
          </div>
          <div>
            <dt className="text-stone-400">Placed</dt>
            <dd className="font-semibold text-stone-800">{formatDateTime(order.created_at)}</dd>
          </div>
          <div>
            <dt className="text-stone-400">Paid</dt>
            <dd className="font-semibold text-stone-800">
              {order.paid_at ? formatDateTime(order.paid_at) : "Not yet"}
            </dd>
          </div>
          {order.notes && (
            <div className="sm:col-span-2">
              <dt className="text-stone-400">Kitchen notes</dt>
              <dd className="font-semibold text-stone-800">{order.notes}</dd>
            </div>
          )}
        </dl>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[11px] text-stone-400">
          {isFetching ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Updating…
            </>
          ) : (
            <>
              <RefreshCw className="h-3.5 w-3.5" /> Updates automatically every 10 seconds
            </>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => void copyLink()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs font-bold text-stone-700 shadow-sm transition hover:bg-stone-50"
          >
            <Copy className="h-3.5 w-3.5" /> Copy link
          </button>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 rounded-xl bg-stone-900 px-3 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-stone-800"
          >
            <Utensils className="h-3.5 w-3.5" /> Order again
          </Link>
        </div>
      </div>

      {order.status === "COMPLETED" && (
        <div className="rounded-2xl bg-emerald-50 p-4 text-center text-xs font-semibold text-emerald-800">
          <Badge variant="success" className="mb-2">
            {ORDER_STATUS_LABEL[order.status]}
          </Badge>
          <p>Thank you for eating at SADDA DHABA. See you again!</p>
        </div>
      )}
    </div>
  );
};
