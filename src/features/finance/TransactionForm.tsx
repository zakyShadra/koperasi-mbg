import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { fmtDigits } from '../../lib/format';

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
  initial?: NewTransactionInput;
  submitLabel?: string;
};

export function TransactionForm({
  open,
  onClose,
  onSubmit,
  serverError,
  mode = 'modal',
  initial,
  submitLabel,
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
    setNote(initial?.note ?? '');
    setCategory(initial?.category ?? TRANSACTION_CATEGORIES[0]);
    setAmount(String(initial ? initial.masuk || initial.keluar : ''));
    setJenis(initial && initial.keluar > 0 ? 'Keluar' : 'Masuk');
    setMetode(initial?.metode ?? 'tunai');
    setError('');
    setSubmitting(false);
  }, [open, initial]);

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

  const categoryOptions =
    initial && !TRANSACTION_CATEGORIES.includes(initial.category as (typeof TRANSACTION_CATEGORIES)[number])
      ? [initial.category, ...TRANSACTION_CATEGORIES]
      : [...TRANSACTION_CATEGORIES];

  const formBody = (
    <>
      <div className="card-head">
        <h2 id="tx-form-title">{initial ? 'Ubah transaksi' : 'Tambah transaksi'}</h2>
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
            {categoryOptions.map((c) => (
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
              type="text"
              inputMode="numeric"
              value={fmtDigits(amount)}
              onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))}
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
            {submitting ? 'Menyimpan...' : (submitLabel ?? 'Simpan transaksi')}
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
