export function appBase(): string {
  const p = window.location.pathname;
  return p === '/koperasi-mbg' || p.startsWith('/koperasi-mbg/') ? '/koperasi-mbg' : '';
}
