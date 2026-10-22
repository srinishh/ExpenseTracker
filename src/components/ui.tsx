import { useEffect, type ReactNode } from 'react'

export function Modal({ open, onClose, title, children, wide }: {
  open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  )
}

/** `group` renders a div instead of a label, for fields holding several buttons: a label forwards clicks on its text to the first button. */
export function Field({ label, children, hint, span, group }: { label: string; children: ReactNode; hint?: string; span?: boolean; group?: boolean }) {
  const Tag = group ? 'div' : 'label'
  return (
    <Tag className={`field ${span ? 'span-2' : ''}`} role={group ? 'group' : undefined} aria-label={group ? label : undefined}>
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </Tag>
  )
}

export function Stat({ label, value, sub, tone, icon }: {
  label: string; value: ReactNode; sub?: ReactNode; tone?: 'good' | 'bad' | 'warn' | 'accent'; icon?: string
}) {
  return (
    <div className={`stat ${tone ? `tone-${tone}` : ''}`}>
      <div className="stat-label">{icon && <span className="stat-icon">{icon}</span>}{label}</div>
      <div className="stat-value">{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  )
}

export function Progress({ value, max, tone, thin }: { value: number; max: number; tone?: string; thin?: boolean }) {
  const p = max > 0 ? Math.min(100, (value / max) * 100) : 0
  const auto = tone ?? (p >= 100 ? 'bad' : p >= 80 ? 'warn' : 'good')
  return (
    <div className={`progress ${thin ? 'thin' : ''}`} role="progressbar" aria-valuenow={Math.round(p)} aria-valuemin={0} aria-valuemax={100}>
      <div className={`progress-bar bg-${auto}`} style={{ width: `${p}%` }} />
    </div>
  )
}

export function Empty({ icon, title, text, action }: { icon: string; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty-icon">{icon}</div>
      <div className="empty-title">{title}</div>
      {text && <p className="muted">{text}</p>}
      {action}
    </div>
  )
}

export function Tabs<T extends string>({ tabs, active, onChange }: {
  tabs: { id: T; label: ReactNode }[]; active: T; onChange: (id: T) => void
}) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map(t => (
        <button key={t.id} role="tab" aria-selected={active === t.id}
          className={`tab ${active === t.id ? 'active' : ''}`} onClick={() => onChange(t.id)}>
          {t.label}
        </button>
      ))}
    </div>
  )
}

export function Card({ title, action, children, className }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`card ${className ?? ''}`}>
      {(title || action) && (
        <div className="card-head">
          {title && <h3>{title}</h3>}
          {action}
        </div>
      )}
      {children}
    </section>
  )
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="page-head">
      <div>
        <h1>{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  )
}

export function Avatar({ name, color, size = 32 }: { name: string; color: string; size?: number }) {
  return (
    <span className="avatar" style={{ background: color, width: size, height: size, fontSize: size * 0.42 }}>
      {name.trim().charAt(0).toUpperCase()}
    </span>
  )
}

/** Number input that keeps an empty string while editing instead of forcing 0. */
export function NumInput({ value, onChange, ...rest }: {
  value: number | ''; onChange: (v: number) => void
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
  return (
    <input type="number" inputMode="decimal" step="any" {...rest}
      value={value === 0 && rest.placeholder ? '' : value}
      onChange={e => onChange(e.target.value === '' ? 0 : Number(e.target.value))} />
  )
}
