import React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  Alert,
  AlertContent,
  AlertTitle,
  AlertDescription,
  Spinner,
} from '@heroui/react';
import { Wallet } from 'lucide-react';
import { settingsApi } from '../../services/api/settings.api';
import { SettingToggle } from '../../components/common/SettingToggle';
import { useNotification } from '../../providers/NotificationProvider';
import { getErrorMessage } from '../../utils/apiError';

/**
 * Super-admin control: require factory wallet balance before creating gate passes.
 */
export const GatePassWalletSettingCard = () => {
  const { showNotification } = useNotification();
  const queryClient = useQueryClient();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['settings', 'gate-pass-wallet'],
    queryFn: () => settingsApi.getGatePassWallet().then((res) => res.data),
  });

  const mutation = useMutation({
    mutationFn: (requireWalletBalance) => settingsApi.updateGatePassWallet(requireWalletBalance),
    onSuccess: (res) => {
      queryClient.setQueryData(['settings', 'gate-pass-wallet'], res.data);
      showNotification(
        res.data?.requireWalletBalance
          ? 'شرط موجودی کیف‌پول برای برگ خروج فعال شد.'
          : 'شرط موجودی کیف‌پول برای برگ خروج غیرفعال شد.',
        'success',
      );
    },
    onError: (err) => showNotification(getErrorMessage(err, 'ذخیره تنظیمات ناموفق بود.'), 'error'),
  });

  const requireWallet = Boolean(data?.requireWalletBalance);
  const fee = Number(data?.fee || 0);

  return (
    <Card className="border border-default-200 shadow-sm rounded-2xl dark:border-white/10 animate-slide-up">
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300">
              <Wallet className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-foreground">کیف‌پول برگ خروج (تنظیم سراسری)</h2>
              {!isLoading && !isError && (
                <p className={`mt-1 text-sm font-semibold ${requireWallet ? 'text-success-700' : 'text-foreground-600'}`} data-testid="wallet-setting-state">
                  وضعیت فعلی: {requireWallet ? 'فعال' : 'غیرفعال'}
                </p>
              )}
              <p className="mt-1 text-sm text-foreground-500">
                روشن: ثبت هر برگ خروج فقط با موجودی کافی کیف‌پول واحد صنعتی ممکن است
                {fee > 0 ? ` و ${fee.toLocaleString('fa-IR')} ریال از کیف‌پول کسر می‌شود` : ''}.
              </p>
              <p className="mt-1 text-sm text-foreground-500">
                خاموش: برگ خروج بدون کیف‌پول و بدون هزینه ثبت می‌شود و منوی «کیف پول» و پیام‌های هزینه برای مدیران شهرک و مالکان واحدها پنهان می‌شود.
                این تنظیم برای همهٔ شهرک‌ها اعمال می‌شود و فقط ادمین کل می‌تواند آن را تغییر دهد.
              </p>
            </div>
          </div>
          {isLoading ? (
            <Spinner size="sm" />
          ) : (
            <SettingToggle
              checked={requireWallet}
              label="الزام موجودی کیف‌پول برای برگ خروج"
              disabled={isError || mutation.isPending}
              onChange={(next) => mutation.mutate(next)}
            />
          )}
        </div>
        {isError && (
          <Alert status="danger" className="mt-4">
            <AlertContent>
              <AlertTitle>خطا</AlertTitle>
              <AlertDescription>{getErrorMessage(error, 'دریافت تنظیمات ناموفق بود.')}</AlertDescription>
            </AlertContent>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};

export default GatePassWalletSettingCard;
