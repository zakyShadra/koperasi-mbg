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

export function isOut(product: Product): boolean {
  return product.stock <= 0 || product.available === false;
}

export function findOutLines(lines: CartLine[], fresh: Map<number, Product>): CartLine[] {
  return lines.filter((line) => {
    const current = line.product.apiId !== undefined ? fresh.get(line.product.apiId) : undefined;
    return isOut(current ?? line.product);
  });
}

// Fungsi murni keranjang: satu modul, satu pekerjaan. Tidak ada fetch,
// tidak ada render, cuma hitung dari data keranjang yang masuk.
export function addLine(lines: CartLine[], product: Product): CartLine[] {
  if (isOut(product)) return lines;
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
      if (delta > 0 && isOut(line.product)) return line;
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
