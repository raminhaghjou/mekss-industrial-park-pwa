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
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="mb-8">
          <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0f4c81]/10 text-[#0f4c81]">
            <MessageSquareText className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">درخواست پیامکی (نسخه نمایشی)</h1>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-600">
            با ارسال کد به سامانه، می‌توانید بدون ورود به پنل، درخواست ثبت کنید. در این صفحه می‌توانید همین جریان را آزمایش کنید.
          </p>
        </div>

        <div className="mb-6 grid gap-3 sm:grid-cols-3">
          {codes.map((item) => (
            <button
              key={item.code}
              type="button"
              onClick={() => setForm((prev) => ({ ...prev, code: item.code }))}
              className={`rounded-2xl p-4 text-start transition ring-1 ${
                form.code === item.code
                  ? 'bg-[#0f4c81] text-white ring-[#0f4c81]'
                  : 'bg-white text-slate-800 ring-slate-200 hover:ring-[#0f4c81]/40'
              }`}
            >
              <span className={`text-2xl font-bold ${form.code === item.code ? 'text-white' : 'text-[#0f4c81]'}`}>
                {item.code}
              </span>
              <p className="mt-2 text-sm font-semibold">{item.title}</p>
              <p className={`mt-1 text-xs leading-5 ${form.code === item.code ? 'text-white/80' : 'text-slate-500'}`}>
                {item.desc}
              </p>
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200/80 sm:p-7">
          <label className="mb-4 flex flex-col gap-1.5">
            <span className="text-sm font-medium text-slate-700">شماره موبایل ثبت‌شده در سامانه</span>
            <input
              type="tel"
              dir="ltr"
              required
              value={form.phoneNumber}
              onChange={(e) => setForm((prev) => ({ ...prev, phoneNumber: e.target.value.replace(/\D/g, '').slice(0, 11) }))}
              placeholder="09123456789"
              className="h-12 rounded-xl bg-slate-50 px-4 text-sm outline-none ring-1 ring-slate-200 focus:bg-white focus:ring-2 focus:ring-[#0f4c81]"
            />
          </label>

          <label className="mb-4 flex flex-col gap-1.5">
            <span className="text-sm font-medium text-slate-700">توضیح اختیاری</span>
            <textarea
              rows={4}
              value={form.text}
              onChange={(e) => setForm((prev) => ({ ...prev, text: e.target.value }))}
              placeholder="جزئیات کوتاه درخواست..."
              className="rounded-xl bg-slate-50 px-4 py-3 text-sm outline-none ring-1 ring-slate-200 focus:bg-white focus:ring-2 focus:ring-[#0f4c81]"
            />
          </label>

          <button
            type="submit"
            disabled={mutation.isPending}
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#0f4c81] text-sm font-bold text-white transition hover:bg-[#0c3d68] disabled:opacity-60 sm:w-auto sm:px-8"
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
