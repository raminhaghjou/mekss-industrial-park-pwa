import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Spinner } from '@heroui/react';
import { Eye, EyeOff, Phone, Lock, User, ArrowLeft, Building2, AtSign, MapPin } from 'lucide-react';
import { useAuth } from '../../providers/AuthProvider';
import { useNotification } from '../../providers/NotificationProvider';
import { publicApi } from '../../services/api/public.api';
import { authApi } from '../../services/api/auth.api';
import { getErrorMessage } from '../../utils/apiError';
import {
  AuthBrand,
  AuthPanel,
  AuthSurface,
  authFieldClass,
  authLabelClass,
  authPrimaryButtonClass,
} from './AuthSurface';

const emptyForm = {
  name: '',
  phoneNumber: '',
  phoneNumber2: '',
  password: '',
  confirmPassword: '',
  username: '',
  email: '',
  role: 'FACTORY_OWNER',
  parkId: '',
  factoryId: '',
  factoryName: '',
  nationalId: '',
  activityType: '',
  address: '',
  factoryPhone: '',
  landline: '',
  fax: '',
  description: '',
  ceoName: '',
  logo: '',
  latitude: '',
  longitude: '',
  socialInstagram: '',
  socialTelegram: '',
  socialWebsite: '',
  licenseNumber: '',
};

