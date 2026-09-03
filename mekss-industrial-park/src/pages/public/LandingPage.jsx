import { Link } from 'react-router-dom';
import { ArrowLeft, Building2, LogIn, UserPlus } from 'lucide-react';

const AUTH_BG = '/pexels-hugo-guillemard-2158157486-35536997.jpg';

export const LandingPage = () => (
  <div className="relative min-h-dvh overflow-hidden bg-[#071018] text-white">
    <img
      src={AUTH_BG}
      alt=""
      className="absolute inset-0 h-full w-full object-cover animate-fade-in"
    />
    <div className="pointer-events-none absolute inset-0 bg-[#071018]/55" />
    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#071018] via-[#071018]/35 to-transparent" />

    <div className="relative z-10 flex min-h-dvh flex-col">
      <header className="flex items-center justify-between px-5 pb-4 pt-[max(1.25rem,env(safe-area-inset-top))] sm:px-8">
        <div className="flex items-center gap-2">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0f4c81] text-lg font-bold shadow-lg shadow-black/30">
            M
          </span>
          <span className="text-sm font-bold tracking-[0.2em]">MEKSS</span>
        </div>
        <Link
          to="/directory"
          className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-2 text-sm font-medium backdrop-blur transition hover:bg-white/18"
        >
          <Building2 className="h-4 w-4" />
          دایرکتوری
        </Link>
      </header>

      <section className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-end px-5 pb-16 pt-24 sm:justify-center sm:px-8 sm:pb-24 sm:pt-12">
        <p className="mb-4 text-4xl font-bold tracking-[0.22em] text-white sm:text-5xl animate-slide-up">
          MEKSS
        </p>
        <h1 className="max-w-xl text-2xl font-semibold leading-10 text-white sm:text-3xl sm:leading-[2.75rem] animate-slide-up" style={{ animationDelay: '80ms' }}>
          مدیریت یکپارچه شهرک صنعتی، از ورود تا خروج
        </h1>
        <p className="mt-4 max-w-lg text-base leading-8 text-white/80 animate-slide-up" style={{ animationDelay: '140ms' }}>
          دسترسی سریع به خدمات واحدهای صنعتی، درخواست‌ها، مجوز عبور و ارتباط با مدیریت شهرک.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center animate-slide-up" style={{ animationDelay: '200ms' }}>
          <Link
            to="/login"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#0f4c81] px-6 text-sm font-bold text-white transition hover:bg-[#0c3d68]"
          >
            <LogIn className="h-4 w-4" />
            ورود
          </Link>
          <Link
            to="/register"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-white px-6 text-sm font-bold text-[#0f4c81] transition hover:bg-slate-100"
          >
            <UserPlus className="h-4 w-4" />
            ثبت‌نام
          </Link>
          <Link
            to="/directory"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-white/30 px-6 text-sm font-medium text-white transition hover:bg-white/10"
          >
            دایرکتوری واحدها
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </div>

        <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-white/70 animate-slide-up" style={{ animationDelay: '260ms' }}>
          <Link to="/shops" className="hover:text-white">فروشگاه واحدها</Link>
          <span className="text-white/30">|</span>
          <Link to="/sms-request" className="hover:text-white">ثبت درخواست با کد پیامکی</Link>
        </div>
      </section>
    </div>
  </div>
);

export default LandingPage;
