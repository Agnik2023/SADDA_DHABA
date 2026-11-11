import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchMenu, fetchOrderDetails, fetchOrders, fetchSettings, getOrderByToken } from "../lib/api";
import { supabase } from "../lib/supabase";
import type { OrderFilters } from "../types";

export function useMenu() {
  return useQuery({
    queryKey: ["menu"],
    queryFn: fetchMenu,
    staleTime: 60_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
}

export function useSettings() {
  return useQuery({
    queryKey: ["settings"],
    queryFn: fetchSettings,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: true,
  });
}

export function useOrders(filters: OrderFilters, enabled = true) {
  return useQuery({
    queryKey: ["orders", filters],
    queryFn: () => fetchOrders(filters),
    enabled,
    staleTime: 5_000,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });
}

export function useOrderByToken(token: string | null) {
  return useQuery({
    queryKey: ["public-order", token],
    queryFn: () => getOrderByToken(token as string),
    enabled: Boolean(token),
    staleTime: 3_000,
    refetchInterval: 10_000,
    refetchOnWindowFocus: true,
    retry: false,
  });
}

export function useOrderDetails(orderId: string | null) {
  return useQuery({
    queryKey: ["order-details", orderId],
    queryFn: () => fetchOrderDetails(orderId as string),
    enabled: Boolean(orderId),
    staleTime: 5_000,
    refetchOnWindowFocus: true,
  });
}

/**
 * Live updates for staff screens. RLS still decides which rows reach each
 * role, so the kitchen is never sent an unpaid order.
 */
export function useStaffRealtime(enabled = true) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled) return;

    const channel = supabase
      .channel(`staff-live-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => {
          void queryClient.invalidateQueries({ queryKey: ["orders"] });
          void queryClient.invalidateQueries({ queryKey: ["order-details"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "order_items" },
        () => {
          void queryClient.invalidateQueries({ queryKey: ["orders"] });
          void queryClient.invalidateQueries({ queryKey: ["order-details"] });
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [enabled, queryClient]);
}

export function useMenuRealtime(enabled = true) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled) return;

    const channel = supabase
      .channel(`menu-live-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "menu_items" },
        () => {
          void queryClient.invalidateQueries({ queryKey: ["menu"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "categories" },
        () => {
          void queryClient.invalidateQueries({ queryKey: ["menu"] });
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [enabled, queryClient]);
}
