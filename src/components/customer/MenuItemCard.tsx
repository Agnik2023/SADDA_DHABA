import React from "react";
import type { MenuItem } from "../../types";
import { VegIndicator } from "../common/Badge";
import { Plus, Minus, AlertCircle } from "lucide-react";
import { formatPaise } from "../../lib/money";

interface MenuItemCardProps {
  item: MenuItem;
  cartQty: number;
  onAdd: () => void;
  onIncrement: () => void;
  onDecrement: () => void;
}

export const MenuItemCard: React.FC<MenuItemCardProps> = ({
  item,
  cartQty,
  onAdd,
  onIncrement,
  onDecrement,
}) => {
  const isAvailable = item.available;

  return (
    <div
      className={`relative flex flex-col justify-between rounded-2xl border p-4 transition-all duration-200 ${
        isAvailable
          ? "border-stone-200/90 bg-white shadow-sm hover:border-orange-200 hover:shadow-md"
          : "border-stone-200 bg-stone-100/80 opacity-60 grayscale-[40%]"
      }`}
    >
      <div>
        <div className="mb-2 flex items-center justify-between gap-2">
          <VegIndicator isVeg={item.is_veg} showText />
          {!isAvailable && (
            <span className="inline-flex items-center gap-1 rounded-md bg-stone-200 px-2 py-0.5 text-[11px] font-bold text-stone-600">
              <AlertCircle className="h-3 w-3" />
              Sold out
            </span>
          )}
        </div>

        <h3 className="font-heading text-base font-bold leading-snug text-stone-900">
          {item.name}
        </h3>

        {item.description && (
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-stone-500">
            {item.description}
          </p>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-stone-100 pt-3">
        <div>
          <span className="text-xs font-medium text-stone-400">Price</span>
          <div className="font-heading text-base font-black text-stone-900">
            {formatPaise(item.price_paise)}
          </div>
        </div>

        <div>
          {!isAvailable ? (
            <button
              disabled
              className="cursor-not-allowed rounded-xl bg-stone-200 px-3 py-1.5 text-xs font-semibold text-stone-400"
            >
              Unavailable
            </button>
          ) : cartQty > 0 ? (
            <div className="flex items-center gap-2 rounded-xl border border-orange-200 bg-orange-50 p-1 shadow-sm">
              <button
                onClick={onDecrement}
                className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-orange-700 transition hover:bg-orange-100 active:scale-95"
                aria-label={`Decrease ${item.name}`}
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <span className="w-5 text-center font-heading text-sm font-black text-orange-950">
                {cartQty}
              </span>
              <button
                onClick={onIncrement}
                className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-600 text-white transition hover:bg-orange-700 active:scale-95"
                aria-label={`Increase ${item.name}`}
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={onAdd}
              className="flex items-center gap-1 rounded-xl border border-orange-200 bg-orange-50 px-4 py-2 text-xs font-bold text-orange-700 shadow-xs transition duration-150 hover:border-orange-600 hover:bg-orange-600 hover:text-white active:scale-95"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
