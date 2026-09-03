import { Link, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { useState } from 'react';

const links = [
  { to: '/welcome', label: 'خانه' },
  { to: '/directory', label: 'دایرکتوری' },
  { to: '/shops', label: 'فروشگاه‌ها' },
  { to: '/sms-request', label: 'درخواست پیامکی' },
  { to: '/login', label: 'ورود' },
];

export const PublicShell = ({ children, bare = false }) => {
  const location = useLocation();
  const [open, setOpen] = useState(false);

  if (bare) return children;

  return (
    <div className="min-h-dvh bg-[#f3f6f9] text-slate-900">
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link to="/welcome" className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#0f4c81] text-sm font-bold text-white">
              M
            </span>
            <span className="text-sm font-bold tracking-[0.14em] text-[#0f4c81]">MEKSS</span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {links.map((link) => {
              const active = location.pathname === link.to || location.pathname.startsWith(`${link.to}/`);
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                    active ? 'bg-[#0f4c81]/10 text-[#0f4c81]' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
            <Link
              to="/register"
              className="ms-2 rounded-lg bg-[#0f4c81] px-3.5 py-2 text-sm font-bold text-white transition hover:bg-[#0c3d68]"
            >
              ثبت‌نام
            </Link>
          </nav>

          <button
            type="button"
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100 md:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? 'بستن منو' : 'باز کردن منو'}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {open && (
          <div className="border-t border-slate-100 bg-white px-4 py-3 md:hidden">
            <div className="flex flex-col gap-1">
              {links.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  {link.label}
                </Link>
              ))}
              <Link
                to="/register"
                onClick={() => setOpen(false)}
                className="mt-1 rounded-lg bg-[#0f4c81] px-3 py-2.5 text-center text-sm font-bold text-white"
              >
                ثبت‌نام
              </Link>
            </div>
          </div>
        )}
      </header>

      <main>{children}</main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-8 text-center text-sm text-slate-500 sm:px-6">
          <p className="font-semibold text-[#0f4c81]">MEKSS</p>
          <p>سامانه مدیریت هوشمند شهرک صنعتی</p>
        </div>
      </footer>
    </div>
  );
};

export default PublicShell;
