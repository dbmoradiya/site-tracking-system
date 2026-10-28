export function BrandLockup({ className = '' }: { className?: string }) {
  return <div className={`brand-lockup ${className}`.trim()}>
    <img className="brand-lockup__logo" src="/logo.png" alt="Shreeji Energy logo" />
  </div>
}
