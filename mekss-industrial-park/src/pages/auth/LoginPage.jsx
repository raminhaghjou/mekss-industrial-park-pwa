import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Spinner } from '@heroui/react';
import { Eye, EyeOff, Phone, Lock, ArrowLeft, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../providers/AuthProvider';
import { useNotification } from '../../providers/NotificationProvider';
import {
  AuthBrand,
  AuthPanel,
  AuthSurface,
  authFieldClass,
  authLabelClass,
  authPrimaryButtonClass,
} from './AuthSurface';

export const LoginPage = () => {
  const navigate = useNavigate();
  const { login, sendOtp, verifyOtp } = useAuth();
  const { showNotification } = useNotification();

  const [formData, setFormData] = useState({
    identifier: '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [loginMethod, setLoginMethod] = useState('password');
  const [formError, setFormError] = useState('');

  const resolveCredentials = () => {
    const raw = formData.identifier.trim();
    if (/^09\d{9}$/.test(raw.replace(/\D/g, '')) || raw.startsWith('09')) {
      const phone = raw.replace(/\D/g, '').slice(0, 11);
      return { phoneNumber: phone, password: formData.password };
    }
    return { username: raw.toLowerCase(), password: formData.password };
  };

  const handleSendOtp = async () => {
    const phone = formData.identifier.replace(/\D/g, '').slice(0, 11);
    if (!/^09\d{9}$/.test(phone)) {
      setFormError('برای ورود با کد یک‌بارمصرف شماره موبایل ۱۱ رقمی وارد کنید');
      showNotification('برای ورود با کد یک‌بارمصرف شماره موبایل ۱۱ رقمی وارد کنید', 'error');
      return;
    }

    setFormError('');
    setLoading(true);
    const result = await sendOtp(phone);
    setLoading(false);

    if (result.success) {
      setOtpSent(true);
      showNotification('کد تایید ارسال شد', 'success');
    } else {
      setFormError(result.error || 'ارسال کد تایید ناموفق بود');
      showNotification(result.error || 'ارسال کد تایید ناموفق بود', 'error');
    }
  };

  const handleOtpLogin = async () => {
    const phone = formData.identifier.replace(/\D/g, '').slice(0, 11);
    if (!otpCode || otpCode.length !== 6) {
      setFormError('لطفاً کد تایید ۶ رقمی را وارد کنید');
      showNotification('لطفاً کد تایید ۶ رقمی را وارد کنید', 'error');
      return;
    }

    setFormError('');
    setLoading(true);
    const result = await verifyOtp(phone, otpCode);
    setLoading(false);

    if (result.success) {
      showNotification('ورود با موفقیت انجام شد', 'success');
      navigate(result.data?.mustChangePassword ? '/profile?changePassword=1' : '/dashboard');
    } else {
      setFormError(result.error || 'کد تایید اشتباه است');
      showNotification(result.error || 'کد تایید اشتباه است', 'error');
    }
  };

  const handlePasswordLogin = async () => {
    if (!formData.identifier || !formData.password) {
      setFormError('لطفاً تمام فیلدها را پر کنید');
      showNotification('لطفاً تمام فیلدها را پر کنید', 'error');
      return;
    }

    setFormError('');
    setLoading(true);
    const result = await login(resolveCredentials());
    setLoading(false);

    if (result.success) {
      showNotification('ورود با موفقیت انجام شد', 'success');
      navigate(result.mustChangePassword ? '/profile?changePassword=1' : '/dashboard');
    } else {
      setFormError(result.error || 'ورود ناموفق بود');
      showNotification(result.error || 'ورود ناموفق بود', 'error');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loginMethod === 'otp') {
      await handleOtpLogin();
    } else {
      await handlePasswordLogin();
    }
  };

  return (
    <AuthSurface>
      <AuthPanel>
        <AuthBrand
          title="ورود به حساب کاربری"
          subtitle="مدیریت دیجیتال و یکپارچه شهرک صنعتی"
        />

        <div className="mb-6 grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => setLoginMethod('password')}
            className={`rounded-md px-3 py-2 text-sm font-medium transition ${
              loginMethod === 'password'
                ? 'bg-white text-[var(--color-brand)] shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            ورود با رمز عبور
          </button>
          <button
            type="button"
            onClick={() => setLoginMethod('otp')}
            className={`rounded-md px-3 py-2 text-sm font-medium transition ${
              loginMethod === 'otp'
                ? 'bg-white text-[var(--color-brand)] shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            رمز یک‌بار مصرف
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {formError ? (
            <div
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-800"
            >
              {formError}
            </div>
          ) : null}

          <label className="flex flex-col gap-1.5">
            <span className={authLabelClass}>
              {loginMethod === 'otp' ? 'شماره تلفن همراه' : 'نام کاربری یا شماره موبایل'}
            </span>
            <span className="relative block">
              <Phone className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                dir="ltr"
                required
                placeholder={loginMethod === 'otp' ? '۰۹۱۲۳۴۵۶۷۸۹' : 'username یا 0912...'}
                value={formData.identifier}
                onChange={(e) => setFormData({ ...formData, identifier: e.target.value })}
                className={`${authFieldClass} text-left`}
              />
            </span>
          </label>

          {loginMethod === 'password' && (
            <label className="flex flex-col gap-1.5">
              <span className={authLabelClass}>رمز عبور</span>
              <span className="relative block">
                <Lock className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="رمز عبور خود را وارد کنید"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className={`${authFieldClass} pl-11`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                  aria-label={showPassword ? 'پنهان کردن رمز' : 'نمایش رمز'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </span>
            </label>
          )}

          {loginMethod === 'otp' && (
            <>
              <button
                type="button"
                onClick={handleSendOtp}
                disabled={!formData.identifier || otpSent || loading}
                className="flex h-12 w-full items-center justify-center rounded-lg bg-slate-100 text-sm font-medium text-slate-800 ring-1 ring-slate-200 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-55"
              >
                {loading && !otpSent ? <Spinner size="sm" /> : otpSent ? 'کد تایید ارسال شد' : 'ارسال کد تایید پیامکی'}
              </button>

              {otpSent && (
                <label className="flex flex-col gap-1.5">
                  <span className={authLabelClass}>کد تایید پیامک شده</span>
                  <input
                    type="text"
                    dir="ltr"
                    required
                    maxLength={6}
                    placeholder="۶ رقمی"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                    className={`${authFieldClass} px-4 text-center font-mono text-lg tracking-[0.4em]`}
                  />
                </label>
              )}
            </>
          )}

          <button
            type="submit"
            disabled={loading || (loginMethod === 'otp' && (!otpSent || otpCode.length !== 6))}
            className={authPrimaryButtonClass}
          >
            {loading ? <Spinner size="sm" /> : loginMethod === 'otp' ? 'تایید و ورود' : 'ورود به حساب کاربری'}
          </button>
        </form>

        <div className="mt-6 flex flex-col-reverse gap-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <Link to="/register" className="flex items-center justify-center gap-1.5 font-medium text-[var(--color-brand)] hover:text-[var(--color-brand-hover)] sm:justify-start">
            ثبت‌نام حساب جدید
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <Link to="/forgot-password" className="text-center text-slate-500 hover:text-slate-800 sm:text-start">
            بازیابی رمز عبور
          </Link>
        </div>

        <div className="mt-4 text-center text-sm">
          <Link to="/welcome" className="text-slate-500 hover:text-[var(--color-brand)]">
            بازگشت به صفحه معرفی MEKSS
          </Link>
        </div>

        <p className="mt-8 flex items-center justify-center gap-2 text-center text-xs text-slate-500">
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
          سامانه مدیریت هوشمند و ایمن شهرک صنعتی MEKSS
        </p>
      </AuthPanel>
    </AuthSurface>
  );
};

export default LoginPage;
