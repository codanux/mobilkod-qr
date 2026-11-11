"use client";
import { createContext, useContext, useEffect, useState } from "react";
import type { User } from "@/lib/firebase";
import { clearSession, initSession } from "@/lib/api";

type AuthCtx = { user: User | null; ready: boolean };
const Ctx = createContext<AuthCtx>({ user: null, ready: false });
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    initSession();
    let unsub: (() => void) | undefined;
    import("@/lib/firebase").then(({ getFirebaseAuth, onAuthStateChanged }) => {
      unsub = onAuthStateChanged(getFirebaseAuth(), (u) => {
        if (!u) clearSession();
        setUser(u);
        setReady(true);
      });
    }).catch(() => setReady(true));
    return () => unsub?.();
  }, []);
  return <Ctx.Provider value={{ user, ready }}>{children}</Ctx.Provider>;
}
