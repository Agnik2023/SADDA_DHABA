import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { fetchStaffRow } from "../lib/api";
import { errorMessage } from "../lib/errors";
import type { Staff } from "../types";

export interface TotpFactor {
  id: string;
  friendly_name?: string;
  factor_type: string;
  status: "verified" | "unverified";
  created_at: string;
  updated_at: string;
}

interface StaffAuthContextValue {
  session: Session | null;
  staff: Staff | null;
  loading: boolean;
  staffError: string | null;
  currentLevel: "aal1" | "aal2" | null;
  nextLevel: "aal1" | "aal2" | null;
  factors: TotpFactor[];
  mfaRequired: boolean;
  locked: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
  lock: () => void;
  unlock: (password: string) => Promise<void>;
}

const StaffAuthContext = createContext<StaffAuthContextValue | null>(null);

const COUNTER_IDLE_MS = 15 * 60 * 1000;
const KITCHEN_IDLE_MS = 8 * 60 * 60 * 1000;

export const StaffAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [staff, setStaff] = useState<Staff | null>(null);
  const [loading, setLoading] = useState(true);
  const [staffError, setStaffError] = useState<string | null>(null);
  const [currentLevel, setCurrentLevel] = useState<"aal1" | "aal2" | null>(null);
  const [nextLevel, setNextLevel] = useState<"aal1" | "aal2" | null>(null);
  const [factors, setFactors] = useState<TotpFactor[]>([]);
  const [locked, setLocked] = useState(false);

  const requestRef = useRef(0);
  const lastActivityRef = useRef(Date.now());

  const refresh = useCallback(async () => {
    const requestId = ++requestRef.current;

    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (requestId !== requestRef.current) return;

    if (sessionError) {
      setStaffError(errorMessage(sessionError));
      setSession(null);
      setStaff(null);
      setLoading(false);
      return;
    }

    const nextSession = sessionData.session ?? null;
    setSession(nextSession);
    lastActivityRef.current = Date.now();

    if (!nextSession?.user) {
      setStaff(null);
      setStaffError(null);
      setCurrentLevel(null);
      setNextLevel(null);
      setFactors([]);
      setLoading(false);
      setLocked(false);
      return;
    }

    try {
      const staffRow = await fetchStaffRow(nextSession.user.id);
      if (requestId !== requestRef.current) return;

      if (!staffRow) {
        setStaff(null);
        setStaffError(
          "This account has no staff profile. Ask the owner to add it to the staff table in Supabase."
        );
      } else if (!staffRow.active) {
        setStaff(null);
        setStaffError("This staff account has been deactivated. Contact the owner.");
      } else {
        setStaff(staffRow);
        setStaffError(null);
      }
    } catch (error) {
      if (requestId !== requestRef.current) return;
      setStaff(null);
      setStaffError(errorMessage(error));
    }

    try {
      const { data: levelData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (requestId !== requestRef.current) return;
      setCurrentLevel((levelData?.currentLevel as "aal1" | "aal2") ?? "aal1");
      setNextLevel((levelData?.nextLevel as "aal1" | "aal2") ?? null);

      const { data: factorData } = await supabase.auth.mfa.listFactors();
      if (requestId !== requestRef.current) return;
      setFactors((factorData?.totp ?? []) as TotpFactor[]);
    } catch {
      if (requestId !== requestRef.current) return;
      setCurrentLevel("aal1");
      setNextLevel(null);
      setFactors([]);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      window.setTimeout(() => {
        void refresh();
      }, 0);
    });

    return () => subscription.unsubscribe();
  }, [refresh]);

  useEffect(() => {
    if (!session || !staff || locked) return;

    const timeout = staff.role === "kitchen" ? KITCHEN_IDLE_MS : COUNTER_IDLE_MS;

    const markActive = () => {
      lastActivityRef.current = Date.now();
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") markActive();
    };

    const events: Array<keyof WindowEventMap> = ["pointerdown", "keydown", "touchstart"];
    events.forEach((event) =>
      window.addEventListener(event, markActive, { passive: true } as AddEventListenerOptions)
    );
    document.addEventListener("visibilitychange", onVisibility);

    const interval = window.setInterval(() => {
      if (Date.now() - lastActivityRef.current >= timeout) {
        setLocked(true);
      }
    }, 30 * 1000);

    return () => {
      events.forEach((event) => window.removeEventListener(event, markActive));
      document.removeEventListener("visibilitychange", onVisibility);
      window.clearInterval(interval);
    };
  }, [session, staff, locked]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) throw new Error(error.message);
      setLocked(false);
      await refresh();
    },
    [refresh]
  );

  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut({ scope: "local" });
    } finally {
      requestRef.current += 1;
      setSession(null);
      setStaff(null);
      setStaffError(null);
      setCurrentLevel(null);
      setNextLevel(null);
      setFactors([]);
      setLocked(false);
    }
  }, []);

  const lock = useCallback(() => setLocked(true), []);

  const unlock = useCallback(
    async (password: string) => {
      const email = session?.user.email;
      if (!email) throw new Error("Please sign in again.");
      await signIn(email, password);
      setLocked(false);
    },
    [session, signIn]
  );

  const mfaRequired = false;

  const value = useMemo<StaffAuthContextValue>(
    () => ({
      session,
      staff,
      loading,
      staffError,
      currentLevel,
      nextLevel,
      factors,
      mfaRequired,
      locked,
      signIn,
      signOut,
      refresh,
      lock,
      unlock,
    }),
    [
      session,
      staff,
      loading,
      staffError,
      currentLevel,
      nextLevel,
      factors,
      mfaRequired,
      locked,
      signIn,
      signOut,
      refresh,
      lock,
      unlock,
    ]
  );

  return <StaffAuthContext.Provider value={value}>{children}</StaffAuthContext.Provider>;
};

export function useStaffAuth(): StaffAuthContextValue {
  const value = useContext(StaffAuthContext);
  if (!value) throw new Error("useStaffAuth must be used inside StaffAuthProvider");
  return value;
}
