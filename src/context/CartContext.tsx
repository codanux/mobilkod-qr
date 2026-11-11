"use client";
import { createContext, useContext, useState } from "react";
import type { CartLine } from "@/types";

type CartCtx = {
  cart: CartLine[]; cartNote: string; cartOpen: boolean;
  setCart: React.Dispatch<React.SetStateAction<CartLine[]>>;
  setCartNote: React.Dispatch<React.SetStateAction<string>>;
  setCartOpen: React.Dispatch<React.SetStateAction<boolean>>;
  clearCart: () => void;
};
const Ctx = createContext<CartCtx | null>(null);
export const useCart = () => { const c = useContext(Ctx); if (!c) throw new Error("CartProvider missing"); return c; };

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<CartLine[]>([]);
  const [cartNote, setCartNote] = useState("");
  const [cartOpen, setCartOpen] = useState(false);
  return <Ctx.Provider value={{ cart, cartNote, cartOpen, setCart, setCartNote, setCartOpen, clearCart: () => { setCart([]); setCartNote(""); setCartOpen(false); } }}>{children}</Ctx.Provider>;
}
