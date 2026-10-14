import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Button,
  Card,
  CardContent,
  Input,
  Label,
  Separator,
  Spinner,
} from '@heroui/react';
import { MessageSquareText } from 'lucide-react';
import { smsApi } from '../../services/api/sms.api';
import { PasswordInput } from '../common/PasswordInput';
import { useNotification } from '../../providers/NotificationProvider';
import { getErrorMessage } from '../../utils/apiError';
import { toAsciiDigits } from '../../utils/digits';
import { buildSmsSettingsPayload, isMobileNumber } from '../../utils/smsSettings';

const PROVIDERS = [
  { id: 'melipayamak', label: 'ملی پیامک' },
  { id: 'kavenegar', label: 'کاوه‌نگار' },
  { id: 'mock', label: 'آزمایشی (بدون ارسال)' },
];

const SOURCE_LABEL = { database: 'پنل مدیریت', env: 'فایل .env' };

const Field = ({ label, hint, children }) => (
  <div className="flex flex-col gap-1">
    <Label className="text-xs font-medium text-foreground-600">{label}</Label>
    {children}
    {hint ? <p className="text-xs text-foreground-500">{hint}</p> : null}
  </div>
);

const SmsSettingsForm = ({ settings }) => {
  const { showNotification } = useNotification();
  const queryClient = useQueryClient();
  const m = settings.melipayamak || {};
  const [form, setForm] = useState({
    provider: settings.provider || 'melipayamak',
    username: m.username || '',
    password: '',
    sender: m.sender || '',
    otpBodyId: m.otpBodyId || '',
  });
  const [testPhone, setTestPhone] = useState('');
  const [testResult, setTestResult] = useState(null);
  const [credit, setCredit] = useState(null);
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const onSaved = (res) => {
    queryClient.setQueryData(['settings', 'sms'], res.data);
    setForm((f) => ({ ...f, password: '' }));
  };
  const save = useMutation({
    mutationFn: () => smsApi.updateSettings(buildSmsSettingsPayload(form)),
    onSuccess: (res) => {
      onSaved(res);
      showNotification('تنظیمات سامانه پیامک ذخیره شد', 'success');
    },
    onError: (err) => showNotification(getErrorMessage(err, 'ذخیره تنظیمات پیامک ناموفق بود'), 'error'),
  });
  const clearKey = useMutation({
    mutationFn: () => smsApi.updateSettings({ provider: form.provider, clearMelipayamakPassword: true }),
    onSuccess: (res) => {
      onSaved(res);
      showNotification('کلید API ذخیره‌شده حذف شد', 'success');
    },
    onError: (err) => showNotification(getErrorMessage(err, 'حذف کلید ناموفق بود'), 'error'),
  });
  const test = useMutation({
    mutationFn: (kind) => smsApi.sendTest(toAsciiDigits(testPhone).trim(), kind).then((res) => res.data),
    onSuccess: (result) => setTestResult(result),
    onError: (err) => setTestResult({ ok: false, message: getErrorMessage(err, 'ارسال آزمایشی ناموفق بود') }),
  });
  const creditQuery = useMutation({
    mutationFn: () => smsApi.getCredit().then((res) => res.data),
    onSuccess: setCredit,
    onError: (err) => setCredit({ ok: false, message: getErrorMessage(err, 'استعلام اعتبار ناموفق بود') }),
  });

  const isMeli = form.provider === 'melipayamak';
  const busy = save.isPending || clearKey.isPending;
  const dirty = form.provider !== settings.provider
    || form.username !== (m.username || '')
    || form.sender !== (m.sender || '')
    || form.otpBodyId !== (m.otpBodyId || '')
    || Boolean(form.password.trim());

  return (
    <form
      className="mt-4 flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      <div role="radiogroup" aria-label="سرویس‌دهنده پیامک" className="flex flex-wrap gap-2">
        {PROVIDERS.map((p) => (
          <button
            key={p.id}
            type="button"
            role="radio"
            aria-checked={form.provider === p.id}
            onClick={() => setForm((f) => ({ ...f, provider: p.id }))}
            className={`rounded-xl border px-3 py-1.5 text-sm font-semibold transition ${
              form.provider === p.id
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-default-300 text-foreground-600 hover:border-primary'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {form.provider === 'mock' && (
        <p className="text-xs text-warning-700">در حالت آزمایشی هیچ پیامکی ارسال نمی‌شود و کدهای ورود فقط در لاگ سرور ثبت می‌شوند.</p>
      )}
      {form.provider === 'kavenegar' && (
        <p className="text-xs text-foreground-500">
          کاوه‌نگار از متغیرهای KAVEH_NEGAR_API_KEY و SMS_SENDER در فایل .env خوانده می‌شود
          {settings.kavenegar?.configured ? ' (تنظیم شده است).' : ' (هنوز تنظیم نشده است).'}
        </p>
      )}

      {isMeli && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="نام کاربری پنل ملی پیامک">
            <Input value={form.username} onChange={set('username')} dir="ltr" autoComplete="off" className="rounded-xl" />
          </Field>
          <Field
            label="کلید API (یا رمز پنل)"
            hint={m.hasPassword
              ? `کلید ثبت شده است (منبع: ${SOURCE_LABEL[m.passwordSource] || '—'}). برای تغییر، کلید جدید را وارد کنید.`
              : 'کلید API را از کنسول ملی پیامک دریافت کنید. پس از ذخیره، رمزنگاری‌شده نگهداری می‌شود و دیگر نمایش داده نمی‌شود.'}
          >
            <PasswordInput
              value={form.password}
              onChange={set('password')}
              autoComplete="new-password"
              placeholder={m.hasPassword ? '•••••••• (ذخیره شده)' : ''}
              className="rounded-xl"
            />
          </Field>
          <Field label="شماره خط فرستنده" hint="برای پیامک‌های متنی (اطلاع‌رسانی، رمز موقت و ...)">
            <Input value={form.sender} onChange={set('sender')} dir="ltr" inputMode="numeric" className="rounded-xl" />
          </Field>
          <Field
            label="کد پترن کد تایید (bodyId)"
            hint="پترن تأییدشده در خط خدماتی با یک متغیر برای کد؛ به شماره‌های لیست سیاه مخابرات هم می‌رسد. خالی = ارسال متنی از خط فرستنده"
          >
            <Input value={form.otpBodyId} onChange={set('otpBodyId')} dir="ltr" inputMode="numeric" className="rounded-xl" />
          </Field>
        </div>
      )}

      {m.passwordUnreadable && isMeli && (
        <Alert status="warning">
          <AlertContent>
            <AlertTitle>کلید ذخیره‌شده قابل خواندن نیست</AlertTitle>
            <AlertDescription>کلید رمزنگاری سرور تغییر کرده است؛ کلید API را دوباره وارد و ذخیره کنید.</AlertDescription>
          </AlertContent>
        </Alert>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="primary" className="font-bold" isDisabled={busy || !dirty}>
          {save.isPending ? <Spinner size="sm" /> : 'ذخیره تنظیمات'}
        </Button>
        {isMeli && m.hasPassword && m.passwordSource === 'database' && (
          <Button type="button" variant="tertiary" isDisabled={busy} onPress={() => clearKey.mutate()}>
            حذف کلید ذخیره‌شده
          </Button>
        )}
      </div>

      <Separator />

      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-bold text-foreground">آزمایش ارسال</h3>
        <p className="text-xs text-foreground-500">ابتدا تنظیمات را ذخیره کنید؛ آزمایش با تنظیمات ذخیره‌شده انجام می‌شود.</p>
        <div className="flex flex-wrap items-end gap-2">
          <div className="w-full sm:w-56">
            <Field label="شماره موبایل گیرنده">
              <Input value={testPhone} onChange={(e) => setTestPhone(e.target.value)} dir="ltr" inputMode="tel" placeholder="09xxxxxxxxx" className="rounded-xl" />
            </Field>
          </div>
          <Button type="button" variant="secondary" isDisabled={test.isPending || dirty || !isMobileNumber(testPhone)} onPress={() => test.mutate('text')}>
            پیام آزمایشی
          </Button>
          <Button type="button" variant="secondary" isDisabled={test.isPending || dirty || !isMobileNumber(testPhone)} onPress={() => test.mutate('otp')}>
            کد تایید آزمایشی
          </Button>
          {isMeli && settings.provider === 'melipayamak' && (
            <Button type="button" variant="ghost" isDisabled={creditQuery.isPending} onPress={() => creditQuery.mutate()}>
              استعلام اعتبار
            </Button>
          )}
        </div>
        {test.isPending && <Spinner size="sm" />}
        {testResult && (
          <p className={`text-sm font-semibold ${testResult.ok ? 'text-success-700' : 'text-danger-600'}`} data-testid="sms-test-result">
            {testResult.ok ? 'ارسال موفق' : 'ارسال ناموفق'}: {testResult.message}
            {testResult.recId ? ` (شناسه ارسال ${testResult.recId})` : ''}
          </p>
        )}
        {credit && (
          <p className={`text-sm ${credit.ok ? 'text-foreground-700' : 'text-danger-600'}`} data-testid="sms-credit">
            {credit.ok ? `اعتبار پنل: ${Number(credit.credit).toLocaleString('fa-IR')}` : credit.message}
          </p>
        )}
      </div>
    </form>
  );
};

/** Super-admin card: SMS provider (Melipayamak by default) and its credentials. */
export const SmsSettingsCard = () => {
  const { data, isLoading, isError, error, dataUpdatedAt } = useQuery({
    queryKey: ['settings', 'sms'],
    queryFn: () => smsApi.getSettings().then((res) => res.data),
  });

  return (
    <Card className="border border-default-200 shadow-sm rounded-2xl dark:border-white/10 animate-slide-up">
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300">
            <MessageSquareText className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-bold text-foreground">سامانه پیامک</h2>
            <p className="mt-1 text-sm text-foreground-500">
              ارسال کد ورود، رمز موقت و اطلاع‌رسانی‌ها. فیلدهای خالی از فایل .env سرور خوانده می‌شوند.
            </p>
            {data && (
              <p className={`mt-1 text-sm font-semibold ${data.configured ? 'text-success-700' : 'text-warning-700'}`} data-testid="sms-setting-state">
                وضعیت: {data.configured ? 'آماده ارسال' : 'تنظیمات کامل نیست'}
              </p>
            )}
          </div>
        </div>
        {isLoading && <Spinner size="sm" className="mt-4" />}
        {isError && (
          <Alert status="danger" className="mt-4">
            <AlertContent>
              <AlertTitle>خطا</AlertTitle>
              <AlertDescription>{getErrorMessage(error, 'دریافت تنظیمات پیامک ناموفق بود.')}</AlertDescription>
            </AlertContent>
          </Alert>
        )}
        {data && <SmsSettingsForm key={dataUpdatedAt} settings={data} />}
      </CardContent>
    </Card>
  );
};

export default SmsSettingsCard;
