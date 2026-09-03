import { useState } from 'react';
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
import { LineChart } from 'lucide-react';
import { marketApi } from '../../services/api/market.api';
import { useAuth } from '../../providers/AuthProvider';
import { useNotification } from '../../providers/NotificationProvider';
import { getErrorMessage } from '../../utils/apiError';
import { ResponsiveTable } from '../../components/common/ResponsiveTable';

export const MarketRatesPage = () => {
  const { user } = useAuth();
  const canEdit = user?.role === 'SUPER_ADMIN';
  const { showNotification } = useNotification();
  const queryClient = useQueryClient();
  const [drafts, setDrafts] = useState({});

  const { data: rates = [], isLoading, isError, error } = useQuery({
    queryKey: ['market-rates'],
    queryFn: () => marketApi.getRates().then((res) => res.data),
  });

  const updateMutation = useMutation({
    mutationFn: ({ key, value }) => marketApi.updateRate(key, { value: Number(value) }),
    onSuccess: () => {
      showNotification('نرخ به‌روز شد', 'success');
      queryClient.invalidateQueries({ queryKey: ['market-rates'] });
    },
    onError: (err) => showNotification(getErrorMessage(err, 'به‌روزرسانی نرخ ناموفق بود'), 'error'),
  });

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div className="page-toolbar">
        <div>
          <h1 className="text-xl font-bold sm:text-2xl">نرخ‌های بازار</h1>
          <p className="mt-1 text-sm text-foreground-500">نرخ‌های مرجع ارز، فلزات و شاخص‌های مرتبط</p>
        </div>
        <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[#0f4c81]/10 text-[#0f4c81]">
          <LineChart className="h-5 w-5" />
        </div>
      </div>

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
                                type="number"
                                className="w-28 rounded-lg"
                                value={drafts[rate.key] ?? String(rate.value)}
                                onChange={(e) => setDrafts((prev) => ({ ...prev, [rate.key]: e.target.value }))}
                              />
                              <Button
                                size="sm"
                                variant="primary"
                                isDisabled={updateMutation.isPending}
                                onPress={() => updateMutation.mutate({ key: rate.key, value: drafts[rate.key] ?? rate.value })}
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
