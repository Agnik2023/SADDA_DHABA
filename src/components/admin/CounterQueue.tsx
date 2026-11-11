import React, { useMemo, useState } from "react";
import {
  AlertCircle,
  Banknote,
  CheckCircle2,
  ClipboardList,
  Loader2,
  PlusCircle,
  RefreshCw,
  Search,
  ShieldCheck,
  Timer,
  XCircle,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useOrders } from "../../hooks/useMenu";
import { useToast } from "../../context/ToastContext";
import { cancelOrder, updateOrderStatus } from "../../lib/api";
import { errorMessage } from "../../lib/errors";
import { formatPaise } from "../../lib/money";
import type { Order, OrderStatus } from "../../types";
import { OrderCard } from "./OrderCard";
import { CollectPaymentModal } from "./CollectPaymentModal";
import { OrderDetailsModal } from "./OrderDetailsModal";
import { AddOrderModal } from "./AddOrderModal";
import { Modal } from "../common/Modal";
import { PaymentBadge } from "../common/Badge";

const OPEN_STATUSES: OrderStatus[] = [
  "AWAITING_PAYMENT",
  "QUEUED",
  "PREPARING",
  "READY",
  "SERVED",
];

const STATUS_ORDER: Record<string, number> = {
  QUEUED: 0,
  PREPARING: 1,
  READY: 2,
  SERVED: 3,
};

