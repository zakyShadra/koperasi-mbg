import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import GlassCard from '../components/GlassCard';
import StatCard from '../components/StatCard';
import { CashFlowChart, CategoryDonut } from '../components/MbgCharts';
import View from '../components/View';
import UpdatedHint from '../components/UpdatedHint';
import { TRANSACTION_CATEGORIES, TransactionForm } from '../features/finance/TransactionForm';
import type { NewTransactionInput } from '../features/finance/TransactionForm';
import {
  SHEET_URL,
  deleteTransaction,
  friendlyError,
  getCashReport,
  getTransactions,
  updateTransaction,
} from '../lib/api';
import { usePolling } from '../lib/usePolling';
import type { ApiTransaction } from '../lib/api';
import type { Transaction } from '../lib/dummy';
import { fmtRp, formatTxDate, parseTxDate, todayWib } from '../lib/format';
import './Finance.css';

const FINANCE_ICONS: ReactNode[] = [
  <svg key="masuk" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 4v12" />
    <path d="M6 10l6 6 6-6" />
    <path d="M4 20h16" />
  </svg>,
  <svg key="keluar" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 20V8" />
    <path d="M6 14l6-6 6 6" />
    <path d="M4 4h16" />
  </svg>,
  <svg key="saldo" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="2" y="6" width="20" height="14" rx="2" />
    <path d="M2 10h20" />
    <path d="M16 15h.01" />
  </svg>,
];

const DONUT_COLORS = ['#2dd4bf', '#fbbf24', '#fb923c', '#a8b5af', '#34d399', '#f87171'];

function mapTransaction(t: ApiTransaction): Transaction {
  const masuk = t.jenis === 'pembayaran' || t.jenis === 'simpanan' ? t.jumlah : 0;
  return {
    id: t.kode,
    date: formatTxDate(t.dibuat_pada.slice(0, 10)),
    note: t.keterangan ?? '-',
    category: t.kategori ?? 'Lainnya',
    masuk,
    keluar: t.jenis === 'penarikan' ? t.jumlah : 0,
  };
}

