import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import GlassCard from '../components/GlassCard';
import StatCard from '../components/StatCard';
import DonutChart from '../components/DonutChart';
import View from '../components/View';
import { TRANSACTION_CATEGORIES } from '../features/finance/TransactionForm';
import { parseTxDate, useTransactions } from '../features/finance/transactions-store';
import { categorySummary, financeStats } from '../lib/dummy';
import type { Transaction } from '../lib/dummy';
import { fmtRp } from '../lib/format';
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

function csvEscape(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

export default function Finance() {
  const donutData = useMemo(
    () => categorySummary.map((c) => ({ label: c.category, value: c.value, color: c.color })),
    [],
  );
  const txs = useTransactions();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const paramKategori = searchParams.get('kategori');
  const categoryFilter =
    paramKategori && TRANSACTION_CATEGORIES.some((c) => c === paramKategori)
      ? paramKategori
      : 'Semua';
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(''), 4000);
    return () => window.clearTimeout(timer);
  }, [notice]);

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

  const downloadCsv = () => {
    const header = ['Tanggal', 'Keterangan', 'Kategori', 'Masuk', 'Keluar', 'Saldo berjalan'];
    const rows = [...txs]
      .sort((a, b) => parseTxDate(a.date) - parseTxDate(b.date))
      .map((t) => [
        t.date,
        t.note,
        t.category,
        String(t.masuk),
        String(t.keluar),
        String(balanceById.get(t.id) ?? 0),
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
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setNotice('Demo: belum terhubung ke Sheet')}
          >
            Simpan ke Sheet
          </button>
        </div>
        {notice && (
          <p className="demo-notice" role="status">
            {notice}
          </p>
        )}

        <section className="finance-mid">
          <GlassCard className="tx-card stagger" style={{ '--d': '200ms' } as CSSProperties}>
            <div className="card-head">
              <h2>Pencatatan transaksi</h2>
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
                  </tr>
                </thead>
                <tbody>
                  {visibleTxs.map((t) => (
                    <tr key={t.id}>
                      <td>{t.date}</td>
                      <td>{t.note}</td>
                      <td>
                        <span className="pill category-pill">{t.category}</span>
                      </td>
                      <td className="num tx-in">{t.masuk > 0 ? fmtRp(t.masuk) : '-'}</td>
                      <td className="num tx-out">{t.keluar > 0 ? fmtRp(t.keluar) : '-'}</td>
                      <td className="num tx-balance">{fmtRp(balanceById.get(t.id) ?? 0)}</td>
                    </tr>
                  ))}
                  {visibleTxs.length === 0 && (
                    <tr>
                      <td colSpan={6} className="table-empty">
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
            <DonutChart data={donutData} />
          </GlassCard>
        </section>
      </div>
    </View>
  );
}
