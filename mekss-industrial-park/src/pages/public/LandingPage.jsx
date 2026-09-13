import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Building2,
  LogIn,
  UserPlus,
  Ticket,
  Receipt,
  FileText,
  Megaphone,
  AlertTriangle,
  Store,
  MessageSquareText,
  ShieldCheck,
  Clock3,
  Wallet,
  Headphones,
} from 'lucide-react';

const HERO_BG = '/pexels-hugo-guillemard-2158157486-35536997.jpg';

const services = [
  { to: '/directory', label: 'دایرکتوری واحدها', icon: Building2 },
  { to: '/shops', label: 'فروشگاه واحدها', icon: Store },
  { to: '/login', label: 'مجوز عبور', icon: Ticket },
  { to: '/login', label: 'قبض و پرداخت', icon: Receipt },
  { to: '/sms-request', label: 'درخواست خدمات', icon: FileText },
  { to: '/login', label: 'اطلاعیه‌ها', icon: Megaphone },
  { to: '/login', label: 'اضطراری', icon: AlertTriangle },
  { to: '/sms-request', label: 'درخواست پیامکی', icon: MessageSquareText },
  { to: '/login', label: 'ورود به سامانه', icon: LogIn },
  { to: '/register', label: 'ثبت‌نام', icon: UserPlus },
];

const benefits = [
  {
    icon: ShieldCheck,
    title: 'کنترل تردد دیجیتال',
    body: 'صدور و تایید مجوز عبور بدون کاغذبازی؛ نگهبان و مدیریت شهرک همیشه هم‌ترازند.',
  },
  {
    icon: Wallet,
    title: 'قبض و پرداخت یکپارچه',
    body: 'مشاهده قبض‌ها، پیگیری وضعیت و پرداخت آنلاین از داخل همان سامانه.',
  },
  {
    icon: Clock3,
    title: 'درخواست در چند دقیقه',
    body: 'ثبت درخواست خدمات یا کد پیامکی، بدون مراجعه حضوری به دفتر شهرک.',
  },
  {
    icon: Headphones,
    title: 'ارتباط با مدیریت شهرک',
    body: 'اطلاعیه‌ها، پیام‌ها و آگهی‌های واحدها در یک کانال رسمی و قابل پیگیری.',
  },
];

const navLinks = [
  { to: '/directory', label: 'دایرکتوری' },
  { to: '/shops', label: 'فروشگاه‌ها' },
  { to: '/sms-request', label: 'درخواست پیامکی' },
];

