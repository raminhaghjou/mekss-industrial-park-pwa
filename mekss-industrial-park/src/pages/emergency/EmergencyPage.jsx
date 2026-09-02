import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  CardHeader,
  Button,
  TextArea,
  Skeleton,
  Alert,
  AlertContent,
  AlertTitle,
  AlertDescription,
} from '@heroui/react';
import { AlertTriangle, CheckCircle } from 'lucide-react';
import { emergencyApi } from '../../services/api/emergency.api';
import { useNotification } from '../../providers/NotificationProvider';
import { getErrorMessage } from '../../utils/apiError';

export const EmergencyPage = () => {
  const { showNotification } = useNotification();
  const [description, setDescription] = useState('');

  const { data: alerts, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['emergency-alerts'],
    queryFn: () => emergencyApi.getActiveAlerts().then((res) => res.data),
  });

  const createMutation = useMutation({
    mutationFn: (data) => emergencyApi.createAlert(data),
    onSuccess: () => {
      showNotification('هشدار اضطراری ارسال شد', 'success');
      setDescription('');
      refetch();
    },
    onError: (err) => showNotification(getErrorMessage(err, 'ارسال هشدار ناموفق بود'), 'error'),
  });

  const resolveMutation = useMutation({
    mutationFn: (id) => emergencyApi.resolveAlert(id),
    onSuccess: () => {
      showNotification('هشدار رفع شد', 'success');
      refetch();
    },
    onError: (err) => showNotification(getErrorMessage(err, 'رفع هشدار ناموفق بود'), 'error'),
  });

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <h1 className="text-2xl font-bold text-foreground">هشدارهای اضطراری</h1>

      <Card className="border-danger-200 bg-danger-50 dark:bg-danger-950">
        <CardHeader className="p-4">
          <div className="flex items-center gap-2 text-danger-700 dark:text-danger-300">
            <AlertTriangle className="h-5 w-5" />
            <h2 className="font-semibold">ثبت هشدار جدید</h2>
          </div>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <TextArea
            placeholder="توضیحات هشدار را وارد کنید..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            minRows={3}
          />
          <Button
            variant="danger"
            className="mt-4 flex items-center gap-2"
            onPress={() => createMutation.mutate({ description })}
            isLoading={createMutation.isPending}
            isDisabled={createMutation.isPending || !description.trim()}
          >
            <AlertTriangle className="h-4 w-4" />
            ارسال هشدار
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="p-4">
          <h2 className="font-semibold text-foreground">هشدارهای فعال</h2>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex flex-col gap-2 p-4">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-20 rounded-lg" />
              ))}
            </div>
          ) : isError ? (
            <Alert status="danger">
              <AlertContent>
                <AlertTitle>خطا در دریافت اطلاعات</AlertTitle>
                <AlertDescription>{getErrorMessage(error, 'دریافت هشدارها ناموفق بود.')}</AlertDescription>
              </AlertContent>
            </Alert>
          ) : !alerts || alerts.length === 0 ? (
            <div className="p-8 text-center text-foreground-500">
              <CheckCircle className="mx-auto h-12 w-12 text-success-500" />
              <p className="mt-2">هیچ هشدار فعالی وجود ندارد</p>
            </div>
          ) : (
            <div className="divide-y divide-default-200">
              {alerts.map((alert) => (
                <div key={alert.id} className="flex items-center justify-between p-4">
                  <div>
                    <p className="font-medium text-foreground">{alert.description}</p>
                    <p className="text-sm text-foreground-500">
                      {new Date(alert.createdAt).toLocaleString('fa-IR')}
                    </p>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="flex items-center gap-2"
                    onPress={() => resolveMutation.mutate(alert.id)}
                    isLoading={resolveMutation.isPending}
                  >
                    <CheckCircle className="h-4 w-4" />
                    رفع شد
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default EmergencyPage;
