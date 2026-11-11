export type StaffRole = "dev" | "counter" | "kitchen";

export type OrderType = "DINE_IN" | "TAKEAWAY";

export type OrderStatus =
  | "AWAITING_PAYMENT"
  | "QUEUED"
  | "PREPARING"
  | "READY"
  | "SERVED"
  | "COMPLETED"
  | "CANCELLED";

export type PaymentStatus = "UNPAID" | "PAID" | "REFUNDED";

export type PaymentMethod = "CASH" | "UPI_COUNTER" | "CARD_COUNTER";

export interface Staff {
  id: string;
  display_name: string;
  role: StaffRole;
  active: boolean;
  created_at: string;
}

export interface AppSettings {
  id: boolean;
  restaurant_name: string;
  tax_rate_bps: number;
  unpaid_timeout_minutes: number;
  updated_at: string;
}

export interface Category {
  id: string;
  name: string;
  sort_order: number;
  icon: string | null;
  created_at?: string;
}

export interface MenuItem {
  id: string;
  category_id: string;
  name: string;
  description: string | null;
  price_paise: number;
  is_veg: boolean;
  available: boolean;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  menu_item_id: string | null;
  name_snapshot: string;
  unit_price_paise: number;
  qty: number;
  is_veg: boolean | null;
  line_no: number;
}

export interface OrderEvent {
  id: number;
  order_id: string;
  event_type: string;
  actor_id: string | null;
  actor_role: string | null;
  details: Record<string, unknown>;
  created_at: string;
}

export interface Order {
  id: string;
  order_no: number;
  order_code: string;
  idempotency_key: string;
  customer_name: string;
  customer_phone: string | null;
  order_type: OrderType;
  table_number: string | null;
  status: OrderStatus;
  payment_status: PaymentStatus;
  payment_method: PaymentMethod | null;
  payment_reference: string | null;
  subtotal_paise: number;
  tax_paise: number;
  total_paise: number;
  notes: string | null;
  paid_at: string | null;
  paid_by: string | null;
  cancelled_at: string | null;
  cancelled_by: string | null;
  cancel_reason: string | null;
  created_at: string;
  updated_at: string;
  order_items?: OrderItem[];
  order_events?: OrderEvent[];
}

export interface CartLine {
  menuItemId: string;
  qty: number;
}

export interface QuoteLine {
  menu_item_id: string;
  name: string;
  unit_price_paise: number;
  qty: number;
  is_veg: boolean;
}

export interface Quote {
  subtotal_paise: number;
  tax_paise: number;
  total_paise: number;
  tax_rate_bps: number;
  lines: QuoteLine[];
}

export interface CreateOrderResult {
  order_code: string;
  status: OrderStatus;
  subtotal_paise: number;
  tax_paise: number;
  total_paise: number;
}

export interface CustomerOrderItem {
  name: string;
  unit_price_paise: number;
  qty: number;
  is_veg: boolean | null;
}

export interface CustomerOrder {
  order_code: string;
  status: OrderStatus;
  payment_status: PaymentStatus;
  payment_method: PaymentMethod | null;
  order_type: OrderType;
  table_number: string | null;
  customer_name: string;
  items: CustomerOrderItem[];
  subtotal_paise: number;
  tax_paise: number;
  total_paise: number;
  notes: string | null;
  created_at: string;
  paid_at: string | null;
  cancel_reason: string | null;
}

export interface CounterOrderResult {
  order_code: string;
  status: OrderStatus;
  payment_status: PaymentStatus;
  total_paise: number;
  access_token: string;
}

export interface OrderFilters {
  statuses?: OrderStatus[];
  from?: string;
  to?: string;
  search?: string;
  limit?: number;
}

export interface CheckoutDetails {
  name: string;
  phone: string;
  orderType: OrderType;
  table: string;
  notes: string;
}
