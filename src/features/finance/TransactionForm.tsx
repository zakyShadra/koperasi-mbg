import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';

export const TRANSACTION_CATEGORIES = [
  'Penjualan',
  'Belanja bahan',
  'Gaji',
  'Operasional',
  'Iuran anggota',
] as const;

export const TRANSACTION_METHODS = [
  { id: 'tunai', label: 'Tunai' },
  { id: 'transfer', label: 'Transfer' },
  { id: 'qris', label: 'QRIS' },
] as const;

export type NewTransactionInput = {
  note: string;
  category: string;
  masuk: number;
  keluar: number;
  metode: string;
};

type TransactionFormProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (tx: NewTransactionInput) => void | Promise<void>;
  serverError?: string;
  mode?: 'modal' | 'page';
};

export function TransactionForm({
  open,
  onClose,
  onSubmit,
  serverError,
  mode = 'modal',
}: TransactionFormProps) {
  const [note, setNote] = useState('');
  const [category, setCategory] = useState<string>(TRANSACTION_CATEGORIES[0]);
  const [amount, setAmount] = useState('');
  const [jenis, setJenis] = useState<'Masuk' | 'Keluar'>('Masuk');
  const [metode, setMetode] = useState<string>('tunai');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setNote('');
    setCategory(TRANSACTION_CATEGORIES[0]);
    setAmount('');
    setJenis('Masuk');
    setMetode('tunai');
    setError('');
    setSubmitting(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const handleSubmit = async (e: FormEvent) => {
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
    setError('');
    setSubmitting(true);
    try {
      await onSubmit({
        note: note.trim(),
        category,
        masuk: jenis === 'Masuk' ? jumlah : 0,
        keluar: jenis === 'Keluar' ? jumlah : 0,
        metode,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const formBody = (
    <>
      <div className="card-head">
        <h2 id="tx-form-title">Tambah transaksi</h2>
        <button type="button" className="tx-modal-close" onClick={onClose} aria-label="Tutup">
          Tutup
        </button>
      </div>
      <form onSubmit={(e) => void handleSubmit(e)} noValidate>
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
          <label className="tx-field" htmlFor="tx-metode">
            <span>Metode</span>
            <select id="tx-metode" value={metode} onChange={(e) => setMetode(e.target.value)}>
              {TRANSACTION_METHODS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="form-note">Tanggal dicatat otomatis (hari ini).</p>
        {(error || serverError) && (
          <p className="tx-error" role="alert">
            {error || serverError}
          </p>
        )}
        <div className="tx-form-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Batal
          </button>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Menyimpan...' : 'Simpan transaksi'}
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
