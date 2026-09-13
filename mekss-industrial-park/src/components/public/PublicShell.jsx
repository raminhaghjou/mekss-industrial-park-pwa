import { Link, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { useState } from 'react';

const links = [
  { to: '/welcome', label: 'خانه' },
  { to: '/directory', label: 'دایرکتوری' },
  { to: '/shops', label: 'فروشگاه‌ها' },
  { to: '/sms-request', label: 'درخواست پیامکی' },
];

export const PublicShell = ({ children, bare = false }) => {
  const location = useLocation();
  const [open, setOpen] = useState(false);

  if (bare) return children;

  return (
    <div className="min-h-dvh bg-[var(--color-surface-soft)] text-[var(--color-ink)]">
      <header className="sticky top-0 z-40 border-b border-[var(--color-border)] bg-[var(--color-surface)]/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link to="/welcome" className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--color-brand)] text-sm font-bold text-[var(--color-on-brand)]">
              M
            </span>
            <span className="text-sm font-bold tracking-[0.16em] text-[var(--color-ink)]">MEKSS</span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {links.map((link) => {
              const active = location.pathname === link.to || location.pathname.startsWith(`${link.to}/`);
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`rounded-[var(--radius-sm)] px-3 py-2 text-sm font-medium transition ${
                    active
                      ? 'bg-[var(--color-brand-soft)] text-[var(--color-brand)]'
                      : 'text-[var(--color-muted)] hover:bg-[var(--color-surface-soft)] hover:text-[var(--color-ink)]'
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
            <Link
              to="/login"
              className="ms-1 rounded-[var(--radius-sm)] px-3 py-2 text-sm font-medium text-[var(--color-brand)] transition hover:bg-[var(--color-brand-soft)]"
            >
              ورود
            </Link>
            <Link
              to="/register"
              className="ms-1 inline-flex h-10 items-center rounded-[var(--radius-sm)] bg-[var(--color-brand)] px-4 text-sm font-bold text-[var(--color-on-brand)] transition hover:bg-[var(--color-brand-hover)]"
            >
              ثبت‌نام
            </Link>
          </nav>

          <button
            type="button"
            className="inline-flex h-11 w-11 items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-ink)] hover:bg-[var(--color-surface-soft)] md:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? 'بستن منو' : 'باز کردن منو'}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {open && (
          <div className="border-t border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 md:hidden">
            <div className="flex flex-col gap-1">
              {links.map((link) => {
                const active = location.pathname === link.to || location.pathname.startsWith(`${link.to}/`);
                return (
                  <Link
                    key={link.to}
                    to={link.to}
                    onClick={() => setOpen(false)}
                    className={`rounded-[var(--radius-sm)] px-3 py-2.5 text-sm font-medium ${
                      active
                        ? 'bg-[var(--color-brand-soft)] text-[var(--color-brand)]'
                        : 'text-[var(--color-ink)] hover:bg-[var(--color-surface-soft)]'
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
              <Link
                to="/login"
                onClick={() => setOpen(false)}
                className="rounded-[var(--radius-sm)] px-3 py-2.5 text-sm font-medium text-[var(--color-brand)] hover:bg-[var(--color-brand-soft)]"
              >
                ورود
              </Link>
              <Link
                to="/register"
                onClick={() => setOpen(false)}
                className="mt-1 rounded-[var(--radius-sm)] bg-[var(--color-brand)] px-3 py-2.5 text-center text-sm font-bold text-[var(--color-on-brand)]"
              >
                ثبت‌نام
              </Link>
            </div>
          </div>
        )}
      </header>

      <main>{children}</main>

      <footer className="border-t border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:px-6 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--color-brand)] text-sm font-bold text-[var(--color-on-brand)]">
                M
              </span>
              <span className="text-sm font-bold tracking-[0.16em]">MEKSS</span>
            </div>
            <p className="mt-3 max-w-sm text-sm leading-7 text-[var(--color-muted)]">
              سامانه مدیریت هوشمند شهرک صنعتی
            </p>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-[var(--color-muted)]">
            <Link to="/directory" className="hover:text-[var(--color-brand)]">دایرکتوری</Link>
            <Link to="/shops" className="hover:text-[var(--color-brand)]">فروشگاه‌ها</Link>
            <Link to="/sms-request" className="hover:text-[var(--color-brand)]">درخواست پیامکی</Link>
            <Link to="/login" className="hover:text-[var(--color-brand)]">ورود</Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default PublicShell;
