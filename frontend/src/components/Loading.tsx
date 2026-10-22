export function Loading({ label = 'Loading' }: { label?: string }) {
  return <div className="loading" role="status"><span className="spinner" />{label}…</div>
}