export const LandingPage = () => (
  <div className="min-h-dvh bg-[var(--color-surface)] text-[var(--color-ink)]">
    <header className="sticky top-0 z-40 border-b border-[var(--color-border)] bg-[var(--color-surface)]/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link to="/welcome" className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--color-brand)] text-sm font-bold text-[var(--color-on-brand)]">
            M
          </span>
          <span className="text-sm font-bold tracking-[0.16em] text-[var(--color-ink)]">MEKSS</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="rounded-[var(--radius-sm)] px-3 py-2 text-sm font-medium text-[var(--color-muted)] transition hover:bg-[var(--color-surface-soft)] hover:text-[var(--color-ink)]"
            >
              {link.label}
            </Link>
          ))}
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

        <div className="flex items-center gap-2 md:hidden">
          <Link
            to="/login"
            className="rounded-[var(--radius-sm)] px-3 py-2 text-sm font-medium text-[var(--color-brand)]"
          >
            ورود
          </Link>
          <Link
            to="/register"
            className="inline-flex h-10 items-center rounded-[var(--radius-sm)] bg-[var(--color-brand)] px-3.5 text-sm font-bold text-[var(--color-on-brand)]"
          >
            ثبت‌نام
          </Link>
        </div>
      </div>
    </header>

    <section className="relative isolate min-h-[calc(100dvh-4rem)] overflow-hidden">
      <img
        src={HERO_BG}
        alt=""
        className="absolute inset-0 h-full w-full object-cover animate-fade-in"
      />
      <div className="pointer-events-none absolute inset-0 bg-[var(--color-ink)]/55" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[var(--color-ink)] via-[var(--color-ink)]/40 to-transparent" />

      <div className="relative z-10 mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-6xl flex-col justify-end px-4 pb-16 pt-24 sm:justify-center sm:px-6 sm:pb-24 sm:pt-12">
        <p className="mb-4 text-4xl font-bold tracking-[0.2em] text-white sm:text-5xl animate-slide-up">
          MEKSS
        </p>
        <h1
          className="max-w-2xl text-2xl font-bold leading-10 text-white sm:text-[2rem] sm:leading-[1.4] animate-slide-up"
          style={{ animationDelay: '80ms' }}
        >
          مدیریت یکپارچه شهرک صنعتی، از ورود تا خروج
        </h1>
        <p
          className="mt-4 max-w-xl text-base leading-8 text-white/85 animate-slide-up"
          style={{ animationDelay: '140ms' }}
        >
          دسترسی سریع به خدمات واحدهای صنعتی، درخواست‌ها، مجوز عبور و ارتباط با مدیریت شهرک.
        </p>

        <div
          className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center animate-slide-up"
          style={{ animationDelay: '200ms' }}
        >
          <Link
            to="/login"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-[var(--radius-sm)] bg-[var(--color-brand)] px-6 text-base font-bold text-[var(--color-on-brand)] transition hover:bg-[var(--color-brand-hover)]"
          >
            <LogIn className="h-4 w-4" />
            ورود به وب‌اپلیکیشن
          </Link>
          <Link
            to="/directory"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-[var(--radius-sm)] border border-white/40 bg-white/10 px-6 text-base font-medium text-white backdrop-blur transition hover:bg-white/18"
          >
            دایرکتوری واحدها
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>

    <section className="bg-[var(--color-surface)] px-4 py-14 sm:px-6 sm:py-16">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto mb-10 max-w-2xl text-center animate-slide-up">
          <h2 className="text-[var(--text-title)] font-bold text-[var(--color-ink)] sm:text-[1.75rem]">
            سرویس‌های MEKSS
          </h2>
          <p className="mt-3 text-base leading-8 text-[var(--color-muted)]">
            یک سامانه برای تمام نیازهای شهرک صنعتی
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-5">
          {services.map((service, index) => {
            const Icon = service.icon;
            return (
              <Link
                key={`${service.to}-${service.label}`}
                to={service.to}
                className="group flex flex-col items-center gap-3 rounded-[var(--radius-md)] bg-[var(--color-surface-soft)] px-3 py-5 text-center transition hover:-translate-y-0.5 hover:bg-white hover:shadow-[var(--shadow-card)] animate-slide-up"
                style={{ animationDelay: `${Math.min(index, 9) * 40}ms` }}
              >
                <span className="flex h-14 w-14 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-brand-soft)] text-[var(--color-brand)] transition group-hover:bg-[var(--color-brand)] group-hover:text-white">
                  <Icon className="h-6 w-6" />
                </span>
                <span className="text-sm font-medium leading-6 text-[var(--color-ink)]">
                  {service.label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </section>

    <section className="bg-[var(--color-surface-soft)] px-4 py-14 sm:px-6 sm:py-16">
      <div className="mx-auto max-w-6xl">
        <div className="mb-10 max-w-2xl animate-slide-up">
          <h2 className="text-[var(--text-title)] font-bold text-[var(--color-ink)] sm:text-[1.75rem]">
            چرا واحدها به MEKSS می‌آیند؟
          </h2>
          <p className="mt-3 text-base leading-8 text-[var(--color-muted)]">
            فرآیندهای شهرک را دیجیتال کنید؛ از مجوز عبور تا قبض و ارتباط با مدیریت.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {benefits.map((item, index) => {
            const Icon = item.icon;
            return (
              <article
                key={item.title}
                className="rounded-[var(--radius-md)] bg-white p-5 shadow-[var(--shadow-card)] animate-slide-up"
                style={{ animationDelay: `${index * 70}ms` }}
              >
                <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--color-brand-soft)] text-[var(--color-brand)]">
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="text-base font-bold text-[var(--color-ink)]">{item.title}</h3>
                <p className="mt-2 text-sm leading-7 text-[var(--color-muted)]">{item.body}</p>
              </article>
            );
          })}
        </div>
      </div>
    </section>

    <section className="px-4 py-14 sm:px-6 sm:py-16">
      <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-8 overflow-hidden rounded-[var(--radius-lg)] bg-[var(--color-brand)] px-6 py-10 text-[var(--color-on-brand)] sm:flex-row sm:items-center sm:px-10 animate-slide-up">
        <div className="max-w-xl">
          <h2 className="text-xl font-bold leading-9 sm:text-2xl">
            در چند دقیقه ثبت‌نام کنید و به سامانه شهرک بپیوندید
          </h2>
          <p className="mt-3 text-sm leading-7 text-white/90 sm:text-base">
            بدون مراجعه حضوری، دسترسی به دایرکتوری، درخواست‌ها و خدمات واحد صنعتی خود را فعال کنید.
          </p>
        </div>
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          <Link
            to="/register"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-[var(--radius-sm)] bg-white px-6 text-sm font-bold text-[var(--color-brand)] transition hover:bg-[var(--color-brand-soft)]"
          >
            <UserPlus className="h-4 w-4" />
            ثبت‌نام
          </Link>
          <Link
            to="/login"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-[var(--radius-sm)] border border-white/50 px-6 text-sm font-medium text-white transition hover:bg-white/10"
          >
            <LogIn className="h-4 w-4" />
            ورود
          </Link>
        </div>
      </div>
    </section>

    <footer className="border-t border-[var(--color-border)] bg-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:px-6 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--color-brand)] text-sm font-bold text-white">
              M
            </span>
            <span className="text-sm font-bold tracking-[0.16em]">MEKSS</span>
          </div>
          <p className="mt-3 max-w-sm text-sm leading-7 text-[var(--color-muted)]">
            سامانه مدیریت هوشمند شهرک صنعتی — مجوز عبور، قبض، درخواست و ارتباط با مدیریت در یک پلتفرم.
          </p>
        </div>

        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-[var(--color-muted)]">
          <Link to="/directory" className="hover:text-[var(--color-brand)]">دایرکتوری</Link>
          <Link to="/shops" className="hover:text-[var(--color-brand)]">فروشگاه‌ها</Link>
          <Link to="/sms-request" className="hover:text-[var(--color-brand)]">درخواست پیامکی</Link>
          <Link to="/login" className="hover:text-[var(--color-brand)]">ورود</Link>
          <Link to="/register" className="hover:text-[var(--color-brand)]">ثبت‌نام</Link>
        </div>
      </div>
    </footer>
  </div>
);

export default LandingPage;
