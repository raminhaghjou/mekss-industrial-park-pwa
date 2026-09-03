import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Spinner } from '@heroui/react';
import { Eye, EyeOff, Phone, Lock, User, ArrowLeft, ShieldCheck } from 'lucide-react';
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

export const RegisterPage = () => {
  const navigate = useNavigate();
  const { register } = useAuth();
  const { showNotification } = useNotification();

  const [formData, setFormData] = useState({
    name: '',
    phoneNumber: '',
    password: '',
    confirmPassword: '',
    role: 'FACTORY_OWNER',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name || !formData.phoneNumber || !formData.password) {
      showNotification('لطفاً تمام فیلدها را پر کنید', 'error');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      showNotification('رمز عبور و تکرار آن یکسان نیستند', 'error');
      return;
    }

    setLoading(true);
    const result = await register(formData);
    setLoading(false);

    if (result.success) {
      showNotification('ثبت‌نام با موفقیت انجام شد', 'success');
      navigate('/login');
    } else {
      showNotification(result.error || 'ثبت‌نام ناموفق بود', 'error');
    }
  };

  return (
    <AuthSurface>
      <AuthPanel>
        <AuthBrand
          title="ایجاد حساب کاربری جدید"
          subtitle="اطلاعات کاربری خود را برای ثبت درخواست وارد کنید"
        />

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className={authLabelClass}>نام و نام خانوادگی</span>
            <span className="relative block">
              <User className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                required
                placeholder="نام کامل خود را وارد کنید"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className={authFieldClass}
              />
            </span>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className={authLabelClass}>شماره تلفن همراه</span>
            <span className="relative block">
              <Phone className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="tel"
                dir="ltr"
                required
                placeholder="۰۹۱۲۳۴۵۶۷۸۹"
                value={formData.phoneNumber}
                onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                className={`${authFieldClass} text-left`}
              />
            </span>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className={authLabelClass}>نقش کاربری</span>
            <select
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              className="h-12 w-full rounded-lg bg-slate-50 px-3 text-sm text-slate-900 outline-none ring-1 ring-slate-300 focus:bg-white focus:ring-2 focus:ring-[#0f4c81]"
            >
              <option value="FACTORY_OWNER">مالک واحد صنعتی / کارخانه</option>
              <option value="EMPLOYEE">کارمند / پرسنل واحد</option>
            </select>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className={authLabelClass}>رمز عبور</span>
            <span className="relative block">
              <Lock className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="حداقل ۶ کاراکتر"
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

          <label className="flex flex-col gap-1.5">
            <span className={authLabelClass}>تکرار رمز عبور</span>
            <span className="relative block">
              <Lock className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="رمز عبور را مجدداً وارد کنید"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                className={authFieldClass}
              />
            </span>
          </label>

          <button type="submit" disabled={loading} className={authPrimaryButtonClass}>
            {loading ? <Spinner size="sm" /> : 'تکمیل ثبت‌نام و ایجاد حساب'}
          </button>
        </form>

        <div className="mt-6 flex flex-col items-center gap-3 text-sm">
          <Link to="/login" className="flex items-center gap-1.5 font-medium text-[#0f4c81] hover:text-[#0c3d68]">
            قبلاً ثبت‌نام کرده‌اید؟ ورود به حساب
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <Link to="/welcome" className="text-slate-500 hover:text-[#0f4c81]">
            بازگشت به صفحه معرفی MEKSS
          </Link>
        </div>

        <p className="mt-8 flex items-center justify-center gap-2 text-center text-xs text-slate-500">
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
          حفاظت از اطلاعات با پروتکل‌های امنیتی MEKSS
        </p>
      </AuthPanel>
    </AuthSurface>
  );
};

export default RegisterPage;
