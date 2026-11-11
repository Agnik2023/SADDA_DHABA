import React, { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Banknote,
  CheckCircle2,
  Copy,
  CreditCard,
  ExternalLink,
  Loader2,
  Minus,
  Plus,
  Search,
  ShoppingBag,
  Smartphone,
  Trash2,
  UserPlus,
} from "lucide-react";
import { Modal } from "../common/Modal";
import { useMenu, useSettings } from "../../hooks/useMenu";
import { useToast } from "../../context/ToastContext";
import { createCounterOrder } from "../../lib/api";
import { errorMessage } from "../../lib/errors";
import { estimateTax, formatPaise } from "../../lib/money";
import { VegIndicator } from "../common/Badge";
import type { CounterOrderResult, OrderType, PaymentMethod } from "../../types";

interface AddOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (result: CounterOrderResult) => void | Promise<void>;
}

const METHODS: Array<{
  value: PaymentMethod;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { value: "CASH", label: "Cash", icon: Banknote },
  { value: "UPI_COUNTER", label: "UPI", icon: Smartphone },
  { value: "CARD_COUNTER", label: "Card", icon: CreditCard },
];

export const AddOrderModal: React.FC<AddOrderModalProps> = ({ isOpen, onClose, onCreated }) => {
  const { data: menu } = useMenu();
  const { data: settings } = useSettings();
  const { notify } = useToast();

  const [name, setName] = useState("Walk-in Guest");
  const [phone, setPhone] = useState("");
  const [orderType, setOrderType] = useState<OrderType>("DINE_IN");
  const [table, setTable] = useState("");
  const [notes, setNotes] = useState("");
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("all");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [collectNow, setCollectNow] = useState(true);
  const [method, setMethod] = useState<PaymentMethod>("CASH");
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CounterOrderResult | null>(null);

  const reset = () => {
    setName("Walk-in Guest");
    setPhone("");
    setOrderType("DINE_IN");
    setTable("");
    setNotes("");
    setSearch("");
    setCategoryId("all");
    setQuantities({});
    setCollectNow(true);
    setMethod("CASH");
    setReference("");
    setBusy(false);
    setError(null);
    setResult(null);
  };

  useEffect(() => {
    if (isOpen) reset();
  }, [isOpen]);

  const items = menu?.items ?? [];
  const categories = menu?.categories ?? [];
  const categoryById = new Map(categories.map((category) => [category.id, category]));

  const filteredItems = useMemo(() => {
    const term = search.trim().toLowerCase();
    return items.filter((item) => {
      if (categoryId !== "all" && item.category_id !== categoryId) return false;
      if (!term) return true;
      return (
        item.name.toLowerCase().includes(term) ||
        (item.description ?? "").toLowerCase().includes(term)
      );
    });
  }, [items, categoryId, search]);

  const selectedItems = useMemo(
    () =>
      Object.entries(quantities)
        .map(([id, qty]) => ({ item: items.find((entry) => entry.id === id), qty }))
        .filter((entry): entry is { item: (typeof items)[number]; qty: number } =>
          Boolean(entry.item)
        ),
    [quantities, items]
  );

  const subtotalPaise = selectedItems.reduce(
    (sum, entry) => sum + (entry.item?.price_paise ?? 0) * entry.qty,
    0
  );
  const taxRateBps = settings?.tax_rate_bps ?? 500;
  const taxPaise = estimateTax(subtotalPaise, taxRateBps);
  const totalPaise = subtotalPaise + taxPaise;
  const itemCount = selectedItems.reduce((sum, entry) => sum + entry.qty, 0);

  const changeQty = (id: string, delta: number) => {
    setQuantities((current) => {
      const next = Math.max(0, Math.min(20, (current[id] ?? 0) + delta));
      const copy = { ...current };
      if (next === 0) delete copy[id];
      else copy[id] = next;
      return copy;
    });
  };

  const normalizedPhone = phone.replace(/\D/g, "").replace(/^91(?=\d{10}$)/, "").slice(-10);
  const phoneValid = !phone.trim() || /^[6-9]\d{9}$/.test(normalizedPhone);
  const nameValid = (name.trim() || "Walk-in Guest").length <= 80;
  const tableValid = table.trim().length <= 20;
  const notesValid = notes.trim().length <= 500;

  const submit = async () => {
    if (busy) return;
    setError(null);

    if (!nameValid || !phoneValid || !tableValid || !notesValid) {
      setError("Check the customer details.");
      return;
    }
    if (selectedItems.length === 0) {
      setError("Add at least one item.");
      return;
    }
    if (collectNow && !method) {
      setError("Choose how the payment was collected.");
      return;
    }

    setBusy(true);
    try {
      const created = await createCounterOrder({
        name: name.trim() || "Walk-in Guest",
        phone: phone.trim() ? normalizedPhone : "",
        orderType,
        table: orderType === "DINE_IN" ? table.trim() : "",
        notes: notes.trim(),
        lines: selectedItems.map((entry) => ({
          menuItemId: entry.item.id,
          qty: entry.qty,
        })),
        collectNow,
        method,
        reference,
      });
      setResult(created);
      await onCreated(created);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const copyTrackingLink = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/order#${result.access_token}`
      );
      notify("Customer tracking link copied.", "success");
    } catch {
      notify("Could not copy the link.", "error");
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        if (!busy) onClose();
      }}
      title={
        <span className="flex items-center gap-2">
          <UserPlus className="h-5 w-5 text-orange-600" />
          {result ? "Order created" : "New walk-in / phone order"}
        </span>
      }
      maxWidth="4xl"
    >
      {result ? (
        <div className="space-y-5">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
            <p className="mt-2 text-xs font-black uppercase tracking-[0.18em] text-emerald-700">
              Order created
            </p>
            <p className="font-heading mt-1 text-4xl font-black tracking-tight text-stone-900">
              {result.order_code}
            </p>
            <p className="mt-1 font-heading text-2xl font-black text-emerald-700">
              {formatPaise(result.total_paise)}
            </p>
            <div className="mt-2 flex justify-center gap-2 text-xs">
              <span className="rounded-full bg-white px-2.5 py-1 font-bold text-stone-700">
                {result.payment_status === "PAID" ? "Paid · sent to kitchen" : "Awaiting payment"}
              </span>
              <span className="rounded-full bg-white px-2.5 py-1 font-bold text-stone-700">
                {result.status}
              </span>
            </div>
          </div>

          <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
            <p className="text-xs font-bold text-stone-800">Customer tracking link</p>
            <p className="mt-1 text-[11px] text-stone-500">
              Share this with the guest if they want to follow the order on their phone. The link
              works without an account.
            </p>
            <div className="mt-2 flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-lg border border-stone-200 bg-white p-2 font-mono text-[11px] text-stone-600">
                {window.location.origin}/order#{result.access_token}
              </code>
              <button
                onClick={() => void copyTrackingLink()}
                className="rounded-lg border border-stone-200 bg-white p-2 text-stone-500 hover:text-stone-900"
                aria-label="Copy tracking link"
              >
                <Copy className="h-3.5 w-3.5" />
              </button>
              <a
                href={`${window.location.origin}/order#${result.access_token}`}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border border-stone-200 bg-white p-2 text-stone-500 hover:text-stone-900"
                aria-label="Open tracking link"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <button
              onClick={reset}
              className="rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-xs font-bold text-stone-700 hover:bg-stone-50"
            >
              Create another
            </button>
            <button
              onClick={onClose}
              className="rounded-xl bg-stone-900 px-5 py-2.5 text-xs font-bold text-white hover:bg-stone-800"
            >
              Done
            </button>
          </div>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-5">
          <div className="space-y-4 lg:col-span-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-stone-600">
                  Customer name
                </label>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  maxLength={80}
                  className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-stone-600">
                  Phone <span className="font-medium normal-case text-stone-400">(optional)</span>
                </label>
                <input
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  inputMode="numeric"
                  maxLength={14}
                  placeholder="10-digit mobile"
                  className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                />
                {!phoneValid && (
                  <p className="mt-1 text-[10px] font-semibold text-rose-600">
                    Enter a valid Indian mobile number or leave it blank.
                  </p>
                )}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-stone-600">
                  Order type
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {(["DINE_IN", "TAKEAWAY"] as OrderType[]).map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setOrderType(value)}
                      className={`rounded-xl border px-2 py-2 text-xs font-bold transition ${
                        orderType === value
                          ? "border-orange-500 bg-orange-50 text-orange-800"
                          : "border-stone-200 bg-white text-stone-600"
                      }`}
                    >
                      {value === "DINE_IN" ? "Dine in" : "Takeaway"}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-stone-600">
                  Table <span className="font-medium normal-case text-stone-400">(optional)</span>
                </label>
                <input
                  value={table}
                  onChange={(event) => setTable(event.target.value)}
                  maxLength={20}
                  disabled={orderType !== "DINE_IN"}
                  placeholder={orderType === "DINE_IN" ? "e.g. 4" : "Not applicable"}
                  className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm disabled:opacity-50 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                />
              </div>
            </div>

            <div>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <div className="relative min-w-[12rem] flex-1">
                  <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-stone-400" />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search menu items…"
                    className="w-full rounded-xl border border-stone-200 bg-stone-50 py-2 pl-9 pr-3 text-xs focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                  />
                </div>
                <select
                  value={categoryId}
                  onChange={(event) => setCategoryId(event.target.value)}
                  className="rounded-xl border border-stone-200 bg-white px-2 py-2 text-xs font-semibold text-stone-700"
                >
                  <option value="all">All categories</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="max-h-72 space-y-1.5 overflow-y-auto rounded-xl border border-stone-200 bg-stone-50 p-2">
                {filteredItems.map((item) => {
                  const qty = quantities[item.id] ?? 0;
                  return (
                    <div
                      key={item.id}
                      className={`flex items-center justify-between gap-2 rounded-lg border p-2 ${
                        item.available
                          ? "border-stone-200 bg-white"
                          : "border-stone-200 bg-stone-100 opacity-60"
                      }`}
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <VegIndicator isVeg={item.is_veg} />
                        <div className="min-w-0">
                          <p className="truncate text-xs font-bold text-stone-800">{item.name}</p>
                          <p className="text-[10px] text-stone-400">
                            {categoryById.get(item.category_id)?.name}
                            {!item.available ? " · Sold out" : ""}
                          </p>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="text-xs font-bold text-stone-800">
                          {formatPaise(item.price_paise)}
                        </span>
                        {qty > 0 ? (
                          <div className="flex items-center gap-1 rounded-lg border border-orange-200 bg-orange-50 p-0.5">
                            <button
                              type="button"
                              onClick={() => changeQty(item.id, -1)}
                              className="flex h-6 w-6 items-center justify-center rounded bg-white text-orange-700"
                            >
                              <Minus className="h-3 w-3" />
                            </button>
                            <span className="w-5 text-center text-xs font-black text-orange-900">
                              {qty}
                            </span>
                            <button
                              type="button"
                              onClick={() => changeQty(item.id, 1)}
                              className="flex h-6 w-6 items-center justify-center rounded bg-orange-600 text-white"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            disabled={!item.available}
                            onClick={() => changeQty(item.id, 1)}
                            className="flex h-7 items-center gap-1 rounded-lg border border-orange-200 bg-orange-50 px-2 text-[10px] font-bold text-orange-700 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <Plus className="h-3 w-3" /> Add
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
                {filteredItems.length === 0 && (
                  <p className="p-4 text-center text-xs text-stone-400">No items match.</p>
                )}
              </div>
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-stone-600">
                Kitchen notes
              </label>
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={2}
                maxLength={500}
                placeholder="Less spicy, no onion…"
                className="w-full resize-none rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-xs focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
              />
            </div>
          </div>

          <div className="space-y-3 lg:col-span-2">
            <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
              <h3 className="flex items-center gap-1.5 text-sm font-black text-stone-900">
                <ShoppingBag className="h-4 w-4 text-orange-600" /> Order summary
                <span className="ml-auto text-xs font-semibold text-stone-400">
                  {itemCount} item{itemCount === 1 ? "" : "s"}
                </span>
              </h3>

              <div className="mt-3 max-h-56 space-y-2 overflow-y-auto">
                {selectedItems.length === 0 ? (
                  <p className="rounded-lg bg-stone-50 p-3 text-center text-[11px] text-stone-400">
                    Add items from the menu list.
                  </p>
                ) : (
                  selectedItems.map(({ item, qty }) => (
                    <div key={item.id} className="flex items-center justify-between gap-2 text-xs">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-stone-800">
                          {qty}× {item.name}
                        </p>
                        <p className="text-[10px] text-stone-400">
                          {formatPaise(item.price_paise * qty)}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => changeQty(item.id, -1)}
                          className="rounded border border-stone-200 p-0.5 text-stone-500"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => changeQty(item.id, 1)}
                          className="rounded border border-stone-200 p-0.5 text-stone-500"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setQuantities((current) => {
                            const copy = { ...current };
                            delete copy[item.id];
                            return copy;
                          })}
                          className="rounded p-0.5 text-stone-300 hover:text-rose-600"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="mt-3 space-y-1 border-t border-stone-100 pt-3 text-[11px] text-stone-500">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>{formatPaise(subtotalPaise)}</span>
                </div>
                <div className="flex justify-between">
                  <span>GST ({(taxRateBps / 100).toFixed(taxRateBps % 100 === 0 ? 0 : 2)}%)</span>
                  <span>{formatPaise(taxPaise)}</span>
                </div>
                <div className="flex justify-between border-t border-stone-100 pt-1 text-sm font-black text-stone-900">
                  <span>Total</span>
                  <span className="text-orange-600">{formatPaise(totalPaise)}</span>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
              <label className="flex cursor-pointer items-start gap-2">
                <input
                  type="checkbox"
                  checked={collectNow}
                  onChange={(event) => setCollectNow(event.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-stone-300 text-orange-600 focus:ring-orange-500"
                />
                <span className="text-xs text-stone-700">
                  <strong className="block text-stone-900">Payment collected now</strong>
                  <span className="text-[10px] text-stone-500">
                    Uncheck to create an unpaid order and collect later at the counter.
                  </span>
                </span>
              </label>

              {collectNow && (
                <div className="mt-3 space-y-2">
                  <div className="grid grid-cols-3 gap-1.5">
                    {METHODS.map((option) => {
                      const Icon = option.icon;
                      const active = method === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setMethod(option.value)}
                          className={`rounded-xl border p-2 text-center transition ${
                            active
                              ? "border-orange-500 bg-orange-50 text-orange-800"
                              : "border-stone-200 bg-white text-stone-500"
                          }`}
                        >
                          <Icon className="mx-auto h-4 w-4" />
                          <span className="mt-0.5 block text-[10px] font-bold">{option.label}</span>
                        </button>
                      );
                    })}
                  </div>
                  <input
                    value={reference}
                    onChange={(event) => setReference(event.target.value)}
                    maxLength={120}
                    placeholder="Payment reference (optional)"
                    className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                  />
                </div>
              )}
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
              </div>
            )}

            <button
              type="button"
              onClick={() => void submit()}
              disabled={busy || selectedItems.length === 0 || !phoneValid}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-orange-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-orange-600/20 transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              {busy ? "Creating order…" : `Create order · ${formatPaise(totalPaise)}`}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
};
