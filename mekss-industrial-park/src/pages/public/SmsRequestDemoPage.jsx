import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { MessageSquareText, Send } from 'lucide-react';
import { Spinner } from '@heroui/react';
import { PublicShell } from '../../components/public/PublicShell';
import { publicApi } from '../../services/api/public.api';
import { useNotification } from '../../providers/NotificationProvider';
import { getErrorMessage } from '../../utils/apiError';

const codes = [
  { code: '1', title: 'سفارش خدمات', desc: 'درخواست خدمات عمومی شهرک (نظافت، باربری و ...)' },
  { code: '2', title: 'وقت ملاقات', desc: 'رزرو ملاقات با مدیریت یا واحدهای مرتبط' },
  { code: '3', title: 'سایر درخواست‌ها', desc: 'موضوعات عمومی که در کدهای دیگر نیست' },
];

export const SmsRequestDemoPage = () => {
  const { showNotification } = useNotification();
  const [form, setForm] = useState({ phoneNumber: '', code: '1', text: '' });

  const mutation = useMutation({
    mutationFn: (payload) => publicApi.submitSmsRequest(payload),
    onSuccess: () => {
      showNotification('درخواست پیامکی ثبت شد', 'success');
      setForm((prev) => ({ ...prev, text: '' }));
    },
    onError: (error) => showNotification(getErrorMessage(error, 'ثبت درخواست پیامکی ناموفق بود'), 'error'),
  });

  const submit = (e) => {
    e.preventDefault();
    if (!/^09\d{9}$/.test(form.phoneNumber)) {
      showNotification('شماره موبایل باید با ۰۹ و ۱۱ رقم باشد', 'error');
      return;
    }
    mutation.mutate({
      phoneNumber: form.phoneNumber,
      code: form.code,
      text: form.text.trim() || undefined,
    });
  };

  return (
    <PublicShell>
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
        <div className="mb-8 animate-slide-up">
          <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-brand-soft)] text-[var(--color-brand)]">
            <MessageSquareText className="h-6 w-6" />
          </div>
          <p className="mb-2 text-sm font-medium text-[var(--color-brand)]">درخواست بدون ورود</p>
          <h1 className="text-2xl font-bold text-[var(--color-ink)] sm:text-[2rem] sm:leading-[1.4]">
            درخواست پیامکی
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-8 text-[var(--color-muted)]">
            با ارسال کد به سامانه می‌توانید بدون ورود به پنل درخواست ثبت کنید. در این صفحه همین جریان را آزمایش کنید.
          </p>
        </div>

        <div className="mb-6 grid gap-3 sm:grid-cols-3">
          {codes.map((item, index) => {
            const active = form.code === item.code;
            return (
              <button
                key={item.code}
                type="button"
                onClick={() => setForm((prev) => ({ ...prev, code: item.code }))}
                className={`rounded-[var(--radius-md)] p-4 text-start transition animate-slide-up ${
                  active
                    ? 'bg-[var(--color-brand)] text-[var(--color-on-brand)] shadow-[var(--shadow-card)]'
                    : 'bg-[var(--color-surface)] text-[var(--color-ink)] shadow-[var(--shadow-card)] hover:ring-1 hover:ring-[var(--color-brand)]'
                }`}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <span className={`text-2xl font-bold ${active ? 'text-white' : 'text-[var(--color-brand)]'}`}>
                  {item.code}
                </span>
                <p className="mt-2 text-sm font-semibold">{item.title}</p>
                <p className={`mt-1 text-xs leading-5 ${active ? 'text-white/85' : 'text-[var(--color-muted)]'}`}>
                  {item.desc}
                </p>
              </button>
            );
          })}
        </div>

        <form
          onSubmit={submit}
          className="rounded-[var(--radius-lg)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-card)] sm:p-7 animate-slide-up"
          style={{ animationDelay: '120ms' }}
        >
          <label className="mb-4 flex flex-col gap-1.5">
            <span className="text-sm font-medium text-[var(--color-ink)]">شماره موبایل ثبت‌شده در سامانه</span>
            <input
              type="tel"
              dir="ltr"
              required
              value={form.phoneNumber}
              onChange={(e) => setForm((prev) => ({ ...prev, phoneNumber: e.target.value.replace(/\D/g, '').slice(0, 11) }))}
              placeholder="09123456789"
              className="h-12 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface-soft)] px-4 text-sm outline-none transition focus:border-[var(--color-brand)] focus:bg-white focus:ring-2 focus:ring-[var(--color-brand-soft)]"
            />
          </label>

          <label className="mb-4 flex flex-col gap-1.5">
            <span className="text-sm font-medium text-[var(--color-ink)]">توضیح اختیاری</span>
            <textarea
              rows={4}
              value={form.text}
              onChange={(e) => setForm((prev) => ({ ...prev, text: e.target.value }))}
              placeholder="جزئیات کوتاه درخواست..."
              className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface-soft)] px-4 py-3 text-sm outline-none transition focus:border-[var(--color-brand)] focus:bg-white focus:ring-2 focus:ring-[var(--color-brand-soft)]"
            />
          </label>

          <button
            type="submit"
            disabled={mutation.isPending}
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-[var(--radius-sm)] bg-[var(--color-brand)] text-sm font-bold text-[var(--color-on-brand)] transition hover:bg-[var(--color-brand-hover)] disabled:opacity-60 sm:w-auto sm:px-8"
          >
            {mutation.isPending ? <Spinner size="sm" /> : <Send className="h-4 w-4" />}
            ثبت درخواست با کد {form.code}
          </button>
        </form>
      </div>
    </PublicShell>
  );
};

export default SmsRequestDemoPage;
