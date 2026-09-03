const AUTH_BG = '/pexels-hugo-guillemard-2158157486-35536997.jpg';

export const AuthSurface = ({ children }) => (
  <div
    data-auth-surface="true"
    className="relative flex min-h-dvh items-start justify-center overflow-x-hidden overflow-y-auto bg-[#0b1622] px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))] sm:items-center sm:p-6 lg:items-stretch lg:justify-start lg:p-0"
  >
    <img
      src={AUTH_BG}
      alt=""
      className="absolute inset-0 h-full w-full object-cover animate-fade-in"
    />
    <div className="pointer-events-none absolute inset-0 bg-[#071018]/50" />
    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#071018] via-transparent to-[#071018]/35" />
    <div className="relative z-10 my-auto w-full max-w-[400px] animate-slide-up lg:my-0 lg:flex lg:min-h-dvh lg:max-w-[440px] lg:items-center">
      {children}
    </div>
  </div>
);

export const AuthPanel = ({ children }) => (
  <section className="w-full rounded-2xl bg-white px-5 py-7 text-slate-900 shadow-[0_24px_64px_rgba(0,0,0,0.38)] sm:px-6 sm:py-8 lg:min-h-dvh lg:rounded-none lg:px-11 lg:py-12 lg:shadow-[-18px_0_48px_rgba(0,0,0,0.28)]">
    {children}
  </section>
);

export const AuthBrand = ({ title, subtitle }) => (
  <header className="mb-6 text-center sm:mb-8">
    <img
      src="/icons/icon.svg"
      alt=""
      className="mx-auto mb-4 h-12 w-12 rounded-[14px] shadow-sm sm:h-14 sm:w-14"
    />
    <p className="text-2xl font-bold leading-none tracking-[0.18em] text-[#0f4c81] sm:text-[28px]">MEKSS</p>
    <h1 className="mt-3 text-base font-semibold text-slate-900 sm:mt-4 sm:text-lg">{title}</h1>
    <p className="mt-1.5 text-sm leading-6 text-slate-600">{subtitle}</p>
  </header>
);

export const authFieldClass =
  'h-12 w-full rounded-lg bg-slate-50 px-10 text-sm text-slate-900 placeholder:text-slate-400 outline-none ring-1 ring-slate-300 transition focus:bg-white focus:ring-2 focus:ring-[#0f4c81]';

export const authLabelClass = 'text-sm font-medium text-slate-700';

export const authPrimaryButtonClass =
  'mt-1 flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#0f4c81] text-sm font-bold text-white transition hover:bg-[#0c3d68] disabled:cursor-not-allowed disabled:opacity-55';
