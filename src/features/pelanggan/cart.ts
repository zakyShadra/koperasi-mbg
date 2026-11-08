import type { Product } from '../../lib/dummy';

export interface CartLine {
  product: Product;
  qty: number;
}

export interface PlacedOrderItem {
  name: string;
  qty: number;
  price: number;
}

export interface PlacedOrder {
  number: string;
  name: string;
  wa: string;
  methodLabel: string;
  methodId?: PaymentMethodId;
  total: number;
  itemCount: number;
  items: PlacedOrderItem[];
  createdAt: string;
  qrisPayload?: string;
  qrisDummy?: boolean;
  status?: string;
  orderId?: number;
}

// Fungsi murni keranjang: satu modul, satu pekerjaan. Tidak ada fetch,
// tidak ada render, cuma hitung dari data keranjang yang masuk.
export function addLine(lines: CartLine[], product: Product): CartLine[] {
  if (product.stock <= 0) return lines;
  const existing = lines.find((line) => line.product.id === product.id);
  if (existing) {
    if (existing.qty >= product.stock) return lines;
    return lines.map((line) =>
      line.product.id === product.id ? { ...line, qty: line.qty + 1 } : line,
    );
  }
  return [...lines, { product, qty: 1 }];
}

export function changeLineQty(
  lines: CartLine[],
  productId: string,
  delta: number,
): CartLine[] {
  return lines
    .map((line) => {
      if (line.product.id !== productId) return line;
      const qty = Math.min(line.qty + delta, line.product.stock);
      return { ...line, qty };
    })
    .filter((line) => line.qty > 0);
}

export function cartCount(lines: CartLine[]): number {
  return lines.reduce((sum, line) => sum + line.qty, 0);
}

export function cartTotal(lines: CartLine[]): number {
  return lines.reduce((sum, line) => sum + line.product.price * line.qty, 0);
}

// Metode bayar sebagai data, bukan if/else di checkout. Tambah metode
// baru berarti tambah satu baris di sini, checkout tidak disentuh.
export const PAYMENT_METHODS = [
  { id: 'tunai', label: 'Tunai di tempat', hint: 'Bayar saat ambil pesanan' },
  {
    id: 'transfer',
    label: 'Transfer bank',
    hint: 'Konfirmasi via WA setelah transfer',
  },
  { id: 'qris', label: 'QRIS', hint: 'Scan kode saat ambil pesanan' },
] as const;

export type PaymentMethodId = (typeof PAYMENT_METHODS)[number]['id'];
