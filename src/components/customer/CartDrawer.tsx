import React from "react";
import { ArrowRight, Minus, Plus, ShieldCheck, ShoppingBag, Trash2, X, AlertCircle } from "lucide-react";
import { useCart } from "../../context/CartContext";
import { useMenu, useSettings } from "../../hooks/useMenu";
import { estimateTax, formatPaise } from "../../lib/money";
import { VegIndicator } from "../common/Badge";

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onCheckout: () => void;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({ isOpen, onClose, onCheckout }) => {
  const { lines, count, increment, decrement, remove, clear } = useCart();
  const { data: menu } = useMenu();
  const { data: settings } = useSettings();

  if (!isOpen) return null;

  const itemById = new Map((menu?.items ?? []).map((item) => [item.id, item]));
  const detailed = lines.map((line) => ({ ...line, item: itemById.get(line.menuItemId) }));
  const hasUnavailable = detailed.some((line) => !line.item || !line.item.available);
  const subtotalPaise = detailed.reduce(
    (sum, line) => sum + (line.item?.price_paise ?? 0) * line.qty,
    0
  );
  const taxRateBps = settings?.tax_rate_bps ?? 500;
  const taxPaise = estimateTax(subtotalPaise, taxRateBps);
  const totalPaise = subtotalPaise + taxPaise;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-stone-950/60 backdrop-blur-sm animate-fade-in">
      <div className="relative flex h-full w-full max-w-md animate-slide-left flex-col bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-stone-200 bg-stone-50 px-6 py-4">
          <div className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-orange-600" />
            <h2 className="font-heading text-lg font-bold text-stone-900">Your order</h2>
            <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-800">
              {count} item{count === 1 ? "" : "s"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {lines.length > 0 && (
              <button
                onClick={clear}
                className="text-xs font-medium text-stone-500 transition hover:text-rose-600"
              >
                Clear
              </button>
            )}
            <button
              onClick={onClose}
              className="rounded-xl p-1.5 text-stone-400 transition hover:bg-stone-200/60 hover:text-stone-700"
              aria-label="Close cart"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {lines.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center p-6 text-center text-stone-400">
              <ShoppingBag className="mb-3 h-16 w-16 stroke-1 text-stone-300" />
              <p className="font-heading text-base font-bold text-stone-700">Your cart is empty</p>
              <p className="mt-1 max-w-xs text-xs">
                Browse our tandoori, momos, rolls and biryanis to add something delicious.
              </p>
              <button
                onClick={onClose}
                className="mt-5 rounded-xl bg-orange-600 px-5 py-2.5 text-xs font-bold text-white shadow transition hover:bg-orange-700"
              >
                Explore menu
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {detailed.map(({ menuItemId, qty, item }) => (
                <div
                  key={menuItemId}
                  className={`flex items-center justify-between gap-3 border-b border-stone-100 pb-4 last:border-0 last:pb-0 ${
                    !item || !item.available ? "opacity-70" : ""
                  }`}
                >
                  <div className="flex min-w-0 items-start gap-2.5">
                    <div className="pt-0.5">
                      {item && <VegIndicator isVeg={item.is_veg} />}
                    </div>
                    <div className="min-w-0">
                      <h4 className="truncate text-sm font-bold leading-tight text-stone-900">
                        {item?.name ?? "Item no longer on the menu"}
                      </h4>
                      {item ? (
                        <p className="mt-0.5 text-xs text-stone-500">
                          {formatPaise(item.price_paise)} each
                        </p>
                      ) : (
                        <p className="mt-0.5 text-xs font-semibold text-rose-600">
                          Please remove this item
                        </p>
                      )}
                      {item && !item.available && (
                        <p className="mt-0.5 flex items-center gap-1 text-xs font-semibold text-rose-600">
                          <AlertCircle className="h-3 w-3" /> Sold out — remove to continue
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <div className="flex items-center gap-1.5 rounded-lg border border-stone-200 bg-stone-100 p-0.5">
                      <button
                        onClick={() => decrement(menuItemId)}
                        className="flex h-6 w-6 items-center justify-center rounded bg-white text-stone-700 transition hover:bg-stone-200 active:scale-95"
                        aria-label="Decrease quantity"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="w-5 text-center text-xs font-bold text-stone-900">{qty}</span>
                      <button
                        onClick={() => increment(menuItemId)}
                        className="flex h-6 w-6 items-center justify-center rounded bg-white text-stone-700 transition hover:bg-stone-200 active:scale-95"
                        aria-label="Increase quantity"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>

                    <div className="w-16 text-right font-heading text-sm font-bold text-stone-900">
                      {item ? formatPaise(item.price_paise * qty) : "—"}
                    </div>

                    <button
                      onClick={() => remove(menuItemId)}
                      className="p-1 text-stone-300 transition hover:text-rose-600"
                      aria-label="Remove item"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {lines.length > 0 && (
          <div className="space-y-3 border-t border-stone-200 bg-stone-50 p-6">
            <div className="space-y-1.5 text-xs text-stone-600">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span className="font-semibold text-stone-900">{formatPaise(subtotalPaise)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <span>GST ({(taxRateBps / 100).toFixed(taxRateBps % 100 === 0 ? 0 : 2)}%)</span>
                  <span className="text-[10px] text-stone-400">CGST + SGST</span>
                </span>
                <span className="font-semibold text-stone-900">{formatPaise(taxPaise)}</span>
              </div>
              <div className="flex items-baseline justify-between border-t border-stone-200 pt-2">
                <span className="text-sm font-bold text-stone-900">Estimated total</span>
                <span className="font-heading text-xl font-black text-orange-600">
                  {formatPaise(totalPaise)}
                </span>
              </div>
            </div>

            <div className="flex items-start gap-1.5 rounded-xl border border-amber-200 bg-amber-50 p-2 text-[11px] text-stone-600">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
              <span>
                Final prices are confirmed by the server at checkout. Payment is collected at the
                counter before the kitchen starts.
              </span>
            </div>

            {hasUnavailable && (
              <div className="flex items-start gap-1.5 rounded-xl border border-rose-200 bg-rose-50 p-2 text-[11px] font-semibold text-rose-700">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                Remove sold-out items before continuing.
              </div>
            )}

            <button
              onClick={() => {
                if (hasUnavailable) return;
                onClose();
                onCheckout();
              }}
              disabled={hasUnavailable}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-orange-600 px-4 py-3.5 font-bold text-white shadow-lg shadow-orange-600/25 transition hover:bg-orange-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <span>Proceed to checkout</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
