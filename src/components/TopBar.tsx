// Top bar ramping: cuma logo, judul halaman, dan tanggal. Navigasi pindah
// ke sidebar (Sidebar.tsx), blok user + logout juga di bawah sidebar.
interface TopBarProps {
  title: string;
}

export function TopBar({ title }: TopBarProps) {
  const today = new Date().toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <header className="topbar">
      <div className="topbar__brand">
        <span className="topbar__logo">MBG</span>
        <span className="topbar__title">{title}</span>
      </div>
      <span className="topbar__date">{today}</span>
    </header>
  );
}

export default TopBar;
