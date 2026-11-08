import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';

export const TRANSACTION_CATEGORIES = [
  'Penjualan',
  'Belanja bahan',
  'Gaji',
  'Operasional',
  'Iuran anggota',
] as const;

export type NewTransactionInput = {
  date: string;
  note: string;
  category: string;
  masuk: number;
  keluar: number;
};

type TransactionFormProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (tx: NewTransactionInput) => void;
  // 'modal': melayang di atas halaman (dipakai dulu di Finance).
  // 'page': form jadi isi halaman sendiri (/finance/transaksi-baru).
  mode?: 'modal' | 'page';
};

function todayIso(): string {
  const d = new Date();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

export function TransactionForm({ open, onClose, onSubmit, mode = 'modal' }: TransactionFormProps) {
  const [date, setDate] = useState(todayIso());
  const [note, setNote] = useState('');
  const [category, setCategory] = useState<string>(TRANSACTION_CATEGORIES[0]);
  const [amount, setAmount] = useState('');
  const [jenis, setJenis] = useState<'Masuk' | 'Keluar'>('Masuk');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setDate(todayIso());
    setNote('');
    setCategory(TRANSACTION_CATEGORIES[0]);
    setAmount('');
    setJenis('Masuk');
    setError('');
  }, [open ]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!note.trim()) {
      setError('Keterangan wajib diisi.');
      return;
    }
    const jumlah = Number(amount);
    if (!amount || Number.isNaN(jumlah) || jumlah <= 0) {
      setError('Jumlah harus lebih dari 0.');
      return;
    }
    if (!date) {
      setError('Tanggal wajib diisi.');
      return;
    }
    setError('');
    onSubmit({
      date,
      note: note.trim(),
      category,
      masuk: jenis === 'Masuk' ? jumlah : 0,
      keluar: jenis === 'Keluar' ? jumlah : 0,
    });
  };

  const formBody = (
    <>
      <div className="card-head">
        <h2 id="tx-form-title">Tambah transaksi</h2>
        <button type="button" className="tx-modal-close" onClick={onClose} aria-label="Tutup">
          Tutup
        </button>
      </div>
      <form onSubmit={handleSubmit} noValidate>
        <label className="tx-field" htmlFor="tx-date">
          <span>Tanggal</span>
          <input
            id="tx-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </label>
        <label className="tx-field" htmlFor="tx-note">
          <span>Keterangan</span>
          <input
            id="tx-note"
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Contoh: Penjualan kopi hari ini"
            aria-invalid={error === 'Keterangan wajib diisi.'}
            required
          />
        </label>
        <label className="tx-field" htmlFor="tx-category">
          <span>Kategori</span>
          <select id="tx-category" value={category} onChange={(e) => setCategory(e.target.value)}>
            {TRANSACTION_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <div className="tx-row">
          <label className="tx-field" htmlFor="tx-amount">
            <span>Jumlah (Rp)</span>
            <input
              id="tx-amount"
              type="number"
              min="1"
              step="1"
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              aria-invalid={error === 'Jumlah harus lebih dari 0.'}
              required
            />
          </label>
          <label className="tx-field" htmlFor="tx-jenis">
            <span>Jenis</span>
            <select id="tx-jenis" value={jenis} onChange={(e) => setJenis(e.target.value as 'Masuk' | 'Keluar')}>
              <option value="Masuk">Masuk</option>
              <option value="Keluar">Keluar</option>
            </select>
          </label>
        </div>
        {error && (
          <p className="tx-error" role="alert">
            {error}
          </p>
        )}
        <div className="tx-form-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Batal
          </button>
          <button type="submit" className="btn btn-primary">
            Simpan transaksi
          </button>
        </div>
      </form>
    </>
  );

  if (mode === 'page') {
    return (
      <div className="glass-card tx-page" role="dialog" aria-labelledby="tx-form-title">
        {formBody}
      </div>
    );
  }

  return (
    <div className="tx-modal-veil" role="presentation" onClick={onClose}>
      <div
        className="tx-modal glass-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tx-form-title"
        onClick={(e) => e.stopPropagation()}
      >
        {formBody}
      </div>
    </div>
  );
}
