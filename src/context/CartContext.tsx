import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { CartLine } from "../types";

const STORAGE_KEY = "sadda-cart-v1";
const MAX_QTY = 20;
const MAX_LINES = 50;

interface CartContextValue {
  lines: CartLine[];
  count: number;
  add: (menuItemId: string, qty?: number) => void;
  increment: (menuItemId: string) => void;
  decrement: (menuItemId: string) => void;
  setQty: (menuItemId: string, qty: number) => void;
  remove: (menuItemId: string) => void;
  clear: () => void;
  qtyOf: (menuItemId: string) => number;
}

const CartContext = createContext<CartContextValue | null>(null);

function readCart(): CartLine[] {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const merged = new Map<string, number>();
    for (const entry of parsed) {
      if (!entry || typeof entry.menuItemId !== "string") continue;
      const qty = Number(entry.qty);
      if (!Number.isInteger(qty) || qty < 1) continue;
      merged.set(entry.menuItemId, Math.min(MAX_QTY, (merged.get(entry.menuItemId) ?? 0) + qty));
    }
    return Array.from(merged.entries())
      .slice(0, MAX_LINES)
      .map(([menuItemId, qty]) => ({ menuItemId, qty }));
  } catch {
    return [];
  }
}

function clampQty(qty: number): number {
  return Math.max(0, Math.min(MAX_QTY, Math.floor(qty)));
}

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lines, setLines] = useState<CartLine[]>(readCart);

  useEffect(() => {
    try {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
    } catch {
      // Storage can be unavailable in private modes. The in-memory cart still works.
    }
  }, [lines]);

  const add = useCallback((menuItemId: string, qty = 1) => {
    setLines((current) => {
      const existing = current.find((line) => line.menuItemId === menuItemId);
      if (existing) {
        return current.map((line) =>
          line.menuItemId === menuItemId
            ? { ...line, qty: clampQty(line.qty + qty) }
            : line
        );
      }
      if (current.length >= MAX_LINES) return current;
      return [...current, { menuItemId, qty: clampQty(qty) }];
    });
  }, []);

  const increment = useCallback((menuItemId: string) => add(menuItemId, 1), [add]);

  const decrement = useCallback((menuItemId: string) => {
    setLines((current) =>
      current
        .map((line) =>
          line.menuItemId === menuItemId
            ? { ...line, qty: clampQty(line.qty - 1) }
            : line
        )
        .filter((line) => line.qty > 0)
    );
  }, []);

  const setQty = useCallback((menuItemId: string, qty: number) => {
    const next = clampQty(qty);
    setLines((current) =>
      next <= 0
        ? current.filter((line) => line.menuItemId !== menuItemId)
        : current.map((line) =>
            line.menuItemId === menuItemId ? { ...line, qty: next } : line
          )
    );
  }, []);

  const remove = useCallback((menuItemId: string) => {
    setLines((current) => current.filter((line) => line.menuItemId !== menuItemId));
  }, []);

  const clear = useCallback(() => setLines([]), []);

  const value = useMemo<CartContextValue>(() => {
    const count = lines.reduce((sum, line) => sum + line.qty, 0);
    return {
      lines,
      count,
      add,
      increment,
      decrement,
      setQty,
      remove,
      clear,
      qtyOf: (menuItemId: string) =>
        lines.find((line) => line.menuItemId === menuItemId)?.qty ?? 0,
    };
  }, [lines, add, increment, decrement, setQty, remove, clear]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};

export function useCart(): CartContextValue {
  const value = useContext(CartContext);
  if (!value) throw new Error("useCart must be used inside CartProvider");
  return value;
}
