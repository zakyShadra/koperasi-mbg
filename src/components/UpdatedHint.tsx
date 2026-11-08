export default function UpdatedHint({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <span className="poll-updated" role="status">
      Diperbarui
    </span>
  );
}
