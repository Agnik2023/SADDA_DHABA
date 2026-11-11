import React, { useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowLeft, ReceiptText, Utensils } from "lucide-react";
import { OrderStatusView } from "./OrderStatusView";
import { isValidOrderToken } from "../../lib/customerToken";
import { isSupabaseConfigured } from "../../lib/supabase";
import { ConfigNotice } from "../common/ConfigNotice";

export const OrderStatusPage: React.FC = () => {
  const location = useLocation();

  const token = useMemo(() => {
    const hash = location.hash.startsWith("#") ? location.hash.slice(1) : location.hash;
    return hash.trim();
  }, [location.hash]);

  if (!isSupabaseConfigured) return <ConfigNotice />;

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-orange-600 to-amber-500 text-white shadow-md shadow-orange-600/30">
              <Utensils className="h-4 w-4" />
            </div>
            <div>
              <p className="font-heading text-sm font-black leading-tight text-stone-900">
                SADDA DHABA
              </p>
              <p className="text-[10px] leading-tight text-stone-400">Order tracking</p>
            </div>
          </Link>

          <Link
            to="/"
            className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs font-bold text-stone-600 shadow-sm transition hover:bg-stone-50"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Menu
          </Link>
        </div>
      </header>

      {!isValidOrderToken(token) ? (
        <div className="mx-auto max-w-lg p-4">
          <div className="rounded-3xl border border-stone-200 bg-white p-8 text-center shadow-sm">
            <ReceiptText className="mx-auto h-12 w-12 stroke-1 text-stone-300" />
            <h1 className="font-heading mt-3 text-xl font-black text-stone-900">
              Order link missing
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-stone-500">
              Open the full link from your order confirmation, or ask counter staff to reissue your
              tracking link.
            </p>
            <Link
              to="/"
              className="mt-5 inline-flex items-center gap-1.5 rounded-xl bg-orange-600 px-5 py-2.5 text-xs font-bold text-white shadow hover:bg-orange-700"
            >
              <Utensils className="h-4 w-4" /> Back to the menu
            </Link>
          </div>
        </div>
      ) : (
        <OrderStatusView token={token} />
      )}

      <footer className="pb-8 text-center text-[11px] text-stone-400">
        Keep this link private. It gives access to this order only.
      </footer>
    </div>
  );
};
