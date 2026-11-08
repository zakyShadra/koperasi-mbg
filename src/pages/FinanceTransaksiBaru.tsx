import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { View } from '../components/View';
import { TransactionForm } from '../features/finance/TransactionForm';
import type { NewTransactionInput } from '../features/finance/TransactionForm';
import { createTransaction, friendlyError } from '../lib/api';
import './Finance.css';

export default function FinanceTransaksiBaru() {
  const navigate = useNavigate();
  const [serverError, setServerError] = useState('');

  const handleSubmit = async (input: NewTransactionInput) => {
    setServerError('');
    const jenis =
      input.masuk > 0
        ? input.category === 'Iuran anggota'
          ? 'simpanan'
          : 'pembayaran'
        : 'penarikan';
    try {
      await createTransaction({
        jenis,
        jumlah: input.masuk > 0 ? input.masuk : input.keluar,
        metode: input.metode,
        kategori: input.category,
        keterangan: input.note,
        pesanan_id: null,
      });
      navigate('/finance');
    } catch (e) {
      setServerError(friendlyError(e));
    }
  };

  return (
    <View>
      <div className="finance-page">
        <TransactionForm
          open
          mode="page"
          onClose={() => navigate('/finance')}
          onSubmit={handleSubmit}
          serverError={serverError}
        />
      </div>
    </View>
  );
}