export const CounterQueue: React.FC = () => {
  const { data: orders = [], isLoading, isError, error, refetch, isFetching } = useOrders({
    statuses: OPEN_STATUSES,
    limit: 300,
  });
  const { notify } = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [collecting, setCollecting] = useState<Order | null>(null);
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<Order | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelBusy, setCancelBusy] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [statusBusyId, setStatusBusyId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return orders;
    return orders.filter(
      (order) =>
        order.order_code.toLowerCase().includes(term) ||
        order.customer_name.toLowerCase().includes(term) ||
        (order.customer_phone ?? "").includes(term)
    );
  }, [orders, search]);

  const unpaid = useMemo(
    () =>
      filtered
        .filter((order) => order.status === "AWAITING_PAYMENT")
        .sort(
          (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        ),
    [filtered]
  );

  const active = useMemo(
    () =>
      filtered
        .filter((order) => order.status !== "AWAITING_PAYMENT")
        .sort((a, b) => {
          const statusDiff = (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9);
          if (statusDiff !== 0) return statusDiff;
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        }),
    [filtered]
  );

  const unpaidTotal = unpaid.reduce((sum, order) => sum + order.total_paise, 0);
  const readyCount = active.filter(
    (order) => order.status === "READY" || order.status === "SERVED"
  ).length;

  const changeStatus = async (order: Order, status: OrderStatus) => {
    if (statusBusyId) return;
    setStatusBusyId(order.id);
    try {
      await updateOrderStatus(order.id, status);
      notify(
        status === "COMPLETED"
          ? `${order.order_code} completed.`
          : `${order.order_code} moved to ${status.toLowerCase()}.`,
        "success"
      );
      await queryClient.invalidateQueries({ queryKey: ["orders"] });
      await queryClient.invalidateQueries({ queryKey: ["order-details"] });
    } catch (err) {
      notify(errorMessage(err), "error");
    } finally {
      setStatusBusyId(null);
    }
  };

  const confirmCancel = async () => {
    if (!cancelling || cancelBusy) return;
    if (cancelReason.trim().length < 3) {
      setCancelError("Enter a reason of at least 3 characters.");
      return;
    }
    setCancelBusy(true);
    setCancelError(null);
    try {
      await cancelOrder(cancelling.id, cancelReason.trim());
      notify(`${cancelling.order_code} cancelled.`, "success");
      await queryClient.invalidateQueries({ queryKey: ["orders"] });
      await queryClient.invalidateQueries({ queryKey: ["order-details"] });
      setCancelling(null);
      setCancelReason("");
    } catch (err) {
      setCancelError(errorMessage(err));
    } finally {
      setCancelBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-orange-600">
            Counter
          </p>
          <h1 className="font-heading text-2xl font-black tracking-tight text-stone-900">
            Payment & order queue
          </h1>
          <p className="mt-0.5 text-xs text-stone-500">
            Verify the money, then confirm payment. Only confirmed orders go to the kitchen.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void refetch()}
            className="rounded-xl border border-stone-200 bg-white p-2.5 text-stone-500 shadow-sm transition hover:text-stone-800"
            title="Refresh"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={() => setAddOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-stone-900 px-3.5 py-2.5 text-xs font-bold text-white shadow-lg shadow-stone-900/20 transition hover:bg-stone-800"
          >
            <PlusCircle className="h-4 w-4" /> Walk-in order
          </button>
        </div>
      </div>

      <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-[11px] leading-relaxed text-emerald-900">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          <strong>Payment gate:</strong> never press “Collect payment” before cash, UPI, or card is
          actually received. The action is logged against your account and sends the ticket to the
          kitchen immediately.
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3">
          <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-amber-700">
            <Banknote className="h-3 w-3" /> Awaiting payment
          </p>
          <p className="font-heading mt-1 text-2xl font-black text-amber-900">{unpaid.length}</p>
          <p className="text-[10px] text-amber-700">{formatPaise(unpaidTotal)} pending</p>
        </div>
        <div className="rounded-2xl border border-sky-200 bg-sky-50 p-3">
          <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-sky-700">
            <ClipboardList className="h-3 w-3" /> In progress
          </p>
          <p className="font-heading mt-1 text-2xl font-black text-sky-900">{active.length}</p>
          <p className="text-[10px] text-sky-700">paid and moving</p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
          <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
            <CheckCircle2 className="h-3 w-3" /> For handover
          </p>
          <p className="font-heading mt-1 text-2xl font-black text-emerald-900">{readyCount}</p>
          <p className="text-[10px] text-emerald-700">ready / served</p>
        </div>
        <div className="rounded-2xl border border-stone-200 bg-white p-3">
          <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-stone-500">
            <Timer className="h-3 w-3" /> Live
          </p>
          <p className="font-heading mt-1 flex items-center gap-1.5 text-sm font-black text-stone-900">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" /> Auto-updating
          </p>
          <p className="text-[10px] text-stone-400">Realtime + 30s refresh</p>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search order code, customer name or phone…"
          className="w-full rounded-xl border border-stone-200 bg-white py-2.5 pl-10 pr-4 text-xs shadow-sm focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
        />
      </div>

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

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-heading flex items-center gap-2 text-base font-black text-stone-900">
            <Banknote className="h-4 w-4 text-amber-600" /> Awaiting payment
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">
              {unpaid.length}
            </span>
          </h2>
          {unpaid.length > 0 && (
            <span className="text-[11px] text-stone-400">Oldest first</span>
          )}
        </div>

        {isLoading ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {[0, 1].map((index) => (
              <div key={index} className="h-52 animate-pulse rounded-2xl bg-white" />
            ))}
          </div>
        ) : unpaid.length === 0 ? (
          <div className="flex items-center gap-3 rounded-2xl border border-dashed border-stone-200 bg-white p-5 text-sm text-stone-500">
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            No unpaid orders. The counter is clear.
          </div>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {unpaid.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                mode="counter"
                busy={statusBusyId === order.id}
                onView={(value) => setDetailsId(value.id)}
                onCollect={setCollecting}
                onStatus={(value, status) => void changeStatus(value, status)}
                onCancel={(value) => {
                  setCancelling(value);
                  setCancelReason("");
                  setCancelError(null);
                }}
              />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-heading flex items-center gap-2 text-base font-black text-stone-900">
            <ClipboardList className="h-4 w-4 text-sky-600" /> Paid & in progress
            <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-bold text-sky-800">
              {active.length}
            </span>
          </h2>
          <span className="text-[11px] text-stone-400">Kitchen sees these too</span>
        </div>

        {active.length === 0 && !isLoading ? (
          <div className="rounded-2xl border border-dashed border-stone-200 bg-white p-5 text-sm text-stone-500">
            No paid orders in progress.
          </div>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {active.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                mode="counter"
                busy={statusBusyId === order.id}
                onView={(value) => setDetailsId(value.id)}
                onStatus={(value, status) => void changeStatus(value, status)}
              />
            ))}
          </div>
        )}
      </section>

      <CollectPaymentModal order={collecting} onClose={() => setCollecting(null)} />
      <OrderDetailsModal
        orderId={detailsId}
        onClose={() => {
          setDetailsId(null);
          void queryClient.invalidateQueries({ queryKey: ["orders"] });
        }}
      />
      <AddOrderModal
        isOpen={addOpen}
        onClose={() => setAddOpen(false)}
        onCreated={async (result) => {
          notify(
            `${result.order_code} created · ${formatPaise(result.total_paise)} · ${
              result.payment_status === "PAID" ? "paid, sent to kitchen" : "awaiting payment"
            }.`,
            "success"
          );
          await queryClient.invalidateQueries({ queryKey: ["orders"] });
        }}
      />

      <Modal
        isOpen={Boolean(cancelling)}
        onClose={() => {
          if (!cancelBusy) setCancelling(null);
        }}
        title={
          <span className="flex items-center gap-2 text-rose-700">
            <XCircle className="h-5 w-5" /> Cancel unpaid order
          </span>
        }
        maxWidth="md"
      >
        {cancelling && (
          <div className="space-y-4">
            <div className="rounded-xl bg-stone-50 p-3 text-xs text-stone-600">
              <p className="font-bold text-stone-900">
                {cancelling.order_code} · {formatPaise(cancelling.total_paise)}
              </p>
              <p className="mt-1">
                {cancelling.customer_name} ·{" "}
                {cancelling.order_type === "DINE_IN" ? "Dine-in" : "Takeaway"}
              </p>
              <div className="mt-2">
                <PaymentBadge status={cancelling.payment_status} />
              </div>
            </div>
            <p className="text-xs leading-relaxed text-stone-500">
              This is only for unpaid orders. The customer’s tracking page will show the reason.
            </p>
            <textarea
              value={cancelReason}
              onChange={(event) => setCancelReason(event.target.value)}
              rows={2}
              maxLength={240}
              placeholder="Reason (required), e.g. guest left without paying"
              className="w-full resize-none rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-xs focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-500/30"
            />
            {cancelError && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-xs font-semibold text-rose-700">
                {cancelError}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setCancelling(null)}
                disabled={cancelBusy}
                className="rounded-xl px-4 py-2.5 text-xs font-semibold text-stone-600 hover:text-stone-900 disabled:opacity-40"
              >
                Back
              </button>
              <button
                onClick={() => void confirmCancel()}
                disabled={cancelBusy || cancelReason.trim().length < 3}
                className="flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2.5 text-xs font-bold text-white shadow disabled:opacity-40"
              >
                {cancelBusy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <XCircle className="h-4 w-4" />
                )}
                Confirm cancellation
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
