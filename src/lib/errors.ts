const MESSAGES: Record<string, string> = {
  INVALID_NAME: "Please enter a valid name (up to 80 characters).",
  INVALID_PHONE: "Enter a valid 10-digit Indian mobile number starting with 6–9.",
  INVALID_ORDER_TYPE: "Choose dine-in or takeaway.",
  INVALID_TABLE: "The table number is too long.",
  INVALID_NOTES: "Please shorten the kitchen notes (maximum 500 characters).",
  INVALID_TOKEN: "The order link is not valid.",
  IDEMPOTENCY_REQUIRED: "Please try again.",
  IDEMPOTENCY_MISMATCH: "This checkout attempt has already been used. Please close and start again.",
  INVALID_ITEMS: "Your cart contains an item that is no longer on the menu. Please refresh.",
  INVALID_ITEM_COUNT: "Please add at least one item to your cart.",
  INVALID_QTY: "One or more item quantities are invalid.",
  ITEM_UNAVAILABLE: "An item just went out of stock. Please review your cart.",
  TOO_MANY_ITEMS: "This order is too large. Please split it into smaller orders.",
  RATE_LIMITED: "Too many orders from this phone in a short time. Please wait a few minutes or ask the counter.",
  DAILY_LIMIT: "The daily order limit for this phone has been reached. Please ask the counter.",
  PAYMENT_PENDING: "This phone already has unpaid orders. Please pay at the counter or wait for them to expire.",
  ORDER_CODE_EXHAUSTED: "Could not generate an order number. Please try again.",
  ORDER_NOT_FOUND: "Order not found.",
  FORBIDDEN: "You do not have permission to do that.",
  INVALID_METHOD: "Choose a valid payment method.",
  INVALID_REFERENCE: "The payment reference is too long.",
  INVALID_STATE: "This order is not in a state that allows that action.",
  PAYMENT_REQUIRED: "Payment must be collected before the kitchen can start.",
  INVALID_TRANSITION: "That status change is not allowed.",
  REFUND_REQUIRES_DEV: "Only a dev account can refund a paid order.",
  NOT_PAID: "This order has not been paid.",
  INVALID_REASON: "Enter a cancellation reason (3–240 characters).",
  ITEM_NOT_FOUND: "Menu item not found.",
  NOT_AUTHENTICATED: "Please sign in again.",
  MFA_REQUIRED: "Please sign in again.",
};

export function errorMessage(error: unknown): string {
  let raw = "";
  if (typeof error === "string") {
    raw = error;
  } else if (error && typeof error === "object") {
    const value = error as {
      message?: string;
      error_description?: string;
      details?: string;
      hint?: string;
    };
    raw =
      value.message ||
      value.error_description ||
      value.details ||
      value.hint ||
      "";
  }

  const known = Object.keys(MESSAGES).find((code) => raw.includes(code));
  if (known) return MESSAGES[known];

  if (/invalid login credentials/i.test(raw)) {
    return "Incorrect email or password.";
  }
  if (/email not confirmed/i.test(raw)) {
    return "This account's email is not confirmed. Ask the owner to confirm it in Supabase.";
  }
  if (/invalid totp|invalid mfa|mfa.*invalid|invalid.*code/i.test(raw)) {
    return "That verification code is not valid. Check your authenticator and try again.";
  }
  if (/jwt expired|invalid jwt|token has expired/i.test(raw)) {
    return "Your session expired. Please sign in again.";
  }
  if (/failed to fetch|networkerror|network request failed|load failed/i.test(raw)) {
    return "Cannot reach the server. Check the internet connection and try again.";
  }
  if (/row-level security|permission denied/i.test(raw)) {
    return "The server denied that action. Sign in again or check your staff role.";
  }
  if (raw.length > 0 && raw.length <= 220) return raw;
  return "Something went wrong. Please try again.";
}

export function isUnavailableError(error: unknown): boolean {
  return errorMessage(error).includes("out of stock");
}
