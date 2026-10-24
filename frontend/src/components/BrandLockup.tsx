export function BrandLockup({ className = '' }: { className?: string }) {
  return <div className={`brand-lockup ${className}`.trim()}>
    <img className="brand-lockup__logo" src="/logo.png" alt="Shreeji Enterprise logo" />
    <span className="brand-lockup__name">SHREEJI</span>
    <span className="brand-lockup__sub">ENTERPRISE</span>
  </div>
}
