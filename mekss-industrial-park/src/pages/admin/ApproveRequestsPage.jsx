import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardBody, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, Button, Chip, Tabs, Tab, Skeleton, Alert } from '@heroui/react';
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
        <CardBody className="p-0">
          <div className="border-b border-default-200 p-2">
            <Tabs selectedKey={tab} onSelectionChange={setTab} variant="underlined">
              <Tab key="pending" title="در انتظار تایید" />
              <Tab key="history" title="تاریخچه" />
            </Tabs>
          </div>

          {isLoading ? (
            <div className="flex flex-col gap-2 p-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 rounded-lg" />
              ))}
            </div>
          ) : isError ? (
            <Alert color="danger" title="خطا در دریافت اطلاعات">
              {getErrorMessage(error, 'دریافت درخواست‌ها ناموفق بود.')}
            </Alert>
          ) : filteredRequests.length === 0 ? (
            <EmptyState
              icon={<FileText className="h-6 w-6" />}
              title={tab === 'pending' ? 'درخواستی در انتظار بررسی نیست' : 'تاریخچه‌ای برای نمایش وجود ندارد'}
              description={tab === 'pending' ? 'درخواست‌های جدید واحدهای صنعتی برای بررسی در این بخش نمایش داده می‌شوند.' : undefined}
            />
          ) : (
            <Table removeWrapper aria-label="درخواست‌ها">
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
                      <Chip color={statusColors[req.status] || 'default'} size="sm" variant="flat">
                        {statusLabels[req.status] || req.status}
                      </Chip>
                    </TableCell>
                    <TableCell>
                      {req.status === 'PENDING' && (
                        <div className="flex gap-2">
                          <Button
                            color="success"
                            variant="flat"
                            size="sm"
                            isIconOnly
                            onClick={() => setApproveTarget(req.id)}
                            isLoading={approveMutation.isPending}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            color="danger"
                            variant="flat"
                            size="sm"
                            isIconOnly
                            onClick={() => setRejectTarget(req.id)}
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
        </CardBody>
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
