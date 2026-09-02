import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  Chip,
  Alert,
  Spinner,
} from '@heroui/react';
import { AlertTriangle, Flame, ShieldAlert } from 'lucide-react';
import { emergencyApi } from '../../services/api/emergency.api';
import { getErrorMessage } from '../../utils/apiError';

const severityLabels = {
  LOW: { label: 'کم', color: 'default' },
  MEDIUM: { label: 'متوسط', color: 'warning' },
  HIGH: { label: 'زیاد', color: 'danger' },
  CRITICAL: { label: 'بحرانی', color: 'danger' },
};

const statusLabels = {
  RESOLVED: { label: 'برطرف شده', color: 'success' },
  ACKNOWLEDGED: { label: 'در حال رسیدگی', color: 'warning' },
  OPEN: { label: 'باز', color: 'danger' },
};

const GuardEmergencyPage = () => {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['emergencies'],
    queryFn: () => emergencyApi.getEmergencies().then((res) => res.data),
  });

  const emergencies = data || [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-2xl bg-danger-50 dark:bg-danger-950/40 text-danger">
          <Flame className="h-7 w-7" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-danger">اعلام حریق و شرایط اضطراری</h1>
          <p className="text-sm text-foreground-500 mt-0.5">پایش آنلاین هشدارها و فوریت‌های ثبت شده در شهرک</p>
        </div>
      </div>

      <Alert color="danger" title="هشدار مهم نگهبانی" startContent={<AlertTriangle className="h-5 w-5" />}>
        در صورت مشاهده هرگونه هشدار جدید، بلافاصله اقدامات اولیه را طبق پروتکل انجام داده و با مرکز مدیریت تماس بگیرید.
      </Alert>

      {isLoading && (
        <div className="flex min-h-[220px] items-center justify-center">
          <Spinner size="lg" />
        </div>
      )}

      {isError && (
        <Alert color="danger" title="خطا">
          {getErrorMessage(error, 'دریافت هشدارها ناموفق بود.')}
        </Alert>
      )}

      {!isLoading && !isError && emergencies.length === 0 && (
        <Card className="p-8 text-center border border-default-200 rounded-2xl">
          <ShieldAlert className="h-10 w-10 text-success mx-auto mb-2" />
          <h3 className="text-lg font-bold text-foreground">وضعیت عادی است</h3>
          <p className="mt-1 text-sm text-foreground-500">هیچ هشدار اضطراری فعالی وجود ندارد.</p>
        </Card>
      )}

      {!isLoading && !isError && emergencies.length > 0 && (
        <div className="flex flex-col gap-3">
          {emergencies.map((alarm) => {
            const sevMeta = severityLabels[alarm.severity] || { label: alarm.severity, color: 'default' };
            const statMeta = statusLabels[alarm.status] || { label: alarm.status, color: 'default' };
            return (
              <Card key={alarm.id} className="border border-danger-200 dark:border-danger-900/40 shadow-sm rounded-2xl overflow-hidden">
                <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-bold text-danger">{alarm.title}</h3>
                      <Chip size="sm" color={sevMeta.color} variant="soft" className="font-semibold">
                        شدت: {sevMeta.label}
                      </Chip>
                      <Chip size="sm" color={statMeta.color} variant="soft" className="font-semibold">
                        {statMeta.label}
                      </Chip>
                    </div>
                    <span className="text-xs text-foreground-500 mt-1">
                      زمان اعلام: {new Date(alarm.createdAt).toLocaleString('fa-IR')}
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default GuardEmergencyPage;

