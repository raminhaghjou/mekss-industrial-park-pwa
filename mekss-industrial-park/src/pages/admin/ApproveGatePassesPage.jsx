import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, Button, Skeleton, Alert, AlertContent, AlertTitle, AlertDescription, Spinner } from '@heroui/react';
import { Check, X, Ticket } from 'lucide-react';
import { gatePassApi } from '../../services/api/gatePass.api';
import { useNotification } from '../../providers/NotificationProvider';
import { getErrorMessage } from '../../utils/apiError';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { EmptyState } from '../../components/common/EmptyState';

export const ApproveGatePassesPage = () => {
  const [tab, setTab] = useState('pending');
  const [approveTarget, setApproveTarget] = useState(null);
  const [rejectTarget, setRejectTarget] = useState(null);
  const { showNotification } = useNotification();
  const queryClient = useQueryClient();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['gate-passes', 'managed'],
    queryFn: () => gatePassApi.getGatePasses().then((res) => res.data),
  });

  const passes = data || [];
  const filteredPasses = passes.filter((p) => (tab === 'pending' ? p.status === 'PENDING' : p.status !== 'PENDING'));

  const approveMutation = useMutation({
    mutationFn: (id) => gatePassApi.approveGatePass(id),
    onSuccess: () => {
      showNotification('برگ خروج با موفقیت تایید شد', 'success');
      setApproveTarget(null);
      queryClient.invalidateQueries({ queryKey: ['gate-passes', 'managed'] });
    },
    onError: (err) => showNotification(getErrorMessage(err, 'تایید برگ خروج ناموفق بود'), 'error'),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }) => gatePassApi.rejectGatePass(id, { reason }),
    onSuccess: () => {
      showNotification('برگ خروج رد شد', 'success');
      setRejectTarget(null);
      queryClient.invalidateQueries({ queryKey: ['gate-passes', 'managed'] });
    },
    onError: (err) => showNotification(getErrorMessage(err, 'رد برگ خروج ناموفق بود'), 'error'),
  });

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <h1 className="text-2xl font-bold text-foreground">تایید برگ‌های خروج</h1>

      <Card>
        <CardContent className="p-0">
          <div className="flex gap-2 border-b border-default-200 p-2">
            <button
              onClick={() => setTab('pending')}
              className={`px-4 py-2 text-sm font-medium rounded-xl transition-colors ${tab === 'pending' ? 'bg-primary text-white font-bold' : 'text-foreground-500 hover:bg-default-100'}`}
            >
              در انتظار تایید
            </button>
            <button
              onClick={() => setTab('history')}
              className={`px-4 py-2 text-sm font-medium rounded-xl transition-colors ${tab === 'history' ? 'bg-primary text-white font-bold' : 'text-foreground-500 hover:bg-default-100'}`}
            >
              تاریخچه
            </button>
          </div>

          {isLoading ? (
            <div className="flex flex-col gap-2 p-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 rounded-lg" />
              ))}
            </div>
          ) : isError ? (
            <Alert status="danger">
              <AlertContent>
                <AlertTitle>خطا در دریافت اطلاعات</AlertTitle>
                <AlertDescription>{getErrorMessage(error, 'دریافت برگ‌های خروج ناموفق بود.')}</AlertDescription>
              </AlertContent>
            </Alert>
          ) : filteredPasses.length === 0 ? (
            <EmptyState
              icon={<Ticket className="h-6 w-6" />}
              title={tab === 'pending' ? 'برگ خروجی در انتظار تایید نیست' : 'تاریخچه‌ای برای نمایش وجود ندارد'}
              description={tab === 'pending' ? 'به محض ثبت برگ خروج جدید توسط واحدهای صنعتی، برای بررسی اینجا نمایش داده می‌شود.' : undefined}
            />
          ) : (
            <Table aria-label="برگ‌های خروج">
              <TableHeader>
                <TableColumn>واحد صنعتی</TableColumn>
                <TableColumn>نام راننده</TableColumn>
                <TableColumn>شماره پلاک</TableColumn>
                <TableColumn>تاریخ خروج</TableColumn>
                <TableColumn>عملیات</TableColumn>
              </TableHeader>
              <TableBody>
                {filteredPasses.map((pass) => (
                  <TableRow key={pass.id}>
                    <TableCell>{pass.factory?.name || '—'}</TableCell>
                    <TableCell>{pass.driverName}</TableCell>
                    <TableCell dir="ltr">{pass.licensePlate}</TableCell>
                    <TableCell>{new Date(pass.exitDate).toLocaleDateString('fa-IR')}</TableCell>
                    <TableCell>
                      {pass.status === 'PENDING' && (
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            isIconOnly
                            onPress={() => setApproveTarget(pass.id)}
                            disabled={approveMutation.isPending}
                            aria-label="تایید"
                          >
                            {approveMutation.isPending && approveTarget === pass.id ? <Spinner size="sm" /> : <Check className="h-4 w-4 text-success" />}
                          </Button>
                          <Button
                            variant="danger-soft"
                            size="sm"
                            isIconOnly
                            onPress={() => setRejectTarget(pass.id)}
                            aria-label="رد"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={Boolean(approveTarget)}
        title="تایید برگ خروج"
        description="با تایید این برگ خروج، اجازه تردد برای واحد صنعتی صادر می‌شود. آیا اطمینان دارید؟"
        confirmLabel="تایید"
        confirmColor="primary"
        loading={approveMutation.isPending}
        onConfirm={() => approveMutation.mutate(approveTarget)}
        onClose={() => setApproveTarget(null)}
      />

      <ConfirmDialog
        open={Boolean(rejectTarget)}
        title="رد برگ خروج"
        description="لطفا دلیل رد این برگ خروج را وارد کنید."
        requireReason
        reasonLabel="دلیل رد"
        confirmLabel="رد کردن"
        confirmColor="danger"
        loading={rejectMutation.isPending}
        onConfirm={(reason) => rejectMutation.mutate({ id: rejectTarget, reason })}
        onClose={() => setRejectTarget(null)}
      />
    </div>
  );
};

export default ApproveGatePassesPage;
