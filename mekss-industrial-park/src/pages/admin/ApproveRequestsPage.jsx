import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, Button, Chip, Skeleton, Alert, AlertContent, AlertTitle, AlertDescription, Spinner } from '@heroui/react';
import { Check, X, FileText } from 'lucide-react';
import { requestApi } from '../../services/api/request.api';
import { useNotification } from '../../providers/NotificationProvider';
import { getErrorMessage } from '../../utils/apiError';
import { requestStatusLabels as statusLabels, requestTypeLabels as typeLabels } from '../../constants/persianLabels';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { EmptyState } from '../../components/common/EmptyState';

const statusColors = { PENDING: 'warning', APPROVED: 'success', REJECTED: 'danger', CANCELLED: 'default' };

export const ApproveRequestsPage = () => {
  const [tab, setTab] = useState('pending');
  const [approveTarget, setApproveTarget] = useState(null);
  const [rejectTarget, setRejectTarget] = useState(null);
  const { showNotification } = useNotification();
  const queryClient = useQueryClient();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['requests', 'managed'],
    queryFn: () => requestApi.getRequests().then((res) => res.data),
  });

  const requests = data || [];
  const filteredRequests = requests.filter((r) => (tab === 'pending' ? r.status === 'PENDING' : r.status !== 'PENDING'));

  const approveMutation = useMutation({
    mutationFn: (id) => requestApi.approveRequest(id),
    onSuccess: () => {
      showNotification('درخواست با موفقیت تایید شد', 'success');
      setApproveTarget(null);
      queryClient.invalidateQueries({ queryKey: ['requests', 'managed'] });
    },
    onError: (err) => showNotification(getErrorMessage(err, 'تایید درخواست ناموفق بود'), 'error'),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }) => requestApi.rejectRequest(id, { reason }),
    onSuccess: () => {
      showNotification('درخواست رد شد', 'success');
      setRejectTarget(null);
      queryClient.invalidateQueries({ queryKey: ['requests', 'managed'] });
    },
    onError: (err) => showNotification(getErrorMessage(err, 'رد درخواست ناموفق بود'), 'error'),
  });

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <h1 className="text-2xl font-bold text-foreground">تایید درخواست‌ها</h1>

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
                <AlertDescription>{getErrorMessage(error, 'دریافت درخواست‌ها ناموفق بود.')}</AlertDescription>
              </AlertContent>
            </Alert>
          ) : filteredRequests.length === 0 ? (
            <EmptyState
              icon={<FileText className="h-6 w-6" />}
              title={tab === 'pending' ? 'درخواستی در انتظار بررسی نیست' : 'تاریخچه‌ای برای نمایش وجود ندارد'}
              description={tab === 'pending' ? 'درخواست‌های جدید واحدهای صنعتی برای بررسی در این بخش نمایش داده می‌شوند.' : undefined}
            />
          ) : (
            <Table aria-label="درخواست‌ها">
              <TableHeader>
                <TableColumn>نوع</TableColumn>
                <TableColumn>موضوع</TableColumn>
                <TableColumn>واحد صنعتی</TableColumn>
                <TableColumn>تاریخ</TableColumn>
                <TableColumn>وضعیت</TableColumn>
                <TableColumn>عملیات</TableColumn>
              </TableHeader>
              <TableBody>
                {filteredRequests.map((req) => (
                  <TableRow key={req.id}>
                    <TableCell>{typeLabels[req.type] || req.type}</TableCell>
                    <TableCell>{req.title}</TableCell>
                    <TableCell>{req.factory?.name || '—'}</TableCell>
                    <TableCell>{new Date(req.createdAt).toLocaleDateString('fa-IR')}</TableCell>
                    <TableCell>
                      <Chip color={statusColors[req.status] || 'default'} size="sm" variant="soft">
                        {statusLabels[req.status] || req.status}
                      </Chip>
                    </TableCell>
                    <TableCell>
                      {req.status === 'PENDING' && (
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            isIconOnly
                            onPress={() => setApproveTarget(req.id)}
                            isDisabled={approveMutation.isPending}
                            aria-label="تایید"
                          >
                            {approveMutation.isPending && approveTarget === req.id ? <Spinner size="sm" /> : <Check className="h-4 w-4 text-success" />}
                          </Button>
                          <Button
                            variant="danger-soft"
                            size="sm"
                            isIconOnly
                            onPress={() => setRejectTarget(req.id)}
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
        title="تایید درخواست"
        description="آیا از تایید این درخواست اطمینان دارید؟"
        confirmLabel="تایید"
        confirmColor="primary"
        loading={approveMutation.isPending}
        onConfirm={() => approveMutation.mutate(approveTarget)}
        onClose={() => setApproveTarget(null)}
      />

      <ConfirmDialog
        open={Boolean(rejectTarget)}
        title="رد درخواست"
        description="لطفا دلیل رد این درخواست را وارد کنید."
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

export default ApproveRequestsPage;
