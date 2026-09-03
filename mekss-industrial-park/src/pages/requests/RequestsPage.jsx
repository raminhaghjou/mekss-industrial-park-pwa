import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
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
  Chip,
  Skeleton,
  Alert,
  AlertContent,
  AlertTitle,
  AlertDescription,
} from '@heroui/react';
import { Check, Plus, FileText, X } from 'lucide-react';
import { requestApi } from '../../services/api/request.api';
import { useAuth } from '../../providers/AuthProvider';
import { useNotification } from '../../providers/NotificationProvider';
import { getErrorMessage } from '../../utils/apiError';
import { requestStatusLabels as statusLabels, requestTypeLabels as typeLabels } from '../../constants/persianLabels';
import { EmptyState } from '../../components/common/EmptyState';
import { ResponsiveTable } from '../../components/common/ResponsiveTable';

const statusColors = { PENDING: 'warning', APPROVED: 'success', REJECTED: 'danger', CANCELLED: 'default' };

export const RequestsPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showNotification } = useNotification();
  const queryClient = useQueryClient();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['requests'],
    queryFn: () => requestApi.getRequests().then((res) => res.data),
  });

  const approveMutation = useMutation({
    mutationFn: (id) => requestApi.approveRequest(id),
    onSuccess: () => {
      showNotification('درخواست تایید شد', 'success');
      queryClient.invalidateQueries({ queryKey: ['requests'] });
    },
    onError: (err) => showNotification(getErrorMessage(err, 'تایید درخواست ناموفق بود'), 'error'),
  });

  const rejectMutation = useMutation({
    mutationFn: (id) => requestApi.rejectRequest(id, { reason: 'رد توسط تاییدکننده واحد' }),
    onSuccess: () => {
      showNotification('درخواست رد شد', 'success');
      queryClient.invalidateQueries({ queryKey: ['requests'] });
    },
    onError: (err) => showNotification(getErrorMessage(err, 'رد درخواست ناموفق بود'), 'error'),
  });

  const requests = data || [];
  const canCreate = ['SUPER_ADMIN', 'PARK_MANAGER', 'FACTORY_OWNER', 'EMPLOYEE'].includes(user?.role);
  const canDecideInternal = (req) => {
    if (req.status !== 'PENDING' || req.isToParkManager) return false;
    if (user?.role === 'FACTORY_OWNER') return true;
    if (user?.role === 'EMPLOYEE') {
      const allowed = user?.canApproveRequestTypes || [];
      return allowed.includes(req.type);
    }
    return false;
  };

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div className="page-toolbar">
        <h1 className="text-xl font-bold text-foreground sm:text-2xl">درخواست‌ها</h1>
        {canCreate && (
          <Button variant="primary" onPress={() => navigate('/requests/new/general')} className="flex w-full items-center justify-center gap-2 sm:w-auto">
            <Plus className="h-4 w-4" />
            ثبت درخواست جدید
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
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
          ) : requests.length === 0 ? (
            <EmptyState
              icon={<FileText className="h-6 w-6" />}
              title="هنوز درخواستی ثبت نشده است"
              description="با دکمه «ثبت درخواست جدید» می‌توانید اولین درخواست را ارسال کنید."
            />
          ) : (
            <ResponsiveTable>
              <Table>
                <TableContent aria-label="درخواست‌ها">
                  <TableHeader>
                    <TableColumn isRowHeader>نوع</TableColumn>
                    <TableColumn>موضوع</TableColumn>
                    <TableColumn>مقصد</TableColumn>
                    <TableColumn>تاریخ</TableColumn>
                    <TableColumn>وضعیت</TableColumn>
                    <TableColumn>اقدام</TableColumn>
                  </TableHeader>
                  <TableBody>
                    {requests.map((req) => (
                      <TableRow key={req.id} id={req.id}>
                        <TableCell>{typeLabels[req.type] || req.type}</TableCell>
                        <TableCell>{req.title}</TableCell>
                        <TableCell className="text-sm text-foreground-500">
                          {req.isToParkManager ? 'مدیر شهرک' : 'داخلی واحد'}
                        </TableCell>
                        <TableCell>{new Date(req.createdAt).toLocaleDateString('fa-IR')}</TableCell>
                        <TableCell>
                          <Chip color={statusColors[req.status] || 'default'} size="sm" variant="soft">
                            {statusLabels[req.status] || req.status}
                          </Chip>
                        </TableCell>
                        <TableCell>
                          {canDecideInternal(req) ? (
                            <div className="flex items-center gap-1">
                              <Button
                                size="sm"
                                variant="secondary"
                                className="min-w-0 px-2 text-success-700"
                                isDisabled={approveMutation.isPending || rejectMutation.isPending}
                                onPress={() => approveMutation.mutate(req.id)}
                                aria-label="تایید"
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="min-w-0 px-2 text-danger"
                                isDisabled={approveMutation.isPending || rejectMutation.isPending}
                                onPress={() => rejectMutation.mutate(req.id)}
                                aria-label="رد"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : (
                            <span className="text-xs text-foreground-400">—</span>
                          )}
                        </TableCell>
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

export default RequestsPage;
