import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  Chip,
  Alert,
  AlertIndicator,
  AlertContent,
  AlertTitle,
  AlertDescription,
  Spinner,
} from '@heroui/react';
import { MessageSquare, ShieldCheck } from 'lucide-react';
import { smsApi } from '../../services/api/sms.api';
import { getErrorMessage } from '../../utils/apiError';

const providerLabels = { mock: 'شبیه‌سازی (محیط توسعه)', kavenegar: 'کاوه‌نگار' };

const SmsConfigPage = () => {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['sms', 'health'],
    queryFn: () => smsApi.getHealth().then((res) => res.data),
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-2xl bg-primary-50 dark:bg-primary-950/40 text-primary">
          <MessageSquare className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">وضعیت سرویس پیامک</h1>
          <p className="text-sm text-foreground-500 mt-0.5">بررسی وضعیت ارتباط با پنل ارسال پیامک انبوه سامانه</p>
        </div>
      </div>

      <Alert status="accent">
        <AlertIndicator><ShieldCheck className="h-5 w-5" /></AlertIndicator>
        <AlertContent>
          <AlertTitle>توجه امنیتی</AlertTitle>
          <AlertDescription>
            به دلایل امنیتی، کلید دسترسی و اطلاعات محرمانه سرویس پیامک فقط از طریق متغیرهای محیطی سرور تنظیم می‌شوند. این صفحه وضعیت سلامت و پیکربندی ماژول را نمایش می‌دهد.
          </AlertDescription>
        </AlertContent>
      </Alert>

      {isLoading && (
        <div className="flex min-h-[220px] flex-col items-center justify-center gap-3">
          <Spinner size="lg" />
          <p className="text-sm text-foreground-500">در حال استعلام وضعیت سرویس پیامک...</p>
        </div>
      )}

      {isError && (
        <Alert status="danger">
          <AlertContent>
            <AlertTitle>خطا</AlertTitle>
            <AlertDescription>{getErrorMessage(error, 'دریافت وضعیت سرویس پیامک ناموفق بود.')}</AlertDescription>
          </AlertContent>
        </Alert>
      )}

      {!isLoading && !isError && data && (
        <Card className="border border-default-200 shadow-sm rounded-3xl p-2 dark:border-white/10 glass-card">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div className="flex flex-col gap-1 p-4 rounded-2xl bg-default-50 dark:bg-default-100/30">
                <span className="text-xs text-foreground-500 font-medium">سرویس‌دهنده</span>
                <span className="text-base font-bold text-foreground">{providerLabels[data.provider] || data.provider}</span>
              </div>

              <div className="flex flex-col gap-1 p-4 rounded-2xl bg-default-50 dark:bg-default-100/30">
                <span className="text-xs text-foreground-500 font-medium">وضعیت پیکربندی</span>
                <div className="mt-1">
                  <Chip color={data.configured ? 'success' : 'danger'} variant="soft" className="font-semibold">
                    {data.configured ? 'پیکربندی شده' : 'پیکربندی نشده'}
                  </Chip>
                </div>
              </div>

              <div className="flex flex-col gap-1 p-4 rounded-2xl bg-default-50 dark:bg-default-100/30">
                <span className="text-xs text-foreground-500 font-medium">شماره فرستنده</span>
                <span className="text-base font-bold text-foreground font-mono" dir="ltr">{data.maskedSender || '—'}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default SmsConfigPage;

