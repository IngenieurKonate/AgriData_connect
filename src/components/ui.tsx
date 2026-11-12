import { useEffect, useRef, type ReactNode, type ButtonHTMLAttributes, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { ArrowRight, X, type LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';

export function Button({ variant = 'secondary', className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' }) {
  return <button className={`button button-${variant} ${className}`} {...props} />;
}

export function ActionLink({ to, children, primary = false }: { to: string; children: ReactNode; primary?: boolean }) {
  return <Link className={`button button-${primary ? 'primary' : 'secondary'}`} to={to}>{children}<ArrowRight size={17} aria-hidden="true" /></Link>;
}

export function Badge({ children }: { children: ReactNode }) { return <span className="badge">{children}</span>; }

export function PageHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return <div className="page-heading"><div><p className="eyebrow">{eyebrow}</p><h1 tabIndex={-1}>{title}</h1><p className="page-description">{description}</p></div>{action}</div>;
}

export function EmptyState({ icon: Icon, title, children, action }: { icon: LucideIcon; title: string; children: ReactNode; action?: ReactNode }) {
  return <div className="empty-state"><span className="empty-icon"><Icon size={30} strokeWidth={1.5} aria-hidden="true" /></span><h2>{title}</h2><p>{children}</p>{action}</div>;
}

export function Dialog({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
  }, [open]);
  return <dialog ref={ref} className="dialog" aria-label={title} onCancel={event => { event.preventDefault(); onClose(); }} onClose={onClose} onKeyDown={event => {
    if (event.key !== 'Tab') return;
    const elements = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]')).filter(element => element.getClientRects().length > 0);
    const first = elements[0]; const last = elements.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
    <div className="dialog-inner"><div className="dialog-heading"><h2>{title}</h2><button autoFocus className="icon-button" onClick={onClose} aria-label="Fermer"><X size={21} /></button></div>{children}</div>
  </dialog>;
}

export function Field({ label, id, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; id: string }) {
  return <div className="field"><label htmlFor={id}>{label}</label><input id={id} {...props} /></div>;
}

export function SelectField({ label, id, children, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { label: string; id: string }) {
  return <div className="field"><label htmlFor={id}>{label}</label><select id={id} {...props}>{children}</select></div>;
}

export function TextAreaField({ label, id, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; id: string }) {
  return <div className="field"><label htmlFor={id}>{label}</label><textarea id={id} {...props} /></div>;
}