function csvEscape(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

export default function Finance() {
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [rawTxs, setRawTxs] = useState<ApiTransaction[]>([]);
  const [cash, setCash] = useState<{ masuk: number; keluar: number; saldo: number } | null>(null);
  const [donutData, setDonutData] = useState<{ label: string; value: number; color: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<ApiTransaction | null>(null);
  const [editServerError, setEditServerError] = useState('');
  const [confirmingDelete, setConfirmingDelete] = useState<number | null>(null);
  const [actionError, setActionError] = useState('');
  const [actionNotice, setActionNotice] = useState('');
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const paramKategori = searchParams.get('kategori');
  const categoryFilter =
    paramKategori && TRANSACTION_CATEGORIES.some((c) => c === paramKategori)
      ? paramKategori
      : 'Semua';

  const load = useCallback(async (): Promise<string> => {
    try {
      const today = todayWib();
      const monthStart = `${today.slice(0, 8)}01`;
      const [list, report] = await Promise.all([
        getTransactions(),
        getCashReport(monthStart, today),
      ]);
      const mapped = list.map(mapTransaction);
      setRawTxs(list);
      setTxs(mapped);
      setCash({ masuk: report.masuk, keluar: report.keluar, saldo: report.saldo });
      const byCategory = new Map<string, number>();
      for (const row of report.per_kategori) {
        const key = row.kategori ?? 'Lainnya';
        byCategory.set(key, (byCategory.get(key) ?? 0) + row.jumlah);
      }
      setDonutData(
        [...byCategory.entries()].map(([label, value], i) => ({
          label,
          value,
          color: DONUT_COLORS[i % DONUT_COLORS.length],
        })),
      );
      setError('');
      return JSON.stringify([
        mapped.map((t) => [t.id, t.masuk, t.keluar]),
        report.masuk,
        report.keluar,
        report.saldo,
      ]);
    } catch (e) {
      setError(friendlyError(e));
      return '';
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const { justUpdated } = usePolling(load);

  const cashByDay = useMemo(() => {
    const grouped = new Map<string, { day: string; masuk: number; keluar: number; sort: number }>();
    for (const t of txs) {
      const ts = parseTxDate(t.date);
      const row = grouped.get(t.date) ?? {
        day: new Date(ts).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }),
        masuk: 0,
        keluar: 0,
        sort: ts,
      };
      row.masuk += t.masuk;
      row.keluar += t.keluar;
      grouped.set(t.date, row);
    }
    return [...grouped.values()]
      .sort((a, b) => a.sort - b.sort)
      .map(({ day, masuk, keluar }) => ({ day, masuk, keluar }));
  }, [txs]);

  const balanceById = useMemo(() => {
    const sorted = [...txs].sort((a, b) => parseTxDate(a.date) - parseTxDate(b.date));
    const map = new Map<Transaction['id'], number>();
    let running = 0;
    for (const t of sorted) {
      running += t.masuk - t.keluar;
      map.set(t.id, running);
    }
    return map;
  }, [txs]);

  const visibleTxs = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = txs.filter((t) => {
      if (categoryFilter !== 'Semua' && t.category !== categoryFilter) return false;
      if (!q) return true;
      return t.note.toLowerCase().includes(q) || t.category.toLowerCase().includes(q);
    });
    return [...filtered].sort((a, b) => parseTxDate(b.date) - parseTxDate(a.date));
  }, [txs, search, categoryFilter]);

  const rawByKode = useMemo(
    () => new Map(rawTxs.map((t) => [t.kode, t])),
    [rawTxs],
  );

  const editingInitial = useMemo<NewTransactionInput | undefined>(() => {
    if (!editing) return undefined;
    return {
      note: editing.keterangan ?? '',
      category: editing.kategori ?? TRANSACTION_CATEGORIES[0],
      masuk: editing.jenis === 'penarikan' ? 0 : editing.jumlah,
      keluar: editing.jenis === 'penarikan' ? editing.jumlah : 0,
      metode: editing.metode,
    };
  }, [editing]);

  const handleEditSubmit = async (input: NewTransactionInput) => {
    if (!editing) return;
    setEditServerError('');
    const jenis =
      input.masuk > 0
        ? input.category === 'Iuran anggota'
          ? 'simpanan'
          : 'pembayaran'
        : 'penarikan';
    try {
      await updateTransaction(editing.id, {
        jenis,
        jumlah: input.masuk > 0 ? input.masuk : input.keluar,
        metode: input.metode,
        kategori: input.category,
        keterangan: input.note,
      });
      setEditing(null);
      setActionNotice('Transaksi diubah.');
      setActionError('');
      await load();
    } catch (e) {
      setEditServerError(friendlyError(e));
    }
  };

  const handleDelete = async (id: number) => {
    setActionError('');
    setActionNotice('');
    try {
      await deleteTransaction(id);
      setConfirmingDelete(null);
      setActionNotice('Transaksi dihapus.');
      await load();
    } catch (e) {
      setActionError(friendlyError(e));
    }
  };

  const financeStats = [
    { label: 'Kas masuk bulan ini', value: cash ? fmtRp(cash.masuk) : 'Memuat...' },
    { label: 'Kas keluar bulan ini', value: cash ? fmtRp(cash.keluar) : 'Memuat...' },
    { label: 'Saldo kas', value: cash ? fmtRp(cash.saldo) : 'Memuat...' },
  ];

  const downloadCsv = () => {
    const header = ['Tanggal', 'Keterangan', 'Kategori', 'Masuk', 'Keluar', 'Saldo berjalan'];
    const rows = [...txs]
      .sort((a, b) => parseTxDate(a.date) - parseTxDate(b.date))
      .map((t) => [
        t.date,
        t.note,
        t.category,
        fmtRp(t.masuk),
        fmtRp(t.keluar),
        fmtRp(balanceById.get(t.id) ?? 0),
      ]);
    const csv = [header, ...rows].map((r) => r.map(csvEscape).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'laporan-keuangan.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <View>
      <div className="finance-page">
        <section className="stats-row stats-row-3" aria-label="Ringkasan kas">
          {financeStats.map((s, i) => (
            <StatCard
              key={s.label}
              label={s.label}
              value={s.value}
              icon={FINANCE_ICONS[i]}
              delay={i * 50}
            />
          ))}
        </section>

        <div className="finance-actions">
          <button type="button" className="btn btn-primary" onClick={() => navigate('/finance/transaksi-baru')}>
            Tambah transaksi
          </button>
          <button type="button" className="btn btn-secondary" onClick={downloadCsv}>
            Download laporan (CSV)
          </button>
          <a className="btn btn-secondary" href={SHEET_URL} target="_blank" rel="noreferrer">
            Buka Spreadsheet
          </a>
        </div>
        {error && (
          <p className="demo-notice" role="alert">
            {error}
          </p>
        )}
        {actionNotice && (
          <p className="demo-notice" role="status">
            {actionNotice}
          </p>
        )}
        {actionError && (
          <p className="demo-notice" role="alert">
            {actionError}
          </p>
        )}

        <section className="finance-mid">
          <GlassCard className="tx-card stagger" style={{ '--d': '200ms' } as CSSProperties}>
            <div className="card-head">
              <h2>Pencatatan transaksi</h2>
              <UpdatedHint show={justUpdated} />
              <span className="card-count">
                {visibleTxs.length} dari {txs.length} transaksi
              </span>
            </div>
            <div className="filter-bar">
              <input
                type="search"
                className="filter-search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari keterangan atau kategori"
                aria-label="Cari transaksi"
              />
              <div className="chips" role="group" aria-label="Filter kategori">
                {['Semua', ...TRANSACTION_CATEGORIES].map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={categoryFilter === c ? 'pill chip chip-active' : 'pill chip'}
                    aria-pressed={categoryFilter === c}
                    onClick={() => {
                      if (c === 'Semua') {
                        searchParams.delete('kategori');
                        setSearchParams(searchParams);
                      } else {
                        setSearchParams({ kategori: c });
                      }
                    }}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
            <div className="mbg-table-wrap">
              <table className="mbg-table finance-table">
                <thead>
                  <tr>
                    <th>Tanggal</th>
                    <th>Keterangan</th>
                    <th>Kategori</th>
                    <th className="num">Masuk</th>
                    <th className="num">Keluar</th>
                    <th className="num">Saldo berjalan</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="table-empty">
                        Memuat transaksi...
                      </td>
                    </tr>
                  ) : (
                    visibleTxs.map((t) => {
                      const raw = rawByKode.get(t.id);
                      const deleting = raw ? confirmingDelete === raw.id : false;
                      return (
                        <tr key={t.id}>
                          <td>{t.date}</td>
                          <td>{t.note}</td>
                          <td>
                            <span className="pill category-pill">{t.category}</span>
                          </td>
                          <td className="num tx-in">{t.masuk > 0 ? fmtRp(t.masuk) : '-'}</td>
                          <td className="num tx-out">{t.keluar > 0 ? fmtRp(t.keluar) : '-'}</td>
                          <td className="num tx-balance">{fmtRp(balanceById.get(t.id) ?? 0)}</td>
                          <td>
                            {raw && (
                              <span className="tx-row-actions">
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-sm"
                                  onClick={() => {
                                    setEditing(raw);
                                    setEditServerError('');
                                    setActionError('');
                                    setActionNotice('');
                                  }}
                                >
                                  Ubah
                                </button>
                                {deleting ? (
                                  <>
                                    <button
                                      type="button"
                                      className="btn btn-sm tx-delete-confirm"
                                      onClick={() => void handleDelete(raw.id)}
                                    >
                                      Ya, hapus
                                    </button>
                                    <button
                                      type="button"
                                      className="btn btn-secondary btn-sm"
                                      onClick={() => setConfirmingDelete(null)}
                                    >
                                      Batal
                                    </button>
                                  </>
                                ) : (
                                  <button
                                    type="button"
                                    className="btn btn-sm tx-delete"
                                    onClick={() => setConfirmingDelete(raw.id)}
                                  >
                                    Hapus
                                  </button>
                                )}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                  {!loading && visibleTxs.length === 0 && (
                    <tr>
                      <td colSpan={7} className="table-empty">
                        Tidak ada transaksi yang cocok.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </GlassCard>

          <GlassCard className="donut-card stagger" style={{ '--d': '250ms' } as CSSProperties}>
            <div className="card-head">
              <h2>Rekap per kategori</h2>
            </div>
            {donutData.length > 0 ? (
              <CategoryDonut data={donutData} />
            ) : (
              <p className="empty-note">Belum ada transaksi bulan ini.</p>
            )}
          </GlassCard>
        </section>

        <GlassCard className="cash-card stagger" style={{ '--d': '300ms' } as CSSProperties}>
          <div className="card-head">
            <h2>Arus kas per hari</h2>
            <span className="card-count">{cashByDay.length} hari</span>
          </div>
          <CashFlowChart data={cashByDay} />
          <p className="card-foot">Kas masuk vs kas keluar per hari, dari transaksi tercatat.</p>
        </GlassCard>
      </div>
      <TransactionForm
        open={editing !== null}
        mode="modal"
        initial={editingInitial}
        submitLabel="Simpan perubahan"
        serverError={editServerError}
        onClose={() => {
          setEditing(null);
          setEditServerError('');
        }}
        onSubmit={(input) => void handleEditSubmit(input)}
      />
    </View>
  );
}
