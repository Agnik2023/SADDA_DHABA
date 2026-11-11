import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, ChevronRight, RefreshCw, Search, Shield, ShieldCheck, ShoppingBag, Utensils } from "lucide-react";
import { useCart } from "../../context/CartContext";
import { useMenu, useMenuRealtime, useSettings } from "../../hooks/useMenu";
import { estimateTax, formatPaise } from "../../lib/money";
import { getLastOrderToken } from "../../lib/customerToken";
import { isSupabaseConfigured } from "../../lib/supabase";
import { ConfigNotice } from "../common/ConfigNotice";
import { CategoryBar } from "./CategoryBar";
import { MenuItemCard } from "./MenuItemCard";
import { CartDrawer } from "./CartDrawer";
import { CheckoutModal } from "./CheckoutModal";

export const CustomerApp: React.FC = () => {
  const { data, isLoading, isError, error, refetch, isFetching } = useMenu();
  const { data: settings } = useSettings();
  const { lines, count, add, increment, decrement, qtyOf } = useCart();
  useMenuRealtime();

  const [selectedCategoryId, setSelectedCategoryId] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [vegOnly, setVegOnly] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);

  const lastToken = getLastOrderToken();

  const categories = data?.categories ?? [];
  const items = data?.items ?? [];

  const itemById = useMemo(
    () => new Map(items.map((item) => [item.id, item])),
    [items]
  );

  const categoryNameById = useMemo(
    () => new Map(categories.map((category) => [category.id, category.name])),
    [categories]
  );

  const filteredItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return items.filter((item) => {
      if (selectedCategoryId !== "all" && item.category_id !== selectedCategoryId) {
        return false;
      }
      if (vegOnly && !item.is_veg) return false;
      if (!query) return true;
      const categoryName = categoryNameById.get(item.category_id)?.toLowerCase() ?? "";
      return (
        item.name.toLowerCase().includes(query) ||
        categoryName.includes(query) ||
        (item.description ?? "").toLowerCase().includes(query)
      );
    });
  }, [items, selectedCategoryId, vegOnly, searchQuery, categoryNameById]);

  const groupedCategories = useMemo(() => {
    if (selectedCategoryId !== "all") return [];
    return categories
      .map((category) => ({
        category,
        items: filteredItems.filter((item) => item.category_id === category.id),
      }))
      .filter((group) => group.items.length > 0);
  }, [categories, filteredItems, selectedCategoryId]);

  const subtotalPaise = useMemo(
    () =>
      lines.reduce((sum, line) => {
        const item = itemById.get(line.menuItemId);
        return item ? sum + item.price_paise * line.qty : sum;
      }, 0),
    [lines, itemById]
  );

  const taxRateBps = settings?.tax_rate_bps ?? 500;
  const taxPaise = estimateTax(subtotalPaise, taxRateBps);
  const totalPaise = subtotalPaise + taxPaise;

  if (!isSupabaseConfigured) return <ConfigNotice />;

  const renderItem = (itemId: string) => {
    const item = itemById.get(itemId);
    if (!item) return null;
    return (
      <MenuItemCard
        key={item.id}
        item={item}
        cartQty={qtyOf(item.id)}
        onAdd={() => add(item.id, 1)}
        onIncrement={() => increment(item.id)}
        onDecrement={() => decrement(item.id)}
      />
    );
  };

  return (
    <div className="flex min-h-screen flex-col bg-stone-50">
      <header className="sticky top-0 z-40 border-b border-stone-200 bg-white/95 shadow-xs backdrop-blur-md">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-2.5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-orange-600 to-amber-500 text-white shadow-md shadow-orange-600/30">
              <Utensils className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-heading text-lg font-black tracking-tight text-stone-900">
                  SADDA DHABA
                </h1>
                <span className="hidden rounded-md bg-orange-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-orange-800 sm:inline-block">
                  Dine in & takeaway
                </span>
              </div>
              <p className="text-[11px] leading-none text-stone-500">
                Authentic roadside flavors, ordered from your phone
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {lastToken && (
              <Link
                to={`/order#${lastToken}`}
                className="hidden items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-800 transition hover:bg-amber-100 sm:flex"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Track order
              </Link>
            )}

            <button
              onClick={() => setIsCartOpen(true)}
              className="relative flex items-center gap-2 rounded-2xl bg-stone-900 p-2.5 text-white shadow-md shadow-stone-900/10 transition hover:bg-stone-800"
              aria-label="View cart"
            >
              <ShoppingBag className="h-4 w-4 text-orange-400" />
              {count > 0 && (
                <span className="rounded-full bg-orange-500 px-1.5 py-0.5 font-heading text-[11px] font-black text-white">
                  {count}
                </span>
              )}
            </button>

            <Link
              to="/admin"
              className="rounded-xl p-2 text-stone-400 transition hover:bg-stone-100 hover:text-stone-700"
              title="Staff console"
            >
              <Shield className="h-4 w-4" />
            </Link>
          </div>
        </div>

        <div className="bg-stone-900 px-4 py-1.5 text-center text-[11px] font-semibold text-stone-200">
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
            No online payment. Pay at the counter — the kitchen starts after staff verification.
          </span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 pb-28">
        <div className="flex flex-col gap-3 border-b border-stone-200/80 bg-white p-4 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search tandoori, biryani, momos, rolls…"
              className="w-full rounded-xl border border-stone-200 bg-stone-50 py-2.5 pl-10 pr-4 text-xs font-medium transition focus:border-orange-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/30"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-stone-400 hover:text-stone-700"
                aria-label="Clear search"
              >
                ✕
              </button>
            )}
          </div>

          <div className="flex items-center justify-between gap-3 sm:justify-start">
            <button
              onClick={() => setVegOnly((value) => !value)}
              className={`flex select-none items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold transition ${
                vegOnly
                  ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                  : "border-stone-200 bg-stone-50 text-stone-700 hover:bg-stone-100"
              }`}
            >
              <span
                className={`flex h-4 w-4 items-center justify-center rounded border-2 border-emerald-600 ${
                  vegOnly ? "bg-emerald-600" : "bg-white"
                }`}
              >
                {vegOnly && <span className="h-2 w-2 rounded-full bg-white" />}
              </span>
              Veg only
            </button>

            <span className="text-xs text-stone-400">
              {filteredItems.length} dish{filteredItems.length === 1 ? "" : "es"}
            </span>
          </div>
        </div>

        {isError && (
          <div className="m-4 flex items-start justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800">
            <div className="flex gap-2">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-bold">The menu could not be loaded</p>
                <p className="mt-1 opacity-80">
                  {(error as Error)?.message || "Check the internet connection and try again."}
                </p>
              </div>
            </div>
            <button
              onClick={() => void refetch()}
              className="flex shrink-0 items-center gap-1 rounded-lg bg-white px-2.5 py-1.5 font-bold text-rose-700 shadow-sm"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
              Retry
            </button>
          </div>
        )}

        {categories.length > 0 && (
          <CategoryBar
            categories={categories}
            activeCategoryId={selectedCategoryId}
            onSelectCategory={setSelectedCategoryId}
          />
        )}

        <div className="p-4">
          {isLoading ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {Array.from({ length: 6 }).map((_, index) => (
                <div
                  key={index}
                  className="h-44 animate-pulse rounded-2xl border border-stone-200 bg-white"
                />
              ))}
            </div>
          ) : selectedCategoryId !== "all" ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {filteredItems.map((item) => renderItem(item.id))}
            </div>
          ) : (
            <div className="space-y-8">
              {groupedCategories.map(({ category, items: categoryItems }) => (
                <div key={category.id} className="space-y-3">
                  <div className="flex items-center justify-between border-b border-stone-200 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{category.icon || "🍽️"}</span>
                      <h2 className="font-heading text-base font-black text-stone-900">
                        {category.name}
                      </h2>
                    </div>
                    <span className="text-xs font-semibold text-stone-400">
                      {categoryItems.length} items
                    </span>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {categoryItems.map((item) => renderItem(item.id))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {!isLoading && filteredItems.length === 0 && !isError && (
            <div className="py-16 text-center text-stone-400">
              <Utensils className="mx-auto mb-2 h-12 w-12 stroke-1 text-stone-300" />
              <p className="text-sm font-bold text-stone-700">No dishes match your criteria</p>
              <p className="mt-1 text-xs">Try clearing the search or turning off Veg only.</p>
            </div>
          )}
        </div>
      </main>

      {count > 0 && (
        <div className="fixed bottom-4 left-4 right-4 z-40 mx-auto max-w-md animate-slide-up">
          <div className="flex items-center justify-between rounded-2xl border border-stone-800 bg-stone-900 p-3.5 text-white shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-600 font-bold text-white shadow-md">
                {count}
              </div>
              <div>
                <span className="block text-xs leading-tight text-stone-400">
                  Estimated total · incl. GST
                </span>
                <span className="font-heading text-base font-black leading-tight text-white">
                  {formatPaise(totalPaise)}
                </span>
              </div>
            </div>

            <button
              onClick={() => setIsCartOpen(true)}
              className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-5 py-2 text-xs font-bold text-white shadow-lg shadow-orange-500/25 transition hover:from-orange-600 hover:to-amber-600 active:scale-95"
            >
              <span>View cart</span>
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        onCheckout={() => {
          setIsCartOpen(false);
          setIsCheckoutOpen(true);
        }}
      />

      <CheckoutModal isOpen={isCheckoutOpen} onClose={() => setIsCheckoutOpen(false)} />

      <footer className="border-t border-stone-200 bg-white px-4 py-6 text-center text-[11px] text-stone-400">
        <p>
          SADDA DHABA · Dine-in and takeaway · Pay at the counter
        </p>
        <p className="mt-1">
          Staff?{" "}
          <Link to="/admin" className="font-bold text-stone-600 hover:text-orange-700">
            Open the console
          </Link>
        </p>
      </footer>
    </div>
  );
};
