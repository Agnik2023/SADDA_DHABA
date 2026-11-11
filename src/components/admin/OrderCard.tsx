import React from "react";
import {
  ArrowRight,
  Banknote,
  ChefHat,
  Clock,
  Eye,
  Phone,
  Timer,
  XCircle,
} from "lucide-react";
import type { Order, OrderStatus } from "../../types";
import { Badge, OrderStatusBadge, OrderTypeBadge, PaymentBadge } from "../common/Badge";
import {
  PAYMENT_METHOD_LABEL,
  nextCounterAction,
  nextKitchenAction,
} from "../../lib/orderStatus";
import { formatElapsed, minutesSince } from "../../lib/datetime";
import { formatPaise } from "../../lib/money";

interface OrderCardProps {
  order: Order;
  mode: "counter" | "kitchen";
  busy?: boolean;
  onView: (order: Order) => void;
  onCollect?: (order: Order) => void;
  onStatus?: (order: Order, status: OrderStatus) => void;
  onCancel?: (order: Order) => void;
}

export const OrderCard: React.FC<OrderCardProps> = ({
  order,
  mode,
  busy = false,
  onView,
  onCollect,
  onStatus,
  onCancel,
}) => {
  const isUnpaid = order.status === "AWAITING_PAYMENT";
  const minutes = minutesSince(order.created_at);
  const isUrgent = isUnpaid && minutes >= 15;
  const action = mode === "kitchen" ? nextKitchenAction(order) : nextCounterAction(order);
  const items = order.order_items ?? [];
  const itemCount = items.reduce((sum, item) => sum + item.qty, 0);

  const accent =
    mode === "kitchen"
      ? order.status === "QUEUED"
        ? "border-l-sky-500"
        : order.status === "PREPARING"
          ? "border-l-amber-500"
          : "border-l-emerald-500"
      : isUnpaid
        ? isUrgent
          ? "border-l-rose-500"
          : "border-l-amber-500"
        : "border-l-sky-500";

  return (
    <article
      className={`overflow-hidden rounded-2xl border border-stone-200 border-l-4 bg-white shadow-sm ${accent} ${
        isUnpaid && isUrgent ? "ring-1 ring-rose-200" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3 border-b border-stone-100 bg-stone-50/70 px-4 py-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-heading text-lg font-black tracking-tight text-stone-900">
              {order.order_code}
            </h3>
            {isUnpaid && (
              <span className="flex items-center gap-1 rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wide text-amber-800">
                <Banknote className="h-3 w-3" /> Collect payment
              </span>
            )}
          </div>
          <p
            className={`mt-0.5 flex items-center gap-1 text-[11px] font-semibold ${
              isUnpaid && isUrgent ? "text-rose-600" : "text-stone-400"
            }`}
          >
            <Clock className="h-3 w-3" /> {formatElapsed(order.created_at)}
            <span className="text-stone-300">·</span>
            <span className="font-normal">{order.customer_name}</span>
          </p>
        </div>
        <div className="text-right">
          <p className="font-heading text-xl font-black text-stone-900">
            {formatPaise(order.total_paise)}
          </p>
          <p className="text-[10px] font-semibold text-stone-400">
            {itemCount} item{itemCount === 1 ? "" : "s"}
          </p>
        </div>
      </div>

      <div className="space-y-3 px-4 py-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <OrderTypeBadge orderType={order.order_type} tableNumber={order.table_number} />
          <OrderStatusBadge status={order.status} />
          <PaymentBadge status={order.payment_status} />
          {order.payment_method && (
            <Badge variant="neutral">{PAYMENT_METHOD_LABEL[order.payment_method]}</Badge>
          )}
        </div>

        {mode === "kitchen" ? (
          <div className="space-y-1.5">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex items-start justify-between gap-2 text-sm text-stone-800"
              >
                <span className="font-semibold">
                  <span className="mr-1.5 inline-block min-w-[1.6rem] rounded bg-orange-100 px-1 text-center font-black text-orange-700">
                    {item.qty}×
                  </span>
                  {item.name_snapshot}
                </span>
                {item.is_veg !== null && (
                  <span
                    className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                      item.is_veg ? "bg-emerald-500" : "bg-rose-500"
                    }`}
                    title={item.is_veg ? "Veg" : "Non-veg"}
                  />
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="line-clamp-2 text-xs leading-relaxed text-stone-500">
            {items
              .slice(0, 4)
              .map((item) => `${item.qty}× ${item.name_snapshot}`)
              .join(" · ")}
            {items.length > 4 ? ` · +${items.length - 4} more` : ""}
          </p>
        )}

        {order.customer_phone && mode === "counter" && (
          <p className="flex items-center gap-1.5 text-[11px] text-stone-400">
            <Phone className="h-3 w-3" /> +91 {order.customer_phone}
          </p>
        )}

        {order.notes && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] font-semibold text-amber-900">
            <span className="mr-1 font-black uppercase tracking-wide text-amber-700">Note:</span>
            {order.notes}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-stone-100 bg-stone-50/50 px-4 py-2.5">
        <button
          onClick={() => onView(order)}
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] font-bold text-stone-500 transition hover:bg-stone-200/60 hover:text-stone-800"
        >
          <Eye className="h-3.5 w-3.5" /> Details
        </button>

        <div className="flex items-center gap-1.5">
          {mode === "counter" && isUnpaid && onCancel && (
            <button
              onClick={() => onCancel(order)}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-bold text-stone-400 transition hover:bg-rose-50 hover:text-rose-600"
            >
              <XCircle className="h-3.5 w-3.5" /> Cancel
            </button>
          )}

          {mode === "counter" && isUnpaid && onCollect && (
            <button
              onClick={() => onCollect(order)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-[11px] font-black text-white shadow-sm transition hover:bg-amber-600"
            >
              <Banknote className="h-3.5 w-3.5" /> Collect payment
            </button>
          )}

          {action && onStatus && (
            <button
              onClick={() => onStatus(order, action.status)}
              disabled={busy}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-black text-white shadow-sm transition disabled:opacity-50 ${
                mode === "kitchen"
                  ? "bg-stone-900 hover:bg-stone-800"
                  : "bg-emerald-600 hover:bg-emerald-700"
              }`}
            >
              {busy ? (
                <Timer className="h-3.5 w-3.5 animate-spin" />
              ) : mode === "kitchen" ? (
                <ChefHat className="h-3.5 w-3.5" />
              ) : (
                <ArrowRight className="h-3.5 w-3.5" />
              )}
              {action.label}
            </button>
          )}

          {mode === "kitchen" && !action && order.status !== "READY" && order.status !== "SERVED" && (
            <span className="text-[10px] font-semibold text-stone-400">Waiting</span>
          )}
        </div>
      </div>
    </article>
  );
};
