import { supabase } from "./supabase";
import { errorMessage } from "./errors";
import type {
  AppSettings,
  CartLine,
  Category,
  CounterOrderResult,
  CreateOrderResult,
  CustomerOrder,
  MenuItem,
  Order,
  OrderEvent,
  OrderFilters,
  PaymentMethod,
  Quote,
  Staff,
} from "../types";

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}

function throwIfError(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

export async function fetchStaffRow(userId: string): Promise<Staff | null> {
  const { data, error } = await supabase
    .from("staff")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Staff | null) ?? null;
}

export interface MenuData {
  categories: Category[];
  items: MenuItem[];
}

export async function fetchMenu(): Promise<MenuData> {
  const [categoriesResult, itemsResult] = await Promise.all([
    supabase.from("categories").select("*").order("sort_order", { ascending: true }),
    supabase
      .from("menu_items")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
  ]);

  throwIfError(categoriesResult.error);
  throwIfError(itemsResult.error);

  return {
    categories: (categoriesResult.data ?? []) as Category[],
    items: (itemsResult.data ?? []) as MenuItem[],
  };
}

export async function fetchSettings(): Promise<AppSettings> {
  const { data, error } = await supabase
    .from("app_settings")
    .select("*")
    .eq("id", true)
    .maybeSingle();

  if (error) throw new Error(error.message);

  return (
    (data as AppSettings | null) ?? {
      id: true,
      restaurant_name: "SADDA DHABA",
      tax_rate_bps: 500,
      unpaid_timeout_minutes: 30,
      updated_at: new Date().toISOString(),
    }
  );
}

export async function updateSettings(input: {
  restaurant_name: string;
  tax_rate_bps: number;
  unpaid_timeout_minutes: number;
}): Promise<AppSettings> {
  const { data, error } = await supabase
    .from("app_settings")
    .update(input)
    .eq("id", true)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data as AppSettings;
}

export async function quoteOrder(lines: CartLine[]): Promise<Quote> {
  return rpc<Quote>("quote_order", {
    p_items: lines.map((line) => ({
      menu_item_id: line.menuItemId,
      qty: line.qty,
    })),
  });
}

export interface CreateOrderInput {
  name: string;
  phone: string;
  orderType: "DINE_IN" | "TAKEAWAY";
  table: string;
  lines: CartLine[];
  notes: string;
  accessToken: string;
  idempotencyKey: string;
}

export async function createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
  return rpc<CreateOrderResult>("create_order", {
    p_name: input.name,
    p_phone: input.phone,
    p_order_type: input.orderType,
    p_table: input.table,
    p_items: input.lines.map((line) => ({
      menu_item_id: line.menuItemId,
      qty: line.qty,
    })),
    p_notes: input.notes,
    p_access_token: input.accessToken,
    p_idempotency_key: input.idempotencyKey,
  });
}

export async function getOrderByToken(token: string): Promise<CustomerOrder | null> {
  return rpc<CustomerOrder | null>("get_order_by_token", { p_token: token });
}

export async function fetchOrders(filters: OrderFilters = {}): Promise<Order[]> {
  const limit = Math.min(Math.max(filters.limit ?? 250, 1), 500);
  let query: any = supabase
    .from("orders")
    .select("*, order_items(*)")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (filters.statuses && filters.statuses.length > 0) {
    query = query.in("status", filters.statuses);
  }
  if (filters.from) {
    query = query.gte("created_at", filters.from);
  }
  if (filters.to) {
    query = query.lt("created_at", filters.to);
  }
  if (filters.search) {
    const term = filters.search
      .replace(/[^a-zA-Z0-9@._\-\s]/g, " ")
      .trim()
      .slice(0, 60);
    if (term) {
      query = query.or(
        `order_code.ilike.%${term}%,customer_name.ilike.%${term}%,customer_phone.ilike.%${term}%`
      );
    }
  }

  const { data, error } = await query;
  throwIfError(error);

  const orders = ((data ?? []) as Order[]).map((order) => ({
    ...order,
    order_items: [...(order.order_items ?? [])].sort((a, b) => a.line_no - b.line_no),
  }));

  return orders;
}

