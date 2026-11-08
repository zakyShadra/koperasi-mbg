import type { WarkopStatus } from '../../lib/warkop';

interface WarkopClosedBannerProps {
  status: WarkopStatus | null;
  onRefresh: () => void;
}

export function WarkopClosedBanner({ status, onRefresh }: WarkopClosedBannerProps) {
  if (status !== 'tutup') return null;
  return (
    <div className="warkop-closed-banner" role="status">
      <p>
        <strong>Warkop sedang tutup</strong>
        Pesanan online dijeda sampai warkop buka lagi. Katalog tetap bisa dilihat.
      </p>
      <button type="button" className="btn btn-secondary btn-sm" onClick={onRefresh}>
        Cek lagi
      </button>
    </div>
  );
}
