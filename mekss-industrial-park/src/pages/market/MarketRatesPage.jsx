import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  Table,
  TableContent,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Button,
  Input,
  Skeleton,
  Alert,
  AlertContent,
  AlertTitle,
  AlertDescription,
  Spinner,
} from '@heroui/react';
import { LineChart, RefreshCw } from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart as ReLineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import { marketApi } from '../../services/api/market.api';
import { useAuth } from '../../providers/AuthProvider';
import { useNotification } from '../../providers/NotificationProvider';
import { getErrorMessage } from '../../utils/apiError';
import { ResponsiveTable } from '../../components/common/ResponsiveTable';
import { amountInputToNumber, formatAmountInput } from '../../utils/amountFormat';

const chartKeys = ['USD', 'EUR', 'USDT', 'GOLD', 'BTC', 'OIL'];
const chartColors = {
  USD: '#21aa58',
  EUR: '#0ea5e9',
  USDT: '#14b8a6',
  GOLD: '#f59e0b',
  BTC: '#f97316',
  OIL: '#7c3aed',
};

export const MarketRatesPage = () => {
  const { user } = useAuth();
  const canEdit = user?.role === 'SUPER_ADMIN';
  const canRefresh = ['SUPER_ADMIN', 'PARK_MANAGER', 'FACTORY_OWNER', 'GOVERNMENT_OFFICIAL'].includes(user?.role);
  const { showNotification } = useNotification();
  const queryClient = useQueryClient();
  const [drafts, setDrafts] = useState({});

  const { data: rates = [], isLoading, isError, error } = useQuery({
    queryKey: ['market-rates'],
    queryFn: () => marketApi.getRates().then((res) => res.data),
    refetchInterval: 5 * 60_000,
  });

  const { data: history = [] } = useQuery({
    queryKey: ['market-rates', 'history'],
    queryFn: () => marketApi.getHistory(14).then((res) => res.data || []),
  });

  const updateMutation = useMutation({
    mutationFn: ({ key, value }) => marketApi.updateRate(key, { value }),
    onSuccess: () => {
      showNotification('نرخ به‌روز شد', 'success');
      queryClient.invalidateQueries({ queryKey: ['market-rates'] });
    },
    onError: (err) => showNotification(getErrorMessage(err, 'به‌روزرسانی نرخ ناموفق بود'), 'error'),
  });

  const refreshMutation = useMutation({
    mutationFn: () => marketApi.refreshRates(),
    onSuccess: () => {
      showNotification('نرخ‌های بازار از منبع آنلاین به‌روز شد', 'success');
      queryClient.invalidateQueries({ queryKey: ['market-rates'] });
    },
    onError: (err) => showNotification(getErrorMessage(err, 'به‌روزرسانی آنلاین ناموفق بود'), 'error'),
  });

  const draftValue = (rate) => {
    if (Object.prototype.hasOwnProperty.call(drafts, rate.key)) return drafts[rate.key];
    return formatAmountInput(String(rate.value), { allowDecimal: true });
  };

  const saveRate = (rate) => {
    const next = amountInputToNumber(draftValue(rate), { allowDecimal: true });
    if (!Number.isFinite(next)) {
      showNotification('مقدار نرخ معتبر نیست', 'error');
      return;
    }
    updateMutation.mutate({ key: rate.key, value: next });
  };

  const chartData = useMemo(() => {
    const byDay = new Map();
    for (const row of history) {
      if (!chartKeys.includes(row.key)) continue;
      const day = new Date(row.recordedAt).toLocaleDateString('fa-IR');
      if (!byDay.has(day)) byDay.set(day, { day });
      byDay.get(day)[row.key] = Number(row.value);
    }
    return [...byDay.values()];
  }, [history]);

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div className="page-toolbar">
        <div>
          <h1 className="text-xl font-bold sm:text-2xl">نرخ‌های بازار</h1>
          <p className="mt-1 text-sm text-foreground-500">
            نرخ‌های زنده ارز، طلا، تتر و رمزارزها از منابع معتبر (TGJU و بازارهای جهانی)
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canRefresh && (
            <Button
              variant="secondary"
              className="font-bold"
              isDisabled={refreshMutation.isPending}
              onPress={() => refreshMutation.mutate()}
            >
              {refreshMutation.isPending ? <Spinner size="sm" /> : <RefreshCw className="h-4 w-4" />}
              به‌روزرسانی آنلاین
            </Button>
          )}
          <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--color-brand-soft)] text-[var(--color-brand)]">
            <LineChart className="h-5 w-5" />
          </div>
        </div>
      </div>

      {chartData.length > 0 && (
        <Card className="rounded-2xl border border-default-200">
          <CardContent className="p-4 sm:p-6">
            <h2 className="mb-4 text-sm font-bold">روند ۱۴ روز اخیر</h2>
            <div className="h-72 w-full" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <ReLineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} width={70} />
                  <Tooltip />
                  <Legend />
                  {chartKeys.map((key) => (
                    <Line
                      key={key}
                      type="monotone"
                      dataKey={key}
                      stroke={chartColors[key]}
                      strokeWidth={2}
                      dot={false}
                      connectNulls
                    />
                  ))}
                </ReLineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="rounded-2xl border border-default-200">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-4">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}</div>
          ) : isError ? (
            <Alert status="danger">
              <AlertContent>
                <AlertTitle>خطا</AlertTitle>
                <AlertDescription>{getErrorMessage(error, 'دریافت نرخ‌ها ناموفق بود')}</AlertDescription>
              </AlertContent>
            </Alert>
          ) : (
            <ResponsiveTable>
              <Table>
                <TableContent aria-label="نرخ‌های بازار">
                  <TableHeader>
                    <TableColumn isRowHeader>عنوان</TableColumn>
                    <TableColumn>کلید</TableColumn>
                    <TableColumn>مقدار</TableColumn>
                    <TableColumn>واحد</TableColumn>
                    {canEdit && <TableColumn>ویرایش</TableColumn>}
                  </TableHeader>
                  <TableBody>
                    {rates.map((rate) => (
                      <TableRow key={rate.key} id={rate.key}>
                        <TableCell className="font-medium">{rate.label}</TableCell>
                        <TableCell dir="ltr">{rate.key}</TableCell>
                        <TableCell dir="ltr">
                          {Number(rate.value).toLocaleString('fa-IR', { maximumFractionDigits: 4 })}
                        </TableCell>
                        <TableCell>{rate.unit}</TableCell>
                        {canEdit && (
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Input
                                dir="ltr"
                                type="text"
                                inputMode="decimal"
                                className="w-32 rounded-lg font-mono"
                                value={draftValue(rate)}
                                onChange={(e) => setDrafts((prev) => ({
                                  ...prev,
                                  [rate.key]: formatAmountInput(e.target.value, { allowDecimal: true }),
                                }))}
                              />
                              <Button
                                size="sm"
                                variant="primary"
                                isDisabled={updateMutation.isPending}
                                onPress={() => saveRate(rate)}
                              >
                                {updateMutation.isPending ? <Spinner size="sm" /> : 'ذخیره'}
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </TableContent>
              </Table>
            </ResponsiveTable>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default MarketRatesPage;
