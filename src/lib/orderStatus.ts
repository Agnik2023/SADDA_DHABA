import type {
  Order,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  StaffRole,
} from "../types";

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  AWAITING_PAYMENT: "Awaiting payment",
  QUEUED: "In queue",
  PREPARING: "Preparing",
  READY: "Ready",
  SERVED: "Served",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export const ORDER_STATUS_SHORT: Record<OrderStatus, string> = {
  AWAITING_PAYMENT: "Unpaid",
  QUEUED: "New",
  PREPARING: "Preparing",
  READY: "Ready",
  SERVED: "Served",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  UNPAID: "Unpaid",
  PAID: "Paid",
  REFUNDED: "Refunded",
};

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  CASH: "Cash",
  UPI_COUNTER: "UPI at counter",
  CARD_COUNTER: "Card at counter",
};

export const ROLE_LABEL: Record<StaffRole, string> = {
  dev: "Developer / Owner",
  counter: "Counter",
  kitchen: "Kitchen",
};

export type StatusTone = "success" | "warning" | "danger" | "info" | "neutral" | "primary";

export function orderStatusTone(status: OrderStatus): StatusTone {
  switch (status) {
    case "AWAITING_PAYMENT":
      return "danger";
    case "QUEUED":
      return "info";
    case "PREPARING":
      return "warning";
    case "READY":
      return "primary";
    case "SERVED":
      return "primary";
    case "COMPLETED":
      return "success";
    case "CANCELLED":
      return "neutral";
  }
}

export function paymentStatusTone(status: PaymentStatus): StatusTone {
  switch (status) {
    case "PAID":
      return "success";
    case "UNPAID":
      return "danger";
    case "REFUNDED":
      return "warning";
  }
}

export function isOpenOrder(status: OrderStatus): boolean {
  return status !== "COMPLETED" && status !== "CANCELLED";
}

export function isActivePaidOrder(status: OrderStatus): boolean {
  return ["QUEUED", "PREPARING", "READY", "SERVED"].includes(status);
}

export interface KitchenAction {
  status: OrderStatus;
  label: string;
}

export function nextKitchenAction(order: Order): KitchenAction | null {
  if (order.payment_status !== "PAID") return null;
  if (order.status === "QUEUED") {
    return { status: "PREPARING", label: "Start preparing" };
  }
  if (order.status === "PREPARING" && order.order_type === "TAKEAWAY") {
    return { status: "READY", label: "Mark ready" };
  }
  if (order.status === "PREPARING" && order.order_type === "DINE_IN") {
    return { status: "SERVED", label: "Mark served" };
  }
  return null;
}

export function nextCounterAction(order: Order): KitchenAction | null {
  if (
    order.payment_status === "PAID" &&
    (order.status === "READY" || order.status === "SERVED")
  ) {
    return { status: "COMPLETED", label: "Complete handover" };
  }
  return null;
}

export interface TimelineStep {
  key: string;
  label: string;
  description: string;
  done: boolean;
  current: boolean;
}

export function orderTimeline(order: Pick<Order, "status" | "order_type" | "payment_status">): TimelineStep[] {
  const steps = [
    {
      key: "placed",
      label: "Order placed",
      description: "Sent from the ordering screen",
    },
    {
      key: "paid",
      label: "Payment confirmed",
      description: "Verified by counter staff",
    },
    {
      key: "kitchen",
      label: "In the kitchen",
      description: "The kitchen has started preparing",
    },
    {
      key: order.order_type === "DINE_IN" ? "served" : "ready",
      label: order.order_type === "DINE_IN" ? "Served at table" : "Ready for pickup",
      description:
        order.order_type === "DINE_IN"
          ? "Your food is on its way to the table"
          : "Collect your order from the counter",
    },
    {
      key: "completed",
      label: "Completed",
      description: "Order handed over. Thank you!",
    },
  ];

  const indexByStatus: Record<OrderStatus, number> = {
    AWAITING_PAYMENT: 0,
    QUEUED: 1,
    PREPARING: 2,
    READY: 3,
    SERVED: 3,
    COMPLETED: 4,
    CANCELLED: 0,
  };

  const currentIndex = indexByStatus[order.status];
  return steps.map((step, index) => ({
    ...step,
    done: index < currentIndex || order.status === "COMPLETED",
    current: index === currentIndex && order.status !== "COMPLETED",
  }));
}
