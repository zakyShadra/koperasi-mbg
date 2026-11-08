import './styles/tokens.css';
import './styles/components.css';
import AppRouter from './app/router';
import { CartProvider } from './features/pelanggan/cart-context';

export default function App() {
  return (
    <>
      <div className="bg-photo" aria-hidden="true" />
      <div className="bg-veil" aria-hidden="true" />
      <div className="app-shell">
        <CartProvider>
          <AppRouter />
        </CartProvider>
      </div>
    </>
  );
}
