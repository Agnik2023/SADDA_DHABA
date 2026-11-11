import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AlertCircle, Loader2, LogOut, ShieldAlert, Utensils } from "lucide-react";
import { useStaffAuth } from "../../context/StaffAuthContext";
import { useStaffRealtime } from "../../hooks/useMenu";
import { isSupabaseConfigured } from "../../lib/supabase";
import { ConfigNotice } from "../common/ConfigNotice";
import { AdminLogin } from "./AdminLogin";
import { LockScreen } from "./LockScreen";
import { AdminNavbar } from "./AdminNavbar";
import { CounterQueue } from "./CounterQueue";
import { KitchenBoard } from "./KitchenBoard";
import { MenuManager } from "./MenuManager";
import { OrderHistory } from "./OrderHistory";
import { Settings } from "./Settings";
import type { StaffRole } from "../../types";

const RoleGate: React.FC<{
  roles: StaffRole[];
  home: string;
  children: React.ReactNode;
}> = ({ roles, home, children }) => {
  const { staff } = useStaffAuth();
  if (!staff || !roles.includes(staff.role)) {
    return <Navigate to={home} replace />;
  }
  return <>{children}</>;
};

const FullScreenMessage: React.FC<{
  title: string;
  message: string;
  children?: React.ReactNode;
}> = ({ title, message, children }) => (
  <div className="flex min-h-screen items-center justify-center bg-stone-100 p-4">
    <div className="w-full max-w-md rounded-3xl border border-stone-200 bg-white p-8 text-center shadow-xl">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-orange-600 to-amber-500 text-white shadow-md">
        <Utensils className="h-6 w-6" />
      </div>
      <h1 className="font-heading mt-4 text-xl font-black text-stone-900">{title}</h1>
      <p className="mt-2 text-sm leading-relaxed text-stone-500">{message}</p>
      {children && <div className="mt-5">{children}</div>}
    </div>
  </div>
);

export const AdminDashboard: React.FC = () => {
  const { session, staff, loading, staffError, locked, signOut } = useStaffAuth();

  useStaffRealtime(Boolean(staff) && !locked);

  if (!isSupabaseConfigured) return <ConfigNotice />;

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-stone-950 text-stone-300">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
        <p className="text-xs font-bold uppercase tracking-[0.2em]">Opening staff console</p>
      </div>
    );
  }

  if (!session) return <AdminLogin />;

  if (staffError) {
    return (
      <FullScreenMessage
        title="Staff access unavailable"
        message={staffError}
      >
        <div className="space-y-2">
          <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-left text-[11px] leading-relaxed text-rose-800">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Signed in as <strong>{session.user.email}</strong>. This account cannot open the
              console until the owner fixes its staff profile.
            </span>
          </div>
          <button
            onClick={() => void signOut()}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-stone-900 px-4 py-2.5 text-xs font-bold text-white hover:bg-stone-800"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </FullScreenMessage>
    );
  }

  if (!staff) {
    return (
      <FullScreenMessage
        title="No staff profile"
        message="This account is signed in but has no active staff role. Ask the owner to add it to the staff table in Supabase."
      >
        <button
          onClick={() => void signOut()}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-stone-900 px-4 py-2.5 text-xs font-bold text-white hover:bg-stone-800"
        >
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </FullScreenMessage>
    );
  }

  if (locked) return <LockScreen />;

  const home = staff.role === "kitchen" ? "/admin/kitchen" : "/admin/counter";

  return (
    <div className="min-h-screen bg-stone-100">
      <AdminNavbar />

      <main className="mx-auto max-w-7xl px-3 py-4 sm:px-4 sm:py-5">
        <Routes>
          <Route index element={<Navigate to={home} replace />} />

          <Route
            path="counter"
            element={
              <RoleGate roles={["counter", "dev"]} home={home}>
                <CounterQueue />
              </RoleGate>
            }
          />

          <Route
            path="kitchen"
            element={
              <RoleGate roles={["kitchen", "dev"]} home={home}>
                <KitchenBoard />
              </RoleGate>
            }
          />

          <Route
            path="menu"
            element={
              <RoleGate roles={["counter", "dev"]} home={home}>
                <MenuManager />
              </RoleGate>
            }
          />

          <Route
            path="history"
            element={
              <RoleGate roles={["counter", "dev"]} home={home}>
                <OrderHistory />
              </RoleGate>
            }
          />

          <Route
            path="settings"
            element={
              <RoleGate roles={["dev"]} home={home}>
                <Settings />
              </RoleGate>
            }
          />

          <Route path="*" element={<Navigate to={home} replace />} />
        </Routes>
      </main>

      <footer className="mx-auto max-w-7xl px-4 pb-6 text-center text-[10px] text-stone-400">
        SADDA DHABA staff console · {staff.display_name} · Actions are logged
      </footer>
    </div>
  );
};