export async function fetchOrderDetails(
  orderId: string
): Promise<{ order: Order; events: OrderEvent[] }> {
  const { data, error } = await supabase
    .from("orders")
    .select("*, order_items(*), order_events(*)")
    .eq("id", orderId)
    .single();

  throwIfError(error);

  const order = data as Order;
  const events = [...(order.order_events ?? [])].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  order.order_items = [...(order.order_items ?? [])].sort((a, b) => a.line_no - b.line_no);
  delete order.order_events;

  return { order, events };
}

export async function markPaid(
  orderId: string,
  method: PaymentMethod,
  reference?: string
): Promise<{ ok: boolean; order_code: string; status: string; payment_status: string }> {
  return rpc("mark_paid", {
    p_order_id: orderId,
    p_method: method,
    p_reference: reference?.trim() || null,
  });
}

export async function updateOrderStatus(
  orderId: string,
  status: string
): Promise<{ ok: boolean; order_code: string; status: string }> {
  return rpc("update_order_status", {
    p_order_id: orderId,
    p_status: status,
  });
}

export async function cancelOrder(
  orderId: string,
  reason: string
): Promise<{ ok: boolean; order_code: string; status: string }> {
  return rpc("cancel_order", {
    p_order_id: orderId,
    p_reason: reason,
  });
}

export async function refundOrder(
  orderId: string,
  reason: string
): Promise<{ ok: boolean; order_code: string; status: string }> {
  return rpc("refund_order", {
    p_order_id: orderId,
    p_reason: reason,
  });
}

export interface CounterOrderInput {
  name: string;
  phone: string;
  orderType: "DINE_IN" | "TAKEAWAY";
  table: string;
  notes: string;
  lines: CartLine[];
  collectNow: boolean;
  method: PaymentMethod;
  reference: string;
}

export async function createCounterOrder(
  input: CounterOrderInput
): Promise<CounterOrderResult> {
  return rpc<CounterOrderResult>("create_counter_order", {
    p_name: input.name,
    p_phone: input.phone,
    p_order_type: input.orderType,
    p_table: input.table,
    p_items: input.lines.map((line) => ({
      menu_item_id: line.menuItemId,
      qty: line.qty,
    })),
    p_notes: input.notes,
    p_collect_now: input.collectNow,
    p_method: input.method,
    p_reference: input.reference.trim() || null,
  });
}

export async function setMenuItemAvailability(
  itemId: string,
  available: boolean
): Promise<void> {
  await rpc("set_menu_item_availability", {
    p_item_id: itemId,
    p_available: available,
  });
}

export async function reissueOrderToken(
  orderId: string
): Promise<{ order_code: string; access_token: string }> {
  return rpc("reissue_order_token", { p_order_id: orderId });
}

export interface MenuItemInput {
  category_id: string;
  name: string;
  description: string;
  price_paise: number;
  is_veg: boolean;
  available: boolean;
  sort_order: number;
}

export async function createMenuItem(input: MenuItemInput): Promise<MenuItem> {
  const { data, error } = await supabase.from("menu_items").insert(input).select("*").single();
  throwIfError(error);
  return data as MenuItem;
}

export async function updateMenuItem(
  id: string,
  input: Partial<MenuItemInput>
): Promise<MenuItem> {
  const { data, error } = await supabase
    .from("menu_items")
    .update(input)
    .eq("id", id)
    .select("*")
    .single();
  throwIfError(error);
  return data as MenuItem;
}

export async function deleteMenuItem(id: string): Promise<void> {
  const { error } = await supabase.from("menu_items").delete().eq("id", id);
  throwIfError(error);
}

export async function createCategory(input: {
  name: string;
  icon: string;
  sort_order: number;
}): Promise<Category> {
  const { data, error } = await supabase
    .from("categories")
    .insert(input)
    .select("*")
    .single();
  throwIfError(error);
  return data as Category;
}

export async function updateCategory(
  id: string,
  input: { name?: string; icon?: string; sort_order?: number }
): Promise<Category> {
  const { data, error } = await supabase
    .from("categories")
    .update(input)
    .eq("id", id)
    .select("*")
    .single();
  throwIfError(error);
  return data as Category;
}

export async function deleteCategory(id: string): Promise<void> {
  const { error } = await supabase.from("categories").delete().eq("id", id);
  throwIfError(error);
}

export { errorMessage };
