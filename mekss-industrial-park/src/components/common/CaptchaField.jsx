import { RefreshCw, ShieldCheck } from 'lucide-react';
import { Spinner } from '@heroui/react';
import { getErrorMessage } from '../../utils/apiError';

/** Image captcha input driven by `useCaptcha()`. */
export const CaptchaField = ({ captcha, disabled = false, label = 'کد امنیتی' }) => (
  <div className="flex flex-col gap-1.5">
    <span className="flex items-center gap-1.5 text-sm font-medium text-[var(--color-ink)]">
      <ShieldCheck className="h-4 w-4 text-[var(--color-brand)]" />
      {label}
    </span>
    <div className="flex flex-wrap items-center gap-2">
      <div
        className="relative flex h-12 w-[150px] shrink-0 items-center justify-center overflow-hidden rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface-soft)]"
        aria-live="polite"
      >
        {captcha.image ? (
          <img
            src={captcha.image}
            alt="تصویر کد امنیتی"
            className="h-full w-full select-none object-cover"
            draggable={false}
          />
        ) : null}
        {captcha.isLoading ? (
          <span className="absolute inset-0 flex items-center justify-center bg-white/60">
            <Spinner size="sm" />
          </span>
        ) : null}
      </div>
      <button
        type="button"
        onClick={captcha.refresh}
        disabled={disabled || captcha.isLoading}
        aria-label="دریافت کد امنیتی جدید"
        title="کد جدید"
        className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--color-border)] text-[var(--color-muted)] transition hover:border-[var(--color-brand)] hover:text-[var(--color-brand)] disabled:opacity-50"
      >
        <RefreshCw className={`h-4 w-4 ${captcha.isLoading ? 'animate-spin' : ''}`} />
      </button>
      <input
        type="text"
        inputMode="numeric"
        dir="ltr"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        required
        aria-label={label}
        disabled={disabled || !captcha.captchaId}
        value={captcha.answer}
        onChange={(e) => captcha.setAnswer(e.target.value)}
        placeholder="ارقام تصویر"
        className="h-12 min-w-0 flex-1 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface-soft)] px-4 text-center text-base tracking-[0.4em] outline-none transition focus:border-[var(--color-brand)] focus:bg-white focus:ring-2 focus:ring-[var(--color-brand-soft)] disabled:opacity-60"
      />
    </div>
    {captcha.isError ? (
      <p className="text-xs text-[var(--color-danger,#dc2626)]" role="alert">
        {getErrorMessage(captcha.error, 'دریافت کد امنیتی ناموفق بود؛ دکمه کد جدید را بزنید.')}
      </p>
    ) : (
      <p className="text-xs text-[var(--color-muted)]">هر کد فقط یک بار قابل استفاده است.</p>
    )}
  </div>
);

export default CaptchaField;
