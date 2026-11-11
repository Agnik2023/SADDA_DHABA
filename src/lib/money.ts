const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export function formatPaise(paise: number | null | undefined): string {
  if (paise === null || paise === undefined || !Number.isFinite(paise)) {
    return "₹0";
  }
  return inr.format(paise / 100);
}

export function paiseToRupees(paise: number | null | undefined): number {
  if (paise === null || paise === undefined || !Number.isFinite(paise)) return 0;
  return paise / 100;
}

export function rupeesToPaise(value: string | number): number {
  const parsed =
    typeof value === "number" ? value : Number.parseFloat(value.replace(/[^\d.]/g, ""));
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.round(parsed * 100);
}

export function formatRupeesPlain(paise: number | null | undefined): string {
  return paiseToRupees(paise).toFixed(2);
}

export function taxPercent(taxRateBps: number): number {
  return taxRateBps / 100;
}

export function estimateTax(subtotalPaise: number, taxRateBps: number): number {
  return Math.round((subtotalPaise * taxRateBps) / 10000);
}
