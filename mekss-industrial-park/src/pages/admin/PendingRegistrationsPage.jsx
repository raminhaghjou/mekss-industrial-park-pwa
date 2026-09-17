import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  Button,
  Spinner,
  Alert,
  AlertContent,
  AlertTitle,
  AlertDescription,
} from '@heroui/react';
import { UserCheck, CheckCircle2, XCircle } from 'lucide-react';
import { userApi } from '../../services/api/user.api';
import { useNotification } from '../../providers/NotificationProvider';
import { getErrorMessage } from '../../utils/apiError';
import { useAuth } from '../../providers/AuthProvider';

const roleLabels = {
  FACTORY_OWNER: 'مالک واحد صنعتی',
  EMPLOYEE: 'کارمند',
};

export const PendingRegistrationsPage = () => {
  const { user } = useAuth();
  const { showNotification } = useNotification();
  const queryClient = useQueryClient();

  const { data = [], isLoading, isError, error } = useQuery({
    queryKey: ['users', 'pending-registrations'],
    queryFn: () => userApi.getPendingRegistrations().then((res) => res.data),
  });

  const approveMutation = useMutation({
    mutationFn: (id) => userApi.approveRegistration(id),
    onSuccess: () => {
      showNotification('ثبت‌نام تایید شد', 'success');
      queryClient.invalidateQueries({ queryKey: ['users', 'pending-registrations'] });
    },
    onError: (err) => showNotification(getErrorMessage(err, 'تایید ناموفق بود'), 'error'),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }) => userApi.rejectRegistration(id, reason),
    onSuccess: () => {
      showNotification('ثبت‌نام رد شد', 'success');
      queryClient.invalidateQueries({ queryKey: ['users', 'pending-registrations'] });
    },
    onError: (err) => showNotification(getErrorMessage(err, 'رد درخواست ناموفق بود'), 'error'),
  });

  const title = user?.role === 'FACTORY_OWNER'
    ? 'درخواست‌های عضویت پرسنل'
    : 'درخواست‌های ثبت‌نام مدیران واحد';

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--color-brand-soft)] text-[var(--color-brand)]">
          <UserCheck className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-xl font-bold sm:text-2xl">{title}</h1>
          <p className="text-sm text-foreground-500">فقط درخواست‌های مربوط به حوزه دسترسی شما نمایش داده می‌شود</p>
        </div>
      </div>

      {isLoading && (
        <div className="flex min-h-[160px] items-center justify-center"><Spinner size="lg" /></div>
      )}

      {isError && (
        <Alert status="danger">
          <AlertContent>
            <AlertTitle>خطا</AlertTitle>
            <AlertDescription>{getErrorMessage(error, 'دریافت درخواست‌ها ناموفق بود')}</AlertDescription>
          </AlertContent>
        </Alert>
      )}

      {!isLoading && !isError && data.length === 0 && (
        <Card className="rounded-2xl border border-dashed border-default-300">
          <CardContent className="p-10 text-center text-sm text-foreground-500">
            درخواست معلقی وجود ندارد.
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col gap-3">
        {data.map((item) => (
          <Card key={item.id} className="rounded-2xl border border-default-200">
            <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-bold text-foreground">{item.name}</p>
                <p className="mt-1 text-xs text-foreground-500" dir="ltr">{item.phoneNumber}</p>
                <p className="mt-1 text-xs text-foreground-600">
                  {roleLabels[item.role] || item.role}
                  {item.requestedPark?.name ? ` · شهرک ${item.requestedPark.name}` : ''}
                  {item.employeeOfFactory?.name ? ` · واحد ${item.employeeOfFactory.name}` : ''}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="primary"
                  className="font-bold"
                  isDisabled={approveMutation.isPending || rejectMutation.isPending}
                  onPress={() => approveMutation.mutate(item.id)}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  تایید
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  className="font-bold"
                  isDisabled={approveMutation.isPending || rejectMutation.isPending}
                  onPress={() => {
                    const reason = window.prompt('دلیل رد درخواست:');
                    if (!reason?.trim()) return;
                    rejectMutation.mutate({ id: item.id, reason: reason.trim() });
                  }}
                >
                  <XCircle className="h-4 w-4" />
                  رد
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default PendingRegistrationsPage;
