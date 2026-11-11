import React from "react";
import { Link, NavLink } from "react-router-dom";
import {
  BookOpen,
  ChefHat,
  ClipboardList,
  ExternalLink,
  History,
  LockKeyhole,
  LogOut,
  Settings,
  Utensils,
} from "lucide-react";
import { useStaffAuth } from "../../context/StaffAuthContext";
import { ROLE_LABEL } from "../../lib/orderStatus";
import type { StaffRole } from "../../types";

interface Tab {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: StaffRole[];
}

const TABS: Tab[] = [
  { to: "/admin/counter", label: "Counter", icon: ClipboardList, roles: ["counter", "dev"] },
  { to: "/admin/kitchen", label: "Kitchen", icon: ChefHat, roles: ["kitchen", "dev"] },
  { to: "/admin/menu", label: "Menu", icon: BookOpen, roles: ["counter", "dev"] },
  { to: "/admin/history", label: "History", icon: History, roles: ["counter", "dev"] },
  { to: "/admin/settings", label: "Settings", icon: Settings, roles: ["dev"] },
];

export const AdminNavbar: React.FC = () => {
  const { staff, session, lock, signOut } = useStaffAuth();
  if (!staff) return null;

  const tabs = TABS.filter((tab) => tab.roles.includes(staff.role));

  const roleClasses =
    staff.role === "dev"
      ? "border-violet-500/30 bg-violet-500/15 text-violet-300"
      : staff.role === "counter"
        ? "border-sky-500/30 bg-sky-500/15 text-sky-300"
        : "border-emerald-500/30 bg-emerald-500/15 text-emerald-300";

  return (
    <header className="sticky top-0 z-40 border-b border-stone-800 bg-stone-900 text-white shadow-md">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-2.5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-orange-600 to-amber-500 shadow-md shadow-orange-600/30">
            <Utensils className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="font-heading text-base font-black tracking-tight">SADDA DHABA</p>
              <span
                className={`rounded-md border px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider ${roleClasses}`}
              >
                {ROLE_LABEL[staff.role]}
              </span>
            </div>
            <p className="flex items-center gap-1.5 text-[10px] text-stone-400">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
              Live console · {staff.display_name}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <Link
            to="/"
            target="_blank"
            className="hidden items-center gap-1.5 rounded-xl border border-stone-700 px-3 py-2 text-[11px] font-bold text-stone-300 transition hover:bg-stone-800 hover:text-white sm:flex"
            title="Open the customer ordering site"
          >
            <ExternalLink className="h-3.5 w-3.5" /> Customer site
          </Link>

          <button
            onClick={lock}
            className="rounded-xl border border-stone-700 p-2 text-stone-300 transition hover:bg-stone-800 hover:text-white"
            title="Lock the console now"
          >
            <LockKeyhole className="h-4 w-4" />
          </button>

          <button
            onClick={() => void signOut()}
            className="flex items-center gap-1.5 rounded-xl border border-stone-700 px-2.5 py-2 text-[11px] font-bold text-stone-300 transition hover:border-rose-800 hover:bg-rose-950/40 hover:text-rose-300"
            title={`Sign out ${session?.user.email ?? ""}`}
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </div>

      <nav className="mx-auto flex max-w-7xl items-center gap-1 overflow-x-auto px-3 pb-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <NavLink
              key={tab.to}
              to={tab.to}
              className={({ isActive }) =>
                `flex items-center gap-2 whitespace-nowrap rounded-xl px-3.5 py-2 text-xs font-bold transition ${
                  isActive
                    ? "bg-orange-600 text-white shadow-md shadow-orange-600/30"
                    : "text-stone-300 hover:bg-stone-800 hover:text-white"
                }`
              }
            >
              <Icon className="h-4 w-4" />
              <span>{tab.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </header>
  );
};
