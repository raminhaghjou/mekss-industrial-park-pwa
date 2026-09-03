import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  Button,
  Input,
  Label,
  Select,
  SelectTrigger,
  SelectValue,
  SelectIndicator,
  SelectPopover,
  ListBox,
  ListBoxItem,
  Skeleton,
  Alert,
  AlertContent,
  AlertTitle,
  AlertDescription,
  Spinner,
} from '@heroui/react';
import { Wallet } from 'lucide-react';
import { factoryApi } from '../../services/api/factory.api';
import { useAuth } from '../../providers/AuthProvider';
import { useActiveFactory } from '../../providers/ActiveFactoryProvider';
import { useNotification } from '../../providers/NotificationProvider';
import { getErrorMessage } from '../../utils/apiError';

const formatMoney = (value) =>
  Number(value || 0).toLocaleString('fa-IR', { maximumFractionDigits: 0 });

export const FactoryWalletPage = () => {
  const { user } = useAuth();
  const { activeFactoryId, activeFactory, factories } = useActiveFactory();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { showNotification } = useNotification();
  const canTopUp = ['SUPER_ADMIN', 'PARK_MANAGER'].includes(user?.role);
  const paramFactoryId = searchParams.get('factoryId') || '';
  const [managerFactoryId, setManagerFactoryId] = useState(paramFactoryId);
  const [amount, setAmount] = useState('');
  const [managedFactories, setManagedFactories] = useState([]);

  const factoryId = canTopUp ? (managerFactoryId || paramFactoryId) : activeFactoryId;

  const managedQuery = useQuery({
    queryKey: ['factories', 'wallet-scope'],
    queryFn: async () => {
      const res = await factoryApi.getManagedFactories({ page: 1, pageSize: 100 });
      const items = res.data?.items || res.data || [];
      setManagedFactories(items);
      if (!managerFactoryId && (paramFactoryId || items[0]?.id)) {
        setManagerFactoryId(paramFactoryId || items[0].id);
      }
      return items;
    },
    enabled: canTopUp,
  });

  const { data: wallet, isLoading, isError, error } = useQuery({
    queryKey: ['factory-wallet', factoryId],
    queryFn: () => factoryApi.getWallet(factoryId).then((res) => res.data),
    enabled: Boolean(factoryId),
  });

  const topUpMutation = useMutation({
    mutationFn: (value) => factoryApi.topUpWallet(factoryId, value),
    onSuccess: () => {
      showNotification('شارژ کیف پول با موفقیت انجام شد', 'success');
      setAmount('');
      queryClient.invalidateQueries({ queryKey: ['factory-wallet', factoryId] });
    },
    onError: (err) => showNotification(getErrorMessage(err, 'شارژ کیف پول ناموفق بود'), 'error'),
  });

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold sm:text-2xl">کیف پول مجوز عبور</h1>
        <p className="mt-1 text-sm text-foreground-500">
          موجودی برای صدور برگ خروج از این کیف پول کسر می‌شود.
        </p>
      </div>

      {canTopUp && (
        <div className="flex flex-col gap-1">
          <Label className="text-xs">انتخاب واحد صنعتی</Label>
          <Select
            value={factoryId}
            onChange={(val) => setManagerFactoryId(String(val || ''))}
            isDisabled={managedQuery.isLoading}
            className="rounded-xl"
            placeholder="واحد صنعتی"
          >
            <SelectTrigger><SelectValue /><SelectIndicator /></SelectTrigger>
            <SelectPopover>
              <ListBox>
                {(managedFactories.length ? managedFactories : managedQuery.data || []).map((factory) => (
                  <ListBoxItem key={factory.id} id={factory.id}>{factory.name}</ListBoxItem>
                ))}
              </ListBox>
            </SelectPopover>
          </Select>
        </div>
      )}

      {!canTopUp && !activeFactory && factories.length === 0 && (
        <Alert status="warning">
          <AlertContent>
            <AlertTitle>واحدی یافت نشد</AlertTitle>
            <AlertDescription>برای مشاهده کیف پول ابتدا واحد صنعتی ثبت کنید.</AlertDescription>
          </AlertContent>
        </Alert>
      )}

      {isLoading ? (
        <Skeleton className="h-44 rounded-3xl" />
      ) : isError ? (
        <Alert status="danger">
          <AlertContent>
            <AlertTitle>خطا</AlertTitle>
            <AlertDescription>{getErrorMessage(error, 'دریافت موجودی ناموفق بود')}</AlertDescription>
          </AlertContent>
        </Alert>
      ) : wallet ? (
        <Card className="overflow-hidden rounded-3xl border-0 bg-gradient-to-l from-[#0f4c81] to-[#1a5f96] text-white shadow-md">
          <CardContent className="gap-4 p-6 sm:p-8">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15">
                <Wallet className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm text-white/80">موجودی کیف پول</p>
                <p className="text-lg font-semibold">{wallet.name || activeFactory?.name}</p>
              </div>
            </div>
            <p className="text-3xl font-bold tracking-tight sm:text-4xl">
              {formatMoney(wallet.balance)}
              <span className="ms-2 text-base font-medium text-white/80">ریال</span>
            </p>
          </CardContent>
        </Card>
      ) : null}

      {canTopUp && factoryId && (
        <Card className="rounded-2xl border border-default-200">
          <CardContent className="gap-4 p-5">
            <h2 className="font-semibold">شارژ کیف پول</h2>
            <div className="flex flex-col gap-1">
              <Label className="text-xs">مبلغ (ریال)</Label>
              <Input
                type="number"
                min="1"
                dir="ltr"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="rounded-xl"
                placeholder="مثلاً 500000"
              />
            </div>
            <Button
              variant="primary"
              className="font-bold"
              isDisabled={!amount || Number(amount) <= 0 || topUpMutation.isPending}
              onPress={() => topUpMutation.mutate(Number(amount))}
            >
              {topUpMutation.isPending ? <Spinner size="sm" /> : 'ثبت شارژ'}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default FactoryWalletPage;
