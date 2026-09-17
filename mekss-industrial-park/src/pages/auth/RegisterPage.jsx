import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Spinner } from '@heroui/react';
import { Eye, EyeOff, Phone, Lock, User, ArrowLeft, Building2 } from 'lucide-react';
import { useAuth } from '../../providers/AuthProvider';
import { useNotification } from '../../providers/NotificationProvider';
import { publicApi } from '../../services/api/public.api';
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
    parkId: '',
    factoryId: '',
  });
  const [parks, setParks] = useState([]);
  const [factories, setFactories] = useState([]);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    publicApi.getParks().then((res) => setParks(res.data || [])).catch(() => setParks([]));
    publicApi.getFactories?.().then((res) => setFactories(res.data || [])).catch(() => setFactories([]));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name || !formData.phoneNumber || !formData.password) {
      showNotification('لطفاً تمام فیلدها را پر کنید', 'error');
      return;
    }
    if (formData.password.length < 8 || !/[A-Za-zآ-ی]/.test(formData.password) || !/\d/.test(formData.password)) {
      showNotification('رمز عبور حداقل ۸ کاراکتر و شامل حرف و عدد باشد', 'error');
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      showNotification('رمز عبور و تکرار آن یکسان نیستند', 'error');
      return;
    }
    if (formData.role === 'FACTORY_OWNER' && !formData.parkId) {
      showNotification('شهرک صنعتی را انتخاب کنید', 'error');
      return;
    }
    if (formData.role === 'EMPLOYEE' && !formData.factoryId) {
      showNotification('واحد صنعتی را انتخاب کنید', 'error');
      return;
    }

    setLoading(true);
    const payload = {
      name: formData.name.trim(),
      phoneNumber: formData.phoneNumber.trim(),
      password: formData.password,
      role: formData.role,
      ...(formData.role === 'FACTORY_OWNER' ? { parkId: formData.parkId } : { factoryId: formData.factoryId }),
    };
    const result = await register(payload);
    setLoading(false);

    if (result.success) {
      showNotification(result.message || 'ثبت‌نام ارسال شد و پس از تایید مدیر فعال می‌شود', 'success');
      navigate('/login');
    } else {
      showNotification(result.error || 'ثبت‌نام ناموفق بود', 'error');
    }
  };

  const filteredFactories = formData.parkId
    ? factories.filter((f) => f.parkId === formData.parkId || f.park?.id === formData.parkId)
    : factories;

  return (
    <AuthSurface>
      <AuthPanel>
        <AuthBrand
          title="ایجاد حساب کاربری جدید"
          subtitle="درخواست شما برای مدیر همان شهرک/واحد ارسال می‌شود"
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
                placeholder="09123456789"
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
              onChange={(e) => setFormData({ ...formData, role: e.target.value, factoryId: '', parkId: formData.parkId })}
              className="h-12 w-full rounded-lg bg-slate-50 px-3 text-sm text-slate-900 outline-none ring-1 ring-slate-300 focus:bg-white focus:ring-2 focus:ring-[var(--color-brand)]"
            >
              <option value="FACTORY_OWNER">مالک واحد صنعتی / کارخانه</option>
              <option value="EMPLOYEE">کارمند / پرسنل واحد</option>
            </select>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className={authLabelClass}>شهرک صنعتی</span>
            <span className="relative block">
              <Building2 className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <select
                required={formData.role === 'FACTORY_OWNER'}
                value={formData.parkId}
                onChange={(e) => setFormData({ ...formData, parkId: e.target.value, factoryId: '' })}
                className={`${authFieldClass} pe-10`}
              >
                <option value="">انتخاب شهرک</option>
                {parks.map((park) => (
                  <option key={park.id} value={park.id}>
                    {park.name} — {park.city}
                  </option>
                ))}
              </select>
            </span>
          </label>

          {formData.role === 'EMPLOYEE' && (
            <label className="flex flex-col gap-1.5">
              <span className={authLabelClass}>واحد صنعتی</span>
              <select
                required
                value={formData.factoryId}
                onChange={(e) => setFormData({ ...formData, factoryId: e.target.value })}
                className="h-12 w-full rounded-lg bg-slate-50 px-3 text-sm text-slate-900 outline-none ring-1 ring-slate-300 focus:bg-white focus:ring-2 focus:ring-[var(--color-brand)]"
              >
                <option value="">انتخاب واحد</option>
                {filteredFactories.map((factory) => (
                  <option key={factory.id} value={factory.id}>{factory.name}</option>
                ))}
              </select>
            </label>
          )}

          <label className="flex flex-col gap-1.5">
            <span className={authLabelClass}>رمز عبور</span>
            <span className="relative block">
              <Lock className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="حداقل ۸ کاراکتر، حرف و عدد"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className={`${authFieldClass} pl-11`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </span>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className={authLabelClass}>تکرار رمز عبور</span>
            <input
              type="password"
              required
              value={formData.confirmPassword}
              onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
              className={authFieldClass}
            />
          </label>

          <button type="submit" disabled={loading} className={authPrimaryButtonClass}>
            {loading ? <Spinner size="sm" /> : 'ثبت درخواست عضویت'}
          </button>

          <Link to="/login" className="inline-flex items-center justify-center gap-1 text-sm text-[var(--color-brand)]">
            <ArrowLeft className="h-4 w-4" />
            بازگشت به ورود
          </Link>
        </form>
      </AuthPanel>
    </AuthSurface>
  );
};

export default RegisterPage;
