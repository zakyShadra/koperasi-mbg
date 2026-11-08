import { View } from '../components/View';
import { GlassCard } from '../components/GlassCard';
import { warkopCatalog } from '../lib/dummy';
import { fmtRp } from '../lib/format';
import {
  addWalkInOrder,
  toggleWarkopAvailability,
  useWarkopAvailability,
} from '../features/barista/barista-store';
import './Barista.css';

export default function BaristaKatalog() {
  const availability = useWarkopAvailability();

  return (
    <View>
      <div className="barista-page view-enter">
        <GlassCard className="catalog-panel">
          <div className="catalog-panel-head">
            <h2>Katalog warkop</h2>
            <button type="button" className="btn-primary" onClick={addWalkInOrder}>
              Tambah pesanan walk-in
            </button>
          </div>
          <ul className="catalog-list">
            {warkopCatalog.map((item) => {
              const available = availability[item.id] ?? item.available;
              return (
                <li key={item.id} className="catalog-row">
                  <div>
                    <p className="catalog-name">{item.name}</p>
                    <p className="catalog-price">{fmtRp(item.price)}</p>
                  </div>
                  <button
                    type="button"
                    className={`btn-sm catalog-toggle${available ? ' is-available' : ' is-out'}`}
                    aria-pressed={available}
                    onClick={() => toggleWarkopAvailability(item.id)}
                  >
                    {available ? 'Tersedia' : 'Habis'}
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="catalog-hint">
            Pesanan walk-in masuk ke kolom Baru dengan satu item default, bisa diubah nanti.
          </p>
        </GlassCard>
      </div>
    </View>
  );
}
