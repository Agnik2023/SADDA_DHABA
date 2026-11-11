import React, { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  Download,
  Eye,
  FileSpreadsheet,
  History,
  RefreshCw,
  Search,
  TrendingUp,
  Wallet,
  XCircle,
} from "lucide-react";
import { useOrders } from "../../hooks/useMenu";
import { OrderDetailsModal } from "./OrderDetailsModal";
import { OrderStatusBadge, PaymentBadge } from "../common/Badge";
import {
  endOfDayExclusive,
  formatDateTime,
  startOfDaysAgo,
  startOfToday,
  toDateInputValue,
} from "../../lib/datetime";
import { formatPaise, formatRupeesPlain } from "../../lib/money";
import { PAYMENT_METHOD_LABEL } from "../../lib/orderStatus";
import { errorMessage } from "../../lib/errors";
import type { Order, OrderFilters, OrderStatus } from "../../types";

type RangeKey = "today" | "7d" | "30d" | "custom" | "all";
type StatusKey = "closed" | "all" | OrderStatus;

const STATUS_OPTIONS: Array<{ value: StatusKey; label: string }> = [
  { value: "closed", label: "Closed orders (completed + cancelled)" },
  { value: "all", label: "All statuses" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
  { value: "AWAITING_PAYMENT", label: "Awaiting payment" },
  { value: "QUEUED", label: "In queue" },
  { value: "PREPARING", label: "Preparing" },
  { value: "READY", label: "Ready" },
  { value: "SERVED", label: "Served" },
];

const CLOSED_STATUSES: OrderStatus[] = ["COMPLETED", "CANCELLED"];

function escapeCsv(value: string | number | null | undefined): string {
  const text = value === null || value === undefined ? "" : String(value);
  if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function downloadCsv(filename: string, rows: Array<Array<string | number>>): void {
  const csv = rows.map((row) => row.map(escapeCsv).join(",")).join("\r\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export const OrderHistory: React.FC = () => {
  const [range, setRange] = useState<RangeKey>("7d");
  const [customFrom, setCustomFrom] = useState(() => toDateInputValue(startOfDaysAgo(6)));
  const [customTo, setCustomTo] = useState(() => toDateInputValue(startOfToday()));
  const [statusFilter, setStatusFilter] = useState<StatusKey>("closed");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [detailsId, setDetailsId] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchInput.trim()), 350);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const filters = useMemo<OrderFilters>(() => {
    const next: OrderFilters = { limit: 500 };

    if (statusFilter === "closed") next.statuses = CLOSED_STATUSES;
    else if (statusFilter !== "all") next.statuses = [statusFilter];

    if (range === "today") {
      next.from = startOfToday().toISOString();
    } else if (range === "7d") {
      next.from = startOfDaysAgo(6).toISOString();
    } else if (range === "30d") {
      next.from = startOfDaysAgo(29).toISOString();
    } else if (range === "custom") {
      const from = new Date(`${customFrom}T00:00:00`);
      if (!Number.isNaN(from.getTime())) next.from = from.toISOString();
      const to = new Date(`${customTo}T00:00:00`);
      if (!Number.isNaN(to.getTime())) {
        next.to = endOfDayExclusive(customTo);
      }
    }

    if (search) next.search = search;
    return next;
  }, [range, customFrom, customTo, statusFilter, search]);

  const { data: orders = [], isLoading, isError, error, refetch, isFetching } = useOrders(filters);

  const metrics = useMemo(() => {
    let paidTotal = 0;
    let paidCount = 0;
    let refundedTotal = 0;
    let refundedCount = 0;
    let cancelledCount = 0;
    let itemCount = 0;

    for (const order of orders) {
      if (order.payment_status === "PAID") {
        paidTotal += order.total_paise;
        paidCount += 1;
      }
      if (order.payment_status === "REFUNDED") {
        refundedTotal += order.total_paise;
        refundedCount += 1;
      }
      if (order.status === "CANCELLED") cancelledCount += 1;
      itemCount += (order.order_items ?? []).reduce((sum, item) => sum + item.qty, 0);
    }

    return {
      paidTotal,
      paidCount,
      refundedTotal,
      refundedCount,
      cancelledCount,
      itemCount,
      averagePaid: paidCount > 0 ? Math.round(paidTotal / paidCount) : 0,
    };
  }, [orders]);

  const exportCsv = () => {
    if (orders.length === 0) return;

    const header = [
      "Order code",
      "Placed at",
      "Paid at",
      "Status",
      "Payment status",
      "Payment method",
      "Order type",
      "Table",
      "Customer",
      "Phone",
      "Items",
      "Subtotal (INR)",
      "GST (INR)",
      "Total (INR)",
      "Notes",
      "Cancel reason",
    ];

    const rows = orders.map((order: Order) => [
      order.order_code,
      formatDateTime(order.created_at),
      order.paid_at ? formatDateTime(order.paid_at) : "",
      order.status,
      order.payment_status,
      order.payment_method ? PAYMENT_METHOD_LABEL[order.payment_method] : "",
      order.order_type,
      order.table_number ?? "",
      order.customer_name,
      order.customer_phone ?? "",
      (order.order_items ?? [])
        .map((item) => `${item.qty}x ${item.name_snapshot}`)
        .join("; "),
      formatRupeesPlain(order.subtotal_paise),
      formatRupeesPlain(order.tax_paise),
      formatRupeesPlain(order.total_paise),
      order.notes ?? "",
      order.cancel_reason ?? "",
    ]);

    const stamp = new Date().toISOString().slice(0, 10);
    downloadCsv(`sadda-dhaba-orders-${stamp}.csv`, [header, ...rows]);
  };

  const rangeLabel =
    range === "today"
      ? "Today"
      : range === "7d"
        ? "Last 7 days"
        : range === "30d"
          ? "Last 30 days"
          : range === "custom"
            ? `${customFrom} → ${customTo}`
            : "All time";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-orange-600">
            History
          </p>
          <h1 className="font-heading text-2xl font-black tracking-tight text-stone-900">
            Orders & revenue
          </h1>
          <p className="mt-0.5 text-xs text-stone-500">
            {rangeLabel} · {orders.length} order{orders.length === 1 ? "" : "s"} loaded
            {orders.length >= 500 ? " (limited to the latest 500)" : ""}
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
            onClick={exportCsv}
            disabled={orders.length === 0}
            className="inline-flex items-center gap-1.5 rounded-xl bg-stone-900 px-3.5 py-2.5 text-xs font-bold text-white shadow-lg shadow-stone-900/20 transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Download className="h-4 w-4" /> Export CSV
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
          <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
            <Wallet className="h-3 w-3" /> Paid revenue
          </p>
          <p className="font-heading mt-1 text-2xl font-black text-emerald-900">
            {formatPaise(metrics.paidTotal)}
          </p>
          <p className="text-[10px] text-emerald-700">
            {metrics.paidCount} paid order{metrics.paidCount === 1 ? "" : "s"}
          </p>
        </div>
        <div className="rounded-2xl border border-sky-200 bg-sky-50 p-3">
          <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-sky-700">
            <TrendingUp className="h-3 w-3" /> Average ticket
          </p>
          <p className="font-heading mt-1 text-2xl font-black text-sky-900">
            {formatPaise(metrics.averagePaid)}
          </p>
          <p className="text-[10px] text-sky-700">
            {metrics.itemCount} item{metrics.itemCount === 1 ? "" : "s"} sold
          </p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3">
          <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-amber-700">
            <XCircle className="h-3 w-3" /> Refunded
          </p>
          <p className="font-heading mt-1 text-2xl font-black text-amber-900">
            {formatPaise(metrics.refundedTotal)}
          </p>
          <p className="text-[10px] text-amber-700">
            {metrics.refundedCount} refund{metrics.refundedCount === 1 ? "" : "s"}
          </p>
        </div>
        <div className="rounded-2xl border border-stone-200 bg-white p-3">
          <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-stone-500">
            <CheckCircle2 className="h-3 w-3" /> Cancelled
          </p>
          <p className="font-heading mt-1 text-2xl font-black text-stone-900">
            {metrics.cancelledCount}
          </p>
          <p className="text-[10px] text-stone-400">
            {orders.length} order{orders.length === 1 ? "" : "s"} in view
          </p>
        </div>
      </div>

      <div className="space-y-2 rounded-2xl border border-stone-200 bg-white p-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-1.5">
          <CalendarDays className="mr-1 h-4 w-4 text-stone-400" />
          {(
            [
              { key: "today", label: "Today" },
              { key: "7d", label: "7 days" },
              { key: "30d", label: "30 days" },
              { key: "all", label: "All time" },
            ] as Array<{ key: RangeKey; label: string }>
          ).map((option) => (
            <button
              key={option.key}
              onClick={() => setRange(option.key)}
              className={`rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition ${
                range === option.key
                  ? "bg-stone-900 text-white"
                  : "border border-stone-200 bg-stone-50 text-stone-600 hover:bg-stone-100"
              }`}
            >
              {option.label}
            </button>
          ))}
          <button
            onClick={() => setRange("custom")}
            className={`rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition ${
              range === "custom"
                ? "bg-stone-900 text-white"
                : "border border-stone-200 bg-stone-50 text-stone-600 hover:bg-stone-100"
            }`}
          >
            Custom
          </button>
        </div>

        {range === "custom" && (
          <div className="flex flex-wrap items-center gap-2 border-t border-stone-100 pt-2">
            <label className="text-[10px] font-bold uppercase tracking-wide text-stone-500">
              From
              <input
                type="date"
                value={customFrom}
                onChange={(event) => setCustomFrom(event.target.value)}
                className="ml-1.5 rounded-lg border border-stone-200 bg-stone-50 px-2 py-1.5 text-xs font-semibold text-stone-700"
              />
            </label>
            <label className="text-[10px] font-bold uppercase tracking-wide text-stone-500">
              To
              <input
                type="date"
                value={customTo}
                onChange={(event) => setCustomTo(event.target.value)}
                className="ml-1.5 rounded-lg border border-stone-200 bg-stone-50 px-2 py-1.5 text-xs font-semibold text-stone-700"
              />
            </label>
          </div>
        )}

        <div className="flex flex-col gap-2 border-t border-stone-100 pt-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search order code, customer name or phone…"
              className="w-full rounded-xl border border-stone-200 bg-stone-50 py-2 pl-10 pr-4 text-xs focus:border-orange-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/30"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as StatusKey)}
            className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs font-semibold text-stone-700"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
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

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((index) => (
            <div key={index} className="h-20 animate-pulse rounded-2xl bg-white" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-stone-200 bg-white p-10 text-center text-stone-400">
          <History className="mx-auto h-10 w-10 stroke-1" />
          <p className="mt-2 text-sm font-bold text-stone-700">No orders in this view</p>
          <p className="text-xs">Change the date range, status filter or search term.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-xs">
              <thead className="border-b border-stone-200 bg-stone-50 text-[10px] uppercase tracking-wide text-stone-500">
                <tr>
                  <th className="px-3 py-2.5 font-bold">Order</th>
                  <th className="px-3 py-2.5 font-bold">Placed</th>
                  <th className="px-3 py-2.5 font-bold">Customer</th>
                  <th className="px-3 py-2.5 font-bold">Type</th>
                  <th className="px-3 py-2.5 font-bold">Items</th>
                  <th className="px-3 py-2.5 font-bold">Status</th>
                  <th className="px-3 py-2.5 text-right font-bold">Total</th>
                  <th className="px-3 py-2.5 font-bold" />
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {orders.map((order) => {
                  const itemCount = (order.order_items ?? []).reduce(
                    (sum, item) => sum + item.qty,
                    0
                  );
                  return (
                    <tr key={order.id} className="transition hover:bg-stone-50/70">
                      <td className="whitespace-nowrap px-3 py-2.5">
                        <span className="font-mono font-black text-stone-900">
                          {order.order_code}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-stone-500">
                        {formatDateTime(order.created_at)}
                      </td>
                      <td className="px-3 py-2.5">
                        <p className="font-semibold text-stone-800">{order.customer_name}</p>
                        <p className="text-[10px] text-stone-400">
                          {order.customer_phone ? `+91 ${order.customer_phone}` : "No phone"}
                        </p>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-stone-600">
                        {order.order_type === "DINE_IN" ? "Dine-in" : "Takeaway"}
                        {order.table_number ? ` · T${order.table_number}` : ""}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-stone-600">
                        {itemCount} item{itemCount === 1 ? "" : "s"}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex flex-wrap items-center gap-1">
                          <OrderStatusBadge status={order.status} />
                          <PaymentBadge status={order.payment_status} />
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right font-heading text-sm font-black text-stone-900">
                        {formatPaise(order.total_paise)}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <button
                          onClick={() => setDetailsId(order.id)}
                          className="inline-flex items-center gap-1 rounded-lg border border-stone-200 bg-white px-2 py-1.5 text-[10px] font-bold text-stone-600 shadow-sm transition hover:bg-stone-100 hover:text-stone-900"
                        >
                          <Eye className="h-3 w-3" /> View
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-stone-100 bg-stone-50 px-3 py-2 text-[10px] text-stone-400">
            <span className="flex items-center gap-1.5">
              <FileSpreadsheet className="h-3.5 w-3.5" />
              CSV export includes the orders currently loaded in this view.
            </span>
            <span>{isFetching ? "Refreshing…" : "Live data from Supabase"}</span>
          </div>
        </div>
      )}

      <OrderDetailsModal orderId={detailsId} onClose={() => setDetailsId(null)} />
    </div>
  );
};
