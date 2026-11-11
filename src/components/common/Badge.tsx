import React from "react";
import {
  ORDER_STATUS_LABEL,
  PAYMENT_METHOD_LABEL,
  PAYMENT_STATUS_LABEL,
  orderStatusTone,
  paymentStatusTone,
} from "../../lib/orderStatus";
import type { OrderStatus, PaymentMethod, PaymentStatus } from "../../types";

export interface BadgeProps {
  children: React.ReactNode;
  variant?: "success" | "warning" | "danger" | "info" | "neutral" | "primary" | "veg" | "nonveg";
  className?: string;
  size?: "sm" | "md" | "lg";
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = "neutral",
  className = "",
  size = "md",
}) => {
  const sizeClasses = {
    sm: "px-2 py-0.5 text-[10px] font-semibold rounded-md",
    md: "px-2.5 py-1 text-xs font-bold rounded-lg",
    lg: "px-3 py-1.5 text-sm font-bold rounded-xl",
  };

  const variantClasses = {
    success: "bg-emerald-100 text-emerald-800 border border-emerald-300",
    warning: "bg-amber-100 text-amber-900 border border-amber-300",
    danger: "bg-rose-100 text-rose-800 border border-rose-300",
    info: "bg-sky-100 text-sky-800 border border-sky-300",
    neutral: "bg-stone-100 text-stone-700 border border-stone-300",
    primary: "bg-orange-100 text-orange-900 border border-orange-300",
    veg: "bg-emerald-50 text-emerald-700 border border-emerald-400",
    nonveg: "bg-rose-50 text-rose-700 border border-rose-400",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 tracking-wide ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
    >
      {children}
    </span>
  );
};

export const PaymentBadge: React.FC<{ status: PaymentStatus }> = ({ status }) => (
  <Badge variant={paymentStatusTone(status)}>{PAYMENT_STATUS_LABEL[status]}</Badge>
);

export const OrderStatusBadge: React.FC<{ status: OrderStatus }> = ({ status }) => (
  <Badge variant={orderStatusTone(status)}>{ORDER_STATUS_LABEL[status]}</Badge>
);

export const PaymentMethodBadge: React.FC<{ method: PaymentMethod | null }> = ({ method }) =>
  method ? <Badge variant="neutral">{PAYMENT_METHOD_LABEL[method]}</Badge> : null;

export const VegIndicator: React.FC<{ isVeg: boolean; showText?: boolean }> = ({
  isVeg,
  showText = false,
}) => {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={`inline-flex h-4 w-4 items-center justify-center rounded border-2 ${
          isVeg ? "border-emerald-600" : "border-rose-600"
        }`}
        title={isVeg ? "Vegetarian" : "Non-Vegetarian"}
      >
        <span
          className={`h-2 w-2 rounded-full ${isVeg ? "bg-emerald-600" : "bg-rose-600"}`}
        />
      </span>
      {showText && (
        <span
          className={`text-xs font-semibold ${isVeg ? "text-emerald-700" : "text-rose-700"}`}
        >
          {isVeg ? "Veg" : "Non-Veg"}
        </span>
      )}
    </span>
  );
};

export const OrderTypeBadge: React.FC<{
  orderType: "DINE_IN" | "TAKEAWAY";
  tableNumber?: string | null;
}> = ({ orderType, tableNumber }) => (
  <Badge variant={orderType === "DINE_IN" ? "primary" : "info"}>
    {orderType === "DINE_IN"
      ? tableNumber
        ? `Dine-in · Table ${tableNumber}`
        : "Dine-in"
      : "Takeaway"}
  </Badge>
);
