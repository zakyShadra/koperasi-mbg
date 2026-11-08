import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { Product } from '../../lib/dummy';
import { addLine, cartCount, cartTotal, changeLineQty } from './cart';
import type { CartLine, PlacedOrder } from './cart';

const CART_KEY = 'mbg-cart-v1';
const ORDER_KEY = 'mbg-last-order-v1';

function loadLines(): CartLine[] {
  try {
    const raw = localStorage.getItem(CART_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CartLine[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function loadLastOrder(): PlacedOrder | null {
  try {
    const raw = localStorage.getItem(ORDER_KEY);
    return raw ? (JSON.parse(raw) as PlacedOrder) : null;
  } catch {
    return null;
  }
}

export interface CartContextValue {
  lines: CartLine[];
  count: number;
  total: number;
  lastOrder: PlacedOrder | null;
  add: (product: Product) => void;
  changeQty: (productId: string, delta: number) => void;
  clear: () => void;
  recordOrder: (order: PlacedOrder) => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>(loadLines);
  const [lastOrder, setLastOrder] = useState<PlacedOrder | null>(loadLastOrder);

  useEffect(() => {
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(lines));
    } catch {
      // Penyimpanan penuh atau tidak tersedia, keranjang tetap jalan di memori.
    }
  }, [lines]);

  useEffect(() => {
    try {
      if (lastOrder) {
        localStorage.setItem(ORDER_KEY, JSON.stringify(lastOrder));
      } else {
        localStorage.removeItem(ORDER_KEY);
      }
    } catch {
      // Abaikan, pesanan terakhir tetap jalan di memori.
    }
  }, [lastOrder]);

  const value = useMemo<CartContextValue>(
    () => ({
      lines,
      count: cartCount(lines),
      total: cartTotal(lines),
      lastOrder,
      add: (product: Product) => setLines((prev) => addLine(prev, product)),
      changeQty: (productId: string, delta: number) =>
        setLines((prev) => changeLineQty(prev, productId, delta)),
      clear: () => setLines([]),
      recordOrder: (order: PlacedOrder) => {
        setLastOrder(order);
        setLines([]);
      },
    }),
    [lines, lastOrder],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart harus dipakai di dalam CartProvider');
  return ctx;
}
