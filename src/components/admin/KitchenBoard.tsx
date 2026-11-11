import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Bell,
  BellOff,
  ChefHat,
  CheckCircle2,
  Clock,
  CookingPot,
  Expand,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useOrders } from "../../hooks/useMenu";
import { useToast } from "../../context/ToastContext";
import { updateOrderStatus } from "../../lib/api";
import { errorMessage } from "../../lib/errors";
import type { Order, OrderStatus } from "../../types";
import { OrderCard } from "./OrderCard";
import { OrderDetailsModal } from "./OrderDetailsModal";

const KITCHEN_STATUSES: OrderStatus[] = ["QUEUED", "PREPARING", "READY", "SERVED"];
const SOUND_KEY = "sadda-kitchen-sound";

function playChime(): void {
  try {
    const AudioContextClass =
      window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    const now = context.currentTime;
    [880, 1174.66].forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, now + index * 0.16);
      gain.gain.exponentialRampToValueAtTime(0.18, now + index * 0.16 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + index * 0.16 + 0.28);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(now + index * 0.16);
      oscillator.stop(now + index * 0.16 + 0.3);
    });
    window.setTimeout(() => void context.close(), 800);
  } catch {
    // Audio is a convenience; some browsers block it until user interaction.
  }
}

export const KitchenBoard: React.FC = () => {
  const { data: orders = [], isLoading, isError, error, refetch, isFetching } = useOrders({
    statuses: KITCHEN_STATUSES,
    limit: 300,
  });
  const { notify } = useToast();
  const queryClient = useQueryClient();

  const [soundOn, setSoundOn] = useState(() => {
    try {
      return window.localStorage.getItem(SOUND_KEY) !== "off";
    } catch {
      return true;
    }
  });
  const [busyId, setBusyId] = useState<string | null>(null);
  const [detailsId, setDetailsId] = useState<string | null>(null);

  const knownQueuedRef = useRef<Set<string> | null>(null);

  const queued = useMemo(
    () =>
      orders
        .filter((order) => order.status === "QUEUED")
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
    [orders]
  );
  const preparing = useMemo(
    () =>
      orders
        .filter((order) => order.status === "PREPARING")
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
    [orders]
  );
  const handover = useMemo(
    () =>
      orders
        .filter((order) => order.status === "READY" || order.status === "SERVED")
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
    [orders]
  );

  useEffect(() => {
    if (isLoading) return;
    const currentIds = new Set(queued.map((order) => order.id));
    if (knownQueuedRef.current === null) {
      knownQueuedRef.current = currentIds;
      return;
    }
    const hasNew = Array.from(currentIds).some((id) => !knownQueuedRef.current?.has(id));
    if (hasNew && soundOn) playChime();
    knownQueuedRef.current = currentIds;
  }, [queued, isLoading, soundOn]);

  const toggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    try {
      window.localStorage.setItem(SOUND_KEY, next ? "on" : "off");
    } catch {
      // ignore
    }
    if (next) playChime();
  };

  const changeStatus = async (order: Order, status: OrderStatus) => {
    if (busyId) return;
    setBusyId(order.id);
    try {
      await updateOrderStatus(order.id, status);
      notify(
        `${order.order_code} · ${status === "PREPARING" ? "preparing" : status === "READY" ? "ready" : "served"}.`,
        "success"
      );
      await queryClient.invalidateQueries({ queryKey: ["orders"] });
      await queryClient.invalidateQueries({ queryKey: ["order-details"] });
    } catch (err) {
      notify(errorMessage(err), "error");
    } finally {
      setBusyId(null);
    }
  };

  const requestFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      notify("Fullscreen is not available in this browser.", "info");
    }
  };

  const columnClasses = [
    {
      title: "New tickets",
      hint: "Paid, waiting to start",
      icon: Clock,
      tone: "border-sky-200 bg-sky-50 text-sky-800",
      dot: "bg-sky-500",
      orders: queued,
    },
    {
      title: "Preparing",
      hint: "On the fire now",
      icon: CookingPot,
      tone: "border-amber-200 bg-amber-50 text-amber-800",
      dot: "bg-amber-500",
      orders: preparing,
    },
    {
      title: "Ready / served",
      hint: "Waiting for counter handover",
      icon: CheckCircle2,
      tone: "border-emerald-200 bg-emerald-50 text-emerald-800",
      dot: "bg-emerald-500",
      orders: handover,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-orange-600">
            Kitchen
          </p>
          <h1 className="font-heading text-2xl font-black tracking-tight text-stone-900">
            Prep board
          </h1>
          <p className="mt-0.5 text-xs text-stone-500">
            Only paid orders from the counter reach this screen.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={toggleSound}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2.5 text-xs font-bold shadow-sm transition ${
              soundOn
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-stone-200 bg-white text-stone-500"
            }`}
            title="Toggle new-order chime"
          >
            {soundOn ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
            {soundOn ? "Chime on" : "Chime off"}
          </button>
          <button
            onClick={() => void requestFullscreen()}
            className="rounded-xl border border-stone-200 bg-white p-2.5 text-stone-500 shadow-sm transition hover:text-stone-800"
            title="Toggle fullscreen"
          >
            <Expand className="h-4 w-4" />
          </button>
          <button
            onClick={() => void refetch()}
            className="rounded-xl border border-stone-200 bg-white p-2.5 text-stone-500 shadow-sm transition hover:text-stone-800"
            title="Refresh"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-stone-200 bg-white p-3 text-[11px] text-stone-500">
        <span className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
          Payment gate active · {orders.length} paid ticket{orders.length === 1 ? "" : "s"} on
          board
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
          Live updates · {new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
        </span>
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

      <div className="grid gap-4 xl:grid-cols-3">
        {columnClasses.map((column) => {
          const Icon = column.icon;
          return (
            <section
              key={column.title}
              className="flex min-h-[16rem] flex-col overflow-hidden rounded-2xl border border-stone-200 bg-stone-100/60"
            >
              <div className={`flex items-center justify-between gap-2 border-b p-3 ${column.tone}`}>
                <div>
                  <h2 className="flex items-center gap-1.5 text-sm font-black">
                    <Icon className="h-4 w-4" /> {column.title}
                  </h2>
                  <p className="text-[10px] opacity-70">{column.hint}</p>
                </div>
                <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-white/70 px-2 font-heading text-sm font-black">
                  {column.orders.length}
                </span>
              </div>

              <div className="flex-1 space-y-3 p-3">
                {isLoading ? (
                  <div className="h-36 animate-pulse rounded-xl bg-white" />
                ) : column.orders.length === 0 ? (
                  <div className="flex h-32 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-stone-300 text-stone-400">
                    <ChefHat className="h-6 w-6 stroke-1" />
                    <p className="text-[11px] font-semibold">Nothing here</p>
                  </div>
                ) : (
                  column.orders.map((order) => (
                    <OrderCard
                      key={order.id}
                      order={order}
                      mode="kitchen"
                      busy={busyId === order.id}
                      onView={(value) => setDetailsId(value.id)}
                      onStatus={(value, status) => void changeStatus(value, status)}
                    />
                  ))
                )}
              </div>
            </section>
          );
        })}
      </div>

      <p className="text-center text-[11px] text-stone-400">
        Completed handovers are marked by counter staff after the guest collects the order.
      </p>

      <OrderDetailsModal
        orderId={detailsId}
        onClose={() => {
          setDetailsId(null);
          void queryClient.invalidateQueries({ queryKey: ["orders"] });
        }}
      />
    </div>
  );
};
