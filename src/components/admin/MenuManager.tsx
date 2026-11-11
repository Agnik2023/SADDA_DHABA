import React, { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  BookOpen,
  Check,
  Edit3,
  FolderPlus,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Tags,
  Trash2,
  X,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useMenu, useMenuRealtime } from "../../hooks/useMenu";
import { useStaffAuth } from "../../context/StaffAuthContext";
import { useToast } from "../../context/ToastContext";
import {
  createCategory,
  createMenuItem,
  deleteCategory,
  deleteMenuItem,
  setMenuItemAvailability,
  updateCategory,
  updateMenuItem,
} from "../../lib/api";
import { errorMessage } from "../../lib/errors";
import { formatPaise, rupeesToPaise } from "../../lib/money";
import { Modal } from "../common/Modal";
import { Badge, VegIndicator } from "../common/Badge";
import type { Category, MenuItem } from "../../types";

interface ItemFormState {
  id: string | null;
  categoryId: string;
  name: string;
  description: string;
  price: string;
  isVeg: boolean;
  available: boolean;
  sortOrder: string;
}

interface CategoryFormState {
  id: string | null;
  name: string;
  icon: string;
  sortOrder: string;
}

const emptyItem = (categoryId: string): ItemFormState => ({
  id: null,
  categoryId,
  name: "",
  description: "",
  price: "",
  isVeg: true,
  available: true,
  sortOrder: "0",
});