export const RegisterPage = () => {
  const navigate = useNavigate();
  const { register } = useAuth();
  const { showNotification } = useNotification();

  const [step, setStep] = useState('phone');
  const [formData, setFormData] = useState(emptyForm);
  const [parks, setParks] = useState([]);
  const [factories, setFactories] = useState([]);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    publicApi.getParks().then((res) => setParks(res.data || [])).catch(() => setParks([]));
    publicApi.getFactories?.().then((res) => setFactories(res.data || [])).catch(() => setFactories([]));
  }, []);

  const update = (key, value) => setFormData((prev) => ({ ...prev, [key]: value }));

  const checkPhone = async (e) => {
    e.preventDefault();
    const phone = formData.phoneNumber.replace(/\D/g, '').slice(0, 11);
    if (!/^09\d{9}$/.test(phone)) {
      const msg = 'شماره موبایل باید ۱۱ رقم و با ۰۹ شروع شود';
      setFormError(msg);
      showNotification(msg, 'error');
      return;
    }
    setLoading(true);
    setFormError('');
    try {
      const { data } = await authApi.checkPhone(phone);
      if (data.exists) {
        showNotification('این شماره قبلاً ثبت‌نام شده است؛ وارد شوید', 'info');
        navigate('/login', { state: { phoneNumber: phone } });
        return;
      }
      update('phoneNumber', phone);
      update('factoryPhone', phone);
      setStep('form');
    } catch (error) {
      const msg = getErrorMessage(error, 'بررسی شماره موبایل ناموفق بود');
      setFormError(msg);
      showNotification(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!formData.name || !formData.phoneNumber || !formData.password) {
      const msg = 'لطفاً تمام فیلدهای الزامی را پر کنید';
      setFormError(msg);
      showNotification(msg, 'error');
      return;
    }
    if (formData.password.length < 8 || !/[A-Za-zآ-ی]/.test(formData.password) || !/\d/.test(formData.password)) {
      const msg = 'رمز عبور حداقل ۸ کاراکتر و شامل حرف و عدد باشد';
      setFormError(msg);
      showNotification(msg, 'error');
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      const msg = 'رمز عبور و تکرار آن یکسان نیستند';
      setFormError(msg);
      showNotification(msg, 'error');
      return;
    }
    if (formData.role === 'FACTORY_OWNER') {
      if (!formData.parkId || !formData.factoryName || !formData.nationalId || !formData.activityType || !formData.address) {
        const msg = 'اطلاعات واحد صنعتی را کامل کنید';
        setFormError(msg);
        showNotification(msg, 'error');
        return;
      }
    }
    if (formData.role === 'EMPLOYEE' && !formData.factoryId) {
      const msg = 'واحد صنعتی را انتخاب کنید';
      setFormError(msg);
      showNotification(msg, 'error');
      return;
    }

    const socialMedia = {};
    if (formData.socialInstagram.trim()) socialMedia.instagram = formData.socialInstagram.trim();
    if (formData.socialTelegram.trim()) socialMedia.telegram = formData.socialTelegram.trim();
    if (formData.socialWebsite.trim()) socialMedia.website = formData.socialWebsite.trim();

    setLoading(true);
    const payload = {
      name: formData.name.trim(),
      phoneNumber: formData.phoneNumber.trim(),
      password: formData.password,
      role: formData.role,
      ...(formData.username.trim() ? { username: formData.username.trim().toLowerCase() } : {}),
      ...(formData.email.trim() ? { email: formData.email.trim() } : {}),
      ...(formData.role === 'FACTORY_OWNER'
        ? {
            parkId: formData.parkId,
            factoryName: formData.factoryName.trim(),
            nationalId: formData.nationalId.trim(),
            activityType: formData.activityType.trim(),
            address: formData.address.trim(),
            factoryPhone: (formData.factoryPhone || formData.phoneNumber).trim(),
            phoneNumber2: formData.phoneNumber2.trim() || undefined,
            landline: formData.landline.trim() || undefined,
            fax: formData.fax.trim() || undefined,
            description: formData.description.trim() || undefined,
            ceoName: formData.ceoName.trim() || undefined,
            logo: formData.logo.trim() || undefined,
            licenseNumber: formData.licenseNumber.trim() || undefined,
            latitude: formData.latitude !== '' ? Number(formData.latitude) : undefined,
            longitude: formData.longitude !== '' ? Number(formData.longitude) : undefined,
            ...(Object.keys(socialMedia).length ? { socialMedia } : {}),
          }
        : { factoryId: formData.factoryId }),
    };
    const result = await register(payload);
    setLoading(false);

    if (result.success) {
      showNotification(result.message || 'ثبت‌نام ارسال شد و پس از تایید مدیر فعال می‌شود', 'success');
      navigate('/login');
    } else {
      setFormError(result.error || 'ثبت‌نام ناموفق بود');
      showNotification(result.error || 'ثبت‌نام ناموفق بود', 'error');
    }
  };

  const filteredFactories = formData.parkId
    ? factories.filter((f) => f.parkId === formData.parkId || f.park?.id === formData.parkId)
    : factories;

  return (
    <AuthSurface>
      <AuthPanel className="max-w-lg">
        <AuthBrand
          title="ایجاد حساب کاربری جدید"
          subtitle={
            step === 'phone'
              ? 'ابتدا شماره همراه خود را وارد کنید'
              : 'درخواست شما برای مدیر همان شهرک/واحد ارسال می‌شود'
          }
        />

        {step === 'phone' ? (
          <form onSubmit={checkPhone} className="flex flex-col gap-4">
            {formError ? (
              <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-800">
                {formError}
              </div>
            ) : null}
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
                  onChange={(e) => update('phoneNumber', e.target.value.replace(/\D/g, '').slice(0, 11))}
                  className={`${authFieldClass} text-left`}
                />
              </span>
            </label>
            <button type="submit" disabled={loading} className={authPrimaryButtonClass}>
              {loading ? <Spinner size="sm" /> : 'ادامه'}
            </button>
            <div className="flex justify-center">
              <Link to="/login" className="flex items-center gap-1.5 text-sm font-medium text-[var(--color-brand)]">
                بازگشت به ورود
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </div>
          </form>
        ) : (
          <form onSubmit={handleSubmit} className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto pe-1">
            {formError ? (
              <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-800">
                {formError}
              </div>
            ) : null}

            <label className="flex flex-col gap-1.5">
              <span className={authLabelClass}>نوع حساب</span>
              <select
                value={formData.role}
                onChange={(e) => update('role', e.target.value)}
                className={authFieldClass}
              >
                <option value="FACTORY_OWNER">مدیر واحد صنعتی</option>
                <option value="EMPLOYEE">کارمند واحد صنعتی</option>
              </select>
            </label>

            <label className="flex flex-col gap-1.5">
              <span className={authLabelClass}>نام و نام خانوادگی</span>
              <span className="relative block">
                <User className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => update('name', e.target.value)}
                  className={authFieldClass}
                />
              </span>
            </label>

            <label className="flex flex-col gap-1.5">
              <span className={authLabelClass}>نام کاربری</span>
              <span className="relative block">
                <AtSign className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  dir="ltr"
                  value={formData.username}
                  onChange={(e) => update('username', e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ''))}
                  className={authFieldClass}
                  placeholder="username"
                />
              </span>
            </label>

            <p className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600" dir="ltr">
              همراه: {formData.phoneNumber}
              <button type="button" className="ms-2 text-[var(--color-brand)]" onClick={() => setStep('phone')}>
                تغییر
              </button>
            </p>

            <label className="flex flex-col gap-1.5">
              <span className={authLabelClass}>رمز عبور</span>
              <span className="relative block">
                <Lock className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={formData.password}
                  onChange={(e) => update('password', e.target.value)}
                  className={authFieldClass}
                  dir="ltr"
                />
                <button
                  type="button"
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  onClick={() => setShowPassword((v) => !v)}
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
                onChange={(e) => update('confirmPassword', e.target.value)}
                className={authFieldClass}
                dir="ltr"
              />
            </label>

            {formData.role === 'FACTORY_OWNER' ? (
              <>
                <label className="flex flex-col gap-1.5">
                  <span className={authLabelClass}>شهرک صنعتی</span>
                  <span className="relative block">
                    <Building2 className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <select
                      required
                      value={formData.parkId}
                      onChange={(e) => update('parkId', e.target.value)}
                      className={authFieldClass}
                    >
                      <option value="">انتخاب شهرک</option>
                      {parks.map((park) => (
                        <option key={park.id} value={park.id}>{park.name}</option>
                      ))}
                    </select>
                  </span>
                </label>

                <label className="flex flex-col gap-1.5">
                  <span className={authLabelClass}>نام واحد صنعتی</span>
                  <input required value={formData.factoryName} onChange={(e) => update('factoryName', e.target.value)} className={authFieldClass} />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className={authLabelClass}>نام مدیرعامل</span>
                  <input value={formData.ceoName} onChange={(e) => update('ceoName', e.target.value)} className={authFieldClass} />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className={authLabelClass}>نوع فعالیت</span>
                  <input required value={formData.activityType} onChange={(e) => update('activityType', e.target.value)} className={authFieldClass} />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className={authLabelClass}>شناسه ملی</span>
                  <input required dir="ltr" value={formData.nationalId} onChange={(e) => update('nationalId', e.target.value.replace(/\D/g, '').slice(0, 11))} className={authFieldClass} />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className={authLabelClass}>شماره همراه ۲</span>
                  <input dir="ltr" value={formData.phoneNumber2} onChange={(e) => update('phoneNumber2', e.target.value.replace(/\D/g, '').slice(0, 11))} className={authFieldClass} />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className={authLabelClass}>تلفن ثابت</span>
                  <input dir="ltr" value={formData.landline} onChange={(e) => update('landline', e.target.value)} className={authFieldClass} />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className={authLabelClass}>فکس</span>
                  <input dir="ltr" value={formData.fax} onChange={(e) => update('fax', e.target.value)} className={authFieldClass} />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className={authLabelClass}>ایمیل</span>
                  <input type="email" dir="ltr" value={formData.email} onChange={(e) => update('email', e.target.value)} className={authFieldClass} />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className={authLabelClass}>آدرس</span>
                  <textarea required rows={2} value={formData.address} onChange={(e) => update('address', e.target.value)} className={authFieldClass} />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className={authLabelClass}>توضیحات واحد</span>
                  <textarea rows={2} value={formData.description} onChange={(e) => update('description', e.target.value)} className={authFieldClass} />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex flex-col gap-1.5">
                    <span className={authLabelClass}>عرض جغرافیایی</span>
                    <span className="relative block">
                      <MapPin className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input dir="ltr" value={formData.latitude} onChange={(e) => update('latitude', e.target.value)} className={authFieldClass} />
                    </span>
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className={authLabelClass}>طول جغرافیایی</span>
                    <input dir="ltr" value={formData.longitude} onChange={(e) => update('longitude', e.target.value)} className={authFieldClass} />
                  </label>
                </div>
                <label className="flex flex-col gap-1.5">
                  <span className={authLabelClass}>اینستاگرام</span>
                  <input dir="ltr" value={formData.socialInstagram} onChange={(e) => update('socialInstagram', e.target.value)} className={authFieldClass} />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className={authLabelClass}>تلگرام</span>
                  <input dir="ltr" value={formData.socialTelegram} onChange={(e) => update('socialTelegram', e.target.value)} className={authFieldClass} />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className={authLabelClass}>وب‌سایت</span>
                  <input dir="ltr" value={formData.socialWebsite} onChange={(e) => update('socialWebsite', e.target.value)} className={authFieldClass} />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className={authLabelClass}>شناسه فایل آرم (اختیاری)</span>
                  <input dir="ltr" value={formData.logo} onChange={(e) => update('logo', e.target.value)} className={authFieldClass} />
                </label>
              </>
            ) : (
              <>
                <label className="flex flex-col gap-1.5">
                  <span className={authLabelClass}>شهرک (فیلتر)</span>
                  <select value={formData.parkId} onChange={(e) => update('parkId', e.target.value)} className={authFieldClass}>
                    <option value="">همه شهرک‌ها</option>
                    {parks.map((park) => (
                      <option key={park.id} value={park.id}>{park.name}</option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className={authLabelClass}>واحد صنعتی</span>
                  <select required value={formData.factoryId} onChange={(e) => update('factoryId', e.target.value)} className={authFieldClass}>
                    <option value="">انتخاب واحد</option>
                    {filteredFactories.map((factory) => (
                      <option key={factory.id} value={factory.id}>{factory.name}</option>
                    ))}
                  </select>
                </label>
              </>
            )}

            <button type="submit" disabled={loading} className={authPrimaryButtonClass}>
              {loading ? <Spinner size="sm" /> : 'ارسال درخواست ثبت‌نام'}
            </button>
            <div className="flex justify-center">
              <Link to="/login" className="flex items-center gap-1.5 text-sm font-medium text-[var(--color-brand)]">
                بازگشت به ورود
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </div>
          </form>
        )}
      </AuthPanel>
    </AuthSurface>
  );
};

export default RegisterPage;
