import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Spinner } from '@heroui/react';
import { Phone, ArrowLeft, ShieldCheck, KeyRound } from 'lucide-react';
import { authApi } from '../../services/api/auth.api';
import { useNotification } from '../../providers/NotificationProvider';
import { getErrorMessage } from '../../utils/apiError';
import {
  AuthBrand,
  AuthPanel,
  AuthSurface,
  authFieldClass,
  authLabelClass,
  authPrimaryButtonClass,
} from './AuthSurface';

const steps = ['phone', 'otp', 'done'];

/**
 * Docs flow: phone → OTP → system SMS username + temporary password → user logs in and changes password in panel.
 */
export const ForgotPasswordPage = () => {
  const navigate = useNavigate();
  const { showNotification } = useNotification();
  const [step, setStep] = useState('phone');
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    phoneNumber: '',
    otp: '',
  });

  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const sendCode = async (e) => {
    e.preventDefault();
    if (!/^09\d{9}$/.test(form.phoneNumber)) {
      showNotification('شماره موبایل باید با ۰۹ و ۱۱ رقم باشد', 'error');
      return;
    }
    setLoading(true);
    try {
      await authApi.forgotPassword({ phoneNumber: form.phoneNumber });
      setStep('otp');
      showNotification('کد بازیابی به شماره شما ارسال شد', 'success');
    } catch (error) {
      showNotification(getErrorMessage(error, 'ارسال کد بازیابی ناموفق بود'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const confirmReset = async (e) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(form.otp)) {
      showNotification('کد تایید باید ۶ رقم باشد', 'error');
      return;
    }
    setLoading(true);
    try {
      await authApi.resetPassword({
        phoneNumber: form.phoneNumber,
        otp: form.otp,
      });
      setStep('done');
      showNotification('نام کاربری و رمز موقت برای شما پیامک شد', 'success');
    } catch (error) {
      showNotification(getErrorMessage(error, 'بازیابی رمز عبور ناموفق بود'), 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthSurface>
      <AuthPanel>
        <AuthBrand
          title="بازیابی رمز عبور"
          subtitle={
            step === 'phone'
              ? 'شماره موبایل حساب خود را وارد کنید'
              : step === 'otp'
                ? 'کد پیامک‌شده را وارد کنید؛ نام کاربری و رمز موقت برایتان پیامک می‌شود'
                : 'با رمز موقت وارد شوید و از پنل رمز دلخواه خود را تنظیم کنید'
          }
        />

        <div className="mb-6 flex items-center justify-center gap-2">
          {steps.map((id, index) => {
            const activeIndex = steps.indexOf(step);
            const reached = index <= activeIndex;
            return (
              <div key={id} className="flex items-center gap-2">
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition ${
                    reached ? 'bg-[var(--color-brand)] text-white' : 'bg-slate-100 text-slate-400'
                  }`}
                >
                  {index + 1}
                </span>
                {index < steps.length - 1 && (
                  <span className={`h-px w-8 ${index < activeIndex ? 'bg-[var(--color-brand)]' : 'bg-slate-200'}`} />
                )}
              </div>
            );
          })}
        </div>

        {step === 'phone' && (
          <form onSubmit={sendCode} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <span className={authLabelClass}>شماره موبایل</span>
              <span className="relative block">
                <Phone className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="tel"
                  dir="ltr"
                  required
                  placeholder="09123456789"
                  value={form.phoneNumber}
                  onChange={(e) => update('phoneNumber', e.target.value.replace(/\D/g, '').slice(0, 11))}
                  className={authFieldClass}
                />
              </span>
            </label>
            <button type="submit" disabled={loading} className={authPrimaryButtonClass}>
              {loading ? <Spinner size="sm" /> : 'ارسال کد بازیابی'}
            </button>
          </form>
        )}

        {step === 'otp' && (
          <form onSubmit={confirmReset} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <span className={authLabelClass}>کد تایید</span>
              <span className="relative block">
                <KeyRound className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  dir="ltr"
                  required
                  maxLength={6}
                  placeholder="۶ رقمی"
                  value={form.otp}
                  onChange={(e) => update('otp', e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className={`${authFieldClass} px-10 text-center font-mono text-lg tracking-[0.35em]`}
                />
              </span>
            </label>

            <p className="rounded-xl bg-slate-50 px-3 py-2 text-xs leading-6 text-slate-600">
              پس از تایید، نام کاربری و یک رمز موقت برای شماره شما پیامک می‌شود. سپس وارد سامانه شوید و از بخش حساب کاربری رمز دلخواه خود را تنظیم کنید.
            </p>

            <button type="submit" disabled={loading} className={authPrimaryButtonClass}>
              {loading ? <Spinner size="sm" /> : 'دریافت رمز موقت'}
            </button>
            <button
              type="button"
              className="text-sm text-slate-500 hover:text-[var(--color-brand)]"
              onClick={() => setStep('phone')}
            >
              تغییر شماره موبایل
            </button>
          </form>
        )}

        {step === 'done' && (
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <ShieldCheck className="h-8 w-8" />
            </div>
            <p className="text-sm leading-7 text-slate-600">
              نام کاربری و رمز موقت پیامک شد. وارد شوید و حتماً رمز عبور را از پنل تغییر دهید.
            </p>
            <button type="button" className={authPrimaryButtonClass} onClick={() => navigate('/login')}>
              ورود به حساب کاربری
            </button>
          </div>
        )}

        <div className="mt-6 flex justify-center">
          <Link to="/login" className="flex items-center gap-1.5 text-sm font-medium text-[var(--color-brand)] hover:text-[var(--color-brand-hover)]">
            بازگشت به ورود
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </div>
      </AuthPanel>
    </AuthSurface>
  );
};

export default ForgotPasswordPage;