export const MenuManager: React.FC = () => {
  const { data, isLoading, isError, error, refetch, isFetching } = useMenu();
  const { staff } = useStaffAuth();
  const { notify } = useToast();
  const queryClient = useQueryClient();
  useMenuRealtime();

  const isDev = staff?.role === "dev";
  const categories = data?.categories ?? [];
  const items = data?.items ?? [];

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [busyId, setBusyId] = useState<string | null>(null);

  const [itemForm, setItemForm] = useState<ItemFormState | null>(null);
  const [itemBusy, setItemBusy] = useState(false);
  const [itemError, setItemError] = useState<string | null>(null);

  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [categoryForm, setCategoryForm] = useState<CategoryFormState | null>(null);
  const [categoryBusy, setCategoryBusy] = useState(false);
  const [categoryError, setCategoryError] = useState<string | null>(null);

  useEffect(() => {
    if (categories.length > 0 && itemForm?.categoryId === "" && !itemForm.id) {
      setItemForm((current) => (current ? { ...current, categoryId: categories[0].id } : current));
    }
  }, [categories, itemForm]);

  const categoryName = useMemo(
    () => new Map(categories.map((category) => [category.id, category.name])),
    [categories]
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return items.filter((item) => {
      if (categoryFilter !== "all" && item.category_id !== categoryFilter) return false;
      if (!term) return true;
      return item.name.toLowerCase().includes(term) || (item.description ?? "").toLowerCase().includes(term);
    });
  }, [items, categoryFilter, search]);

  const grouped = categories
    .map((category) => ({
      category,
      items: filtered.filter((item) => item.category_id === category.id),
    }))
    .filter((group) => group.items.length > 0);

  const availableCount = items.filter((item) => item.available).length;

  const toggleAvailability = async (item: MenuItem) => {
    if (busyId) return;
    setBusyId(item.id);
    try {
      await setMenuItemAvailability(item.id, !item.available);
      notify(
        `${item.name} marked ${item.available ? "sold out" : "available"}.`,
        "success"
      );
      await queryClient.invalidateQueries({ queryKey: ["menu"] });
    } catch (err) {
      notify(errorMessage(err), "error");
    } finally {
      setBusyId(null);
    }
  };

  const openNewItem = () => {
    setItemError(null);
    setItemForm(emptyItem(categoryFilter !== "all" ? categoryFilter : categories[0]?.id ?? ""));
  };

  const openEditItem = (item: MenuItem) => {
    setItemError(null);
    setItemForm({
      id: item.id,
      categoryId: item.category_id,
      name: item.name,
      description: item.description ?? "",
      price: (item.price_paise / 100).toString(),
      isVeg: item.is_veg,
      available: item.available,
      sortOrder: String(item.sort_order),
    });
  };

  const saveItem = async () => {
    if (!itemForm || itemBusy) return;
    setItemError(null);

    const name = itemForm.name.trim();
    const pricePaise = rupeesToPaise(itemForm.price);
    if (!name) {
      setItemError("Enter an item name.");
      return;
    }
    if (!itemForm.categoryId) {
      setItemError("Choose a category.");
      return;
    }
    if (pricePaise <= 0) {
      setItemError("Enter a price greater than zero.");
      return;
    }

    setItemBusy(true);
    try {
      const payload = {
        category_id: itemForm.categoryId,
        name,
        description: itemForm.description.trim(),
        price_paise: pricePaise,
        is_veg: itemForm.isVeg,
        available: itemForm.available,
        sort_order: Number.parseInt(itemForm.sortOrder, 10) || 0,
      };

      if (itemForm.id) {
        await updateMenuItem(itemForm.id, payload);
        notify(`${name} updated.`, "success");
      } else {
        await createMenuItem(payload);
        notify(`${name} added to the menu.`, "success");
      }

      await queryClient.invalidateQueries({ queryKey: ["menu"] });
      setItemForm(null);
    } catch (err) {
      setItemError(errorMessage(err));
    } finally {
      setItemBusy(false);
    }
  };

  const removeItem = async (item: MenuItem) => {
    if (!window.confirm(`Delete “${item.name}”? Past orders keep their saved name and price.`)) {
      return;
    }
    setItemBusy(true);
    try {
      await deleteMenuItem(item.id);
      notify(`${item.name} deleted.`, "success");
      await queryClient.invalidateQueries({ queryKey: ["menu"] });
      setItemForm(null);
    } catch (err) {
      setItemError(errorMessage(err));
    } finally {
      setItemBusy(false);
    }
  };

  const openCategories = () => {
    setCategoryError(null);
    setCategoryForm(null);
    setCategoriesOpen(true);
  };

  const saveCategory = async () => {
    if (!categoryForm || categoryBusy) return;
    setCategoryError(null);
    const name = categoryForm.name.trim();
    if (!name) {
      setCategoryError("Enter a category name.");
      return;
    }

    setCategoryBusy(true);
    try {
      const payload = {
        name,
        icon: categoryForm.icon.trim() || "🍽️",
        sort_order: Number.parseInt(categoryForm.sortOrder, 10) || 0,
      };
      if (categoryForm.id) {
        await updateCategory(categoryForm.id, payload);
        notify(`${name} updated.`, "success");
      } else {
        await createCategory(payload);
        notify(`${name} category added.`, "success");
      }
      await queryClient.invalidateQueries({ queryKey: ["menu"] });
      setCategoryForm(null);
    } catch (err) {
      setCategoryError(errorMessage(err));
    } finally {
      setCategoryBusy(false);
    }
  };

  const removeCategory = async (category: Category) => {
    const count = items.filter((item) => item.category_id === category.id).length;
    if (count > 0) {
      setCategoryError("Move or delete the items in this category first.");
      return;
    }
    if (!window.confirm(`Delete the “${category.name}” category?`)) return;

    setCategoryBusy(true);
    setCategoryError(null);
    try {
      await deleteCategory(category.id);
      notify(`${category.name} deleted.`, "success");
      await queryClient.invalidateQueries({ queryKey: ["menu"] });
      setCategoryForm(null);
    } catch (err) {
      setCategoryError(errorMessage(err));
    } finally {
      setCategoryBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-orange-600">
            Menu
          </p>
          <h1 className="font-heading text-2xl font-black tracking-tight text-stone-900">
            Menu & availability
          </h1>
          <p className="mt-0.5 text-xs text-stone-500">
            {isDev
              ? "Full menu control. Changes are audited under your dev account."
              : "Counter staff can mark items in or out of stock. Prices are managed by dev."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => void refetch()}
            className="rounded-xl border border-stone-200 bg-white p-2.5 text-stone-500 shadow-sm hover:text-stone-800"
            title="Refresh"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          </button>
          {isDev && (
            <>
              <button
                onClick={openCategories}
                className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-xs font-bold text-stone-700 shadow-sm hover:bg-stone-50"
              >
                <Tags className="h-4 w-4" /> Categories
              </button>
              <button
                onClick={openNewItem}
                className="inline-flex items-center gap-1.5 rounded-xl bg-stone-900 px-3.5 py-2.5 text-xs font-bold text-white shadow-lg shadow-stone-900/20 hover:bg-stone-800"
              >
                <Plus className="h-4 w-4" /> Add item
              </button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-2xl border border-stone-200 bg-white p-3">
          <p className="text-[10px] font-bold uppercase tracking-wide text-stone-400">Total items</p>
          <p className="font-heading mt-1 text-2xl font-black text-stone-900">{items.length}</p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
          <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-700">Available</p>
          <p className="font-heading mt-1 text-2xl font-black text-emerald-900">{availableCount}</p>
        </div>
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3">
          <p className="text-[10px] font-bold uppercase tracking-wide text-rose-700">Sold out</p>
          <p className="font-heading mt-1 text-2xl font-black text-rose-900">
            {items.length - availableCount}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search dishes…"
            className="w-full rounded-xl border border-stone-200 bg-white py-2.5 pl-10 pr-4 text-xs shadow-sm focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(event) => setCategoryFilter(event.target.value)}
          className="rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-xs font-semibold text-stone-700 shadow-sm"
        >
          <option value="all">All categories</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
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
        <div className="space-y-3">
          {[0, 1, 2].map((index) => (
            <div key={index} className="h-28 animate-pulse rounded-2xl bg-white" />
          ))}
        </div>
      ) : (
        <div className="space-y-5">
          {grouped.map(({ category, items: categoryItems }) => (
            <section key={category.id} className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
              <div className="flex items-center justify-between gap-2 border-b border-stone-100 bg-stone-50 px-4 py-2.5">
                <h2 className="flex items-center gap-2 text-sm font-black text-stone-900">
                  <span>{category.icon || "🍽️"}</span> {category.name}
                </h2>
                <span className="text-[11px] font-semibold text-stone-400">
                  {categoryItems.length} item{categoryItems.length === 1 ? "" : "s"}
                </span>
              </div>
              <div className="divide-y divide-stone-100">
                {categoryItems.map((item) => (
                  <div
                    key={item.id}
                    className={`flex flex-wrap items-center gap-3 px-4 py-3 ${
                      item.available ? "" : "bg-stone-50/60"
                    }`}
                  >
                    <VegIndicator isVeg={item.is_veg} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-bold text-stone-900">{item.name}</p>
                        {!item.available && <Badge variant="danger" size="sm">Sold out</Badge>}
                      </div>
                      <p className="line-clamp-1 text-[11px] text-stone-400">
                        {item.description || categoryName.get(item.category_id)}
                      </p>
                    </div>
                    <span className="font-heading text-sm font-black text-stone-900">
                      {formatPaise(item.price_paise)}
                    </span>

                    <button
                      onClick={() => void toggleAvailability(item)}
                      disabled={busyId === item.id}
                      className={`relative h-6 w-11 shrink-0 rounded-full transition ${
                        item.available ? "bg-emerald-500" : "bg-stone-300"
                      } disabled:opacity-50`}
                      title={item.available ? "Mark sold out" : "Mark available"}
                      aria-label={item.available ? `Mark ${item.name} sold out` : `Mark ${item.name} available`}
                    >
                      <span
                        className={`absolute top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-white shadow transition ${
                          item.available ? "left-[22px]" : "left-0.5"
                        }`}
                      >
                        {busyId === item.id ? (
                          <Loader2 className="h-3 w-3 animate-spin text-stone-400" />
                        ) : item.available ? (
                          <Check className="h-3 w-3 text-emerald-600" />
                        ) : (
                          <X className="h-3 w-3 text-stone-400" />
                        )}
                      </span>
                    </button>

                    {isDev && (
                      <button
                        onClick={() => openEditItem(item)}
                        className="rounded-lg border border-stone-200 p-1.5 text-stone-500 hover:bg-stone-50 hover:text-stone-900"
                        title="Edit item"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </section>
          ))}

          {grouped.length === 0 && (
            <div className="rounded-2xl border border-dashed border-stone-200 bg-white p-8 text-center text-stone-400">
              <BookOpen className="mx-auto h-9 w-9 stroke-1" />
              <p className="mt-2 text-sm font-bold text-stone-700">No menu items match</p>
              <p className="text-xs">Clear the search or category filter.</p>
            </div>
          )}
        </div>
      )}

      <Modal
        isOpen={Boolean(itemForm)}
        onClose={() => {
          if (!itemBusy) setItemForm(null);
        }}
        title={
          <span className="flex items-center gap-2">
            {itemForm?.id ? <Edit3 className="h-5 w-5 text-orange-600" /> : <Plus className="h-5 w-5 text-orange-600" />}
            {itemForm?.id ? "Edit menu item" : "Add menu item"}
          </span>
        }
        maxWidth="lg"
      >
        {itemForm && (
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-stone-600">
                Name *
              </label>
              <input
                value={itemForm.name}
                onChange={(event) => setItemForm({ ...itemForm, name: event.target.value })}
                maxLength={120}
                className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-stone-600">
                  Category *
                </label>
                <select
                  value={itemForm.categoryId}
                  onChange={(event) => setItemForm({ ...itemForm, categoryId: event.target.value })}
                  className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm"
                >
                  <option value="">Choose category</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-stone-600">
                  Price (₹) *
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={itemForm.price}
                  onChange={(event) => setItemForm({ ...itemForm, price: event.target.value })}
                  className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-stone-600">
                Description
              </label>
              <textarea
                value={itemForm.description}
                onChange={(event) => setItemForm({ ...itemForm, description: event.target.value })}
                rows={2}
                maxLength={500}
                className="w-full resize-none rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-xs focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <label className="flex items-center gap-2 rounded-xl border border-stone-200 bg-white p-2.5 text-xs font-semibold text-stone-700">
                <input
                  type="checkbox"
                  checked={itemForm.isVeg}
                  onChange={(event) => setItemForm({ ...itemForm, isVeg: event.target.checked })}
                  className="h-4 w-4 rounded border-stone-300 text-emerald-600"
                />
                Vegetarian
              </label>
              <label className="flex items-center gap-2 rounded-xl border border-stone-200 bg-white p-2.5 text-xs font-semibold text-stone-700">
                <input
                  type="checkbox"
                  checked={itemForm.available}
                  onChange={(event) => setItemForm({ ...itemForm, available: event.target.checked })}
                  className="h-4 w-4 rounded border-stone-300 text-emerald-600"
                />
                Available
              </label>
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-stone-500">
                  Sort order
                </label>
                <input
                  type="number"
                  value={itemForm.sortOrder}
                  onChange={(event) => setItemForm({ ...itemForm, sortOrder: event.target.value })}
                  className="w-full rounded-lg border border-stone-200 bg-stone-50 px-2 py-1.5 text-xs"
                />
              </div>
            </div>

            {itemError && (
              <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {itemError}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              {itemForm.id ? (
                <button
                  onClick={() => void removeItem(items.find((item) => item.id === itemForm.id)!)}
                  disabled={itemBusy}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-40"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete item
                </button>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => setItemForm(null)}
                  disabled={itemBusy}
                  className="rounded-xl px-4 py-2.5 text-xs font-semibold text-stone-600 hover:text-stone-900 disabled:opacity-40"
                >
                  Cancel
                </button>
                <button
                  onClick={() => void saveItem()}
                  disabled={itemBusy}
                  className="flex items-center gap-2 rounded-xl bg-orange-600 px-5 py-2.5 text-xs font-bold text-white shadow hover:bg-orange-700 disabled:opacity-40"
                >
                  {itemBusy && <Loader2 className="h-4 w-4 animate-spin" />}
                  {itemForm.id ? "Save changes" : "Add item"}
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={categoriesOpen}
        onClose={() => {
          if (!categoryBusy) setCategoriesOpen(false);
        }}
        title={
          <span className="flex items-center gap-2">
            <Tags className="h-5 w-5 text-orange-600" /> Categories
          </span>
        }
        maxWidth="lg"
      >
        <div className="space-y-4">
          {categoryForm ? (
            <div className="space-y-3 rounded-2xl border border-stone-200 bg-stone-50 p-4">
              <p className="text-xs font-black text-stone-800">
                {categoryForm.id ? "Edit category" : "New category"}
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-stone-500">
                    Name *
                  </label>
                  <input
                    value={categoryForm.name}
                    onChange={(event) => setCategoryForm({ ...categoryForm, name: event.target.value })}
                    maxLength={80}
                    className="w-full rounded-lg border border-stone-200 bg-white px-2.5 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-stone-500">
                    Icon
                  </label>
                  <input
                    value={categoryForm.icon}
                    onChange={(event) => setCategoryForm({ ...categoryForm, icon: event.target.value })}
                    maxLength={8}
                    className="w-full rounded-lg border border-stone-200 bg-white px-2.5 py-2 text-xs"
                  />
                </div>
              </div>
              <div className="w-28">
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-stone-500">
                  Sort order
                </label>
                <input
                  type="number"
                  value={categoryForm.sortOrder}
                  onChange={(event) => setCategoryForm({ ...categoryForm, sortOrder: event.target.value })}
                  className="w-full rounded-lg border border-stone-200 bg-white px-2.5 py-2 text-xs"
                />
              </div>
              {categoryError && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-[11px] font-semibold text-rose-700">
                  {categoryError}
                </div>
              )}
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setCategoryForm(null)}
                  disabled={categoryBusy}
                  className="rounded-lg px-3 py-2 text-[11px] font-semibold text-stone-500"
                >
                  Back
                </button>
                <button
                  onClick={() => void saveCategory()}
                  disabled={categoryBusy}
                  className="flex items-center gap-1.5 rounded-lg bg-orange-600 px-4 py-2 text-[11px] font-bold text-white disabled:opacity-40"
                >
                  {categoryBusy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {categoryForm.id ? "Save" : "Add category"}
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() =>
                setCategoryForm({ id: null, name: "", icon: "🍽️", sortOrder: String(categories.length + 1) })
              }
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-stone-300 bg-stone-50 px-4 py-3 text-xs font-bold text-stone-600 hover:bg-stone-100"
            >
              <FolderPlus className="h-4 w-4" /> Add a category
            </button>
          )}

          {!categoryForm && (
            <div className="divide-y divide-stone-100 rounded-xl border border-stone-200">
              {categories.map((category) => {
                const count = items.filter((item) => item.category_id === category.id).length;
                return (
                  <div key={category.id} className="flex items-center gap-2 px-3 py-2.5">
                    <span className="text-lg">{category.icon || "🍽️"}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-bold text-stone-800">{category.name}</p>
                      <p className="text-[10px] text-stone-400">
                        {count} item{count === 1 ? "" : "s"} · order {category.sort_order}
                      </p>
                    </div>
                    <button
                      onClick={() =>
                        setCategoryForm({
                          id: category.id,
                          name: category.name,
                          icon: category.icon ?? "🍽️",
                          sortOrder: String(category.sort_order),
                        })
                      }
                      className="rounded-lg border border-stone-200 p-1.5 text-stone-500 hover:text-stone-900"
                      title="Edit category"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => void removeCategory(category)}
                      disabled={categoryBusy || count > 0}
                      className="rounded-lg border border-stone-200 p-1.5 text-stone-400 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-30"
                      title={count > 0 ? "Delete the items in this category first" : "Delete category"}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {!categoryForm && categoryError && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700">
              {categoryError}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};
