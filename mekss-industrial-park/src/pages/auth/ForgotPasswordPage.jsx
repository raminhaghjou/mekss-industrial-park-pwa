import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Spinner } from '@heroui/react';
import { Phone, Lock, ArrowLeft, ShieldCheck, KeyRound, Eye, EyeOff } from 'lucide-react';
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

export const ForgotPasswordPage = () => {
  const navigate = useNavigate();
  const { showNotification } = useNotification();
  const [step, setStep] = useState('phone');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({
    phoneNumber: '',
    otp: '',
    newPassword: '',
    confirmPassword: '',
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

  const resetPassword = async (e) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(form.otp)) {
      showNotification('کد تایید باید ۶ رقم باشد', 'error');
      return;
    }
    if (form.newPassword.length < 10) {
      showNotification('رمز عبور جدید حداقل ۱۰ کاراکتر باشد', 'error');
      return;
    }
    if (form.newPassword !== form.confirmPassword) {
      showNotification('رمز عبور و تکرار آن یکسان نیستند', 'error');
      return;
    }
    setLoading(true);
    try {
      await authApi.resetPassword({
        phoneNumber: form.phoneNumber,
        otp: form.otp,
        newPassword: form.newPassword,
      });
      setStep('done');
      showNotification('رمز عبور با موفقیت تغییر کرد', 'success');
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
                ? 'کد پیامک‌شده و رمز جدید را وارد کنید'
                : 'اکنون می‌توانید با رمز جدید وارد شوید'
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
                    reached ? 'bg-[#0f4c81] text-white' : 'bg-slate-100 text-slate-400'
                  }`}
                >
                  {index + 1}
                </span>
                {index < steps.length - 1 && (
                  <span className={`h-px w-8 ${index < activeIndex ? 'bg-[#0f4c81]' : 'bg-slate-200'}`} />
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
          <form onSubmit={resetPassword} className="flex flex-col gap-4">
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

            <label className="flex flex-col gap-1.5">
              <span className={authLabelClass}>رمز عبور جدید</span>
              <span className="relative block">
                <Lock className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={10}
                  placeholder="حداقل ۱۰ کاراکتر"
                  value={form.newPassword}
                  onChange={(e) => update('newPassword', e.target.value)}
                  className={`${authFieldClass} pe-11`}
                />
                <button
                  type="button"
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label="نمایش رمز"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </span>
            </label>

            <label className="flex flex-col gap-1.5">
              <span className={authLabelClass}>تکرار رمز عبور</span>
              <span className="relative block">
                <Lock className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={10}
                  placeholder="تکرار رمز جدید"
                  value={form.confirmPassword}
                  onChange={(e) => update('confirmPassword', e.target.value)}
                  className={authFieldClass}
                />
              </span>
            </label>

            <button type="submit" disabled={loading} className={authPrimaryButtonClass}>
              {loading ? <Spinner size="sm" /> : 'ثبت رمز جدید'}
            </button>
            <button
              type="button"
              className="text-sm text-slate-500 hover:text-[#0f4c81]"
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
              رمز عبور حساب شما به‌روزرسانی شد. برای ادامه وارد شوید.
            </p>
            <button type="button" className={authPrimaryButtonClass} onClick={() => navigate('/login')}>
              ورود به حساب کاربری
            </button>
          </div>
        )}

        <div className="mt-6 flex justify-center">
          <Link to="/login" className="flex items-center gap-1.5 text-sm font-medium text-[#0f4c81] hover:text-[#0c3d68]">
            بازگشت به ورود
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </div>
      </AuthPanel>
    </AuthSurface>
  );
};

export default ForgotPasswordPage;
