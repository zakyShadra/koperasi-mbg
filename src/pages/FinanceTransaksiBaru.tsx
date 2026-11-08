import { useNavigate } from 'react-router-dom';
import { View } from '../components/View';
import { TransactionForm } from '../features/finance/TransactionForm';
import type { NewTransactionInput } from '../features/finance/TransactionForm';
import { addTransaction, formatTxDate } from '../features/finance/transactions-store';
import './Finance.css';

export default function FinanceTransaksiBaru() {
  const navigate = useNavigate();

  const handleSubmit = (input: NewTransactionInput) => {
    addTransaction({
      id: `tx-${Date.now()}`,
      date: formatTxDate(input.date),
      note: input.note,
      category: input.category,
      masuk: input.masuk,
      keluar: input.keluar,
    });
    navigate('/finance');
  };

  return (
    <View>
      <div className="finance-page">
        <TransactionForm
          open
          mode="page"
          onClose={() => navigate('/finance')}
          onSubmit={handleSubmit}
        />
      </div>
    </View>
  );
}
