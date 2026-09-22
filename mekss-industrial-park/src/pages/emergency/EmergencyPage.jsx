import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  CardHeader,
  Button,
  Input,
  TextArea,
  Skeleton,
  Alert,
  AlertContent,
  AlertTitle,
  AlertDescription,
  Spinner,
  Select,
  SelectTrigger,
  SelectValue,
  SelectIndicator,
  SelectPopover,
  ListBox,
  ListBoxItem,
  Chip,
} from '@heroui/react';
import { AlertTriangle, CheckCircle, ShieldAlert, Siren } from 'lucide-react';
import { emergencyApi } from '../../services/api/emergency.api';
import { factoryApi } from '../../services/api/factory.api';
import { parkApi } from '../../services/api/park.api';
import { useAuth } from '../../providers/AuthProvider';
import { useNotification } from '../../providers/NotificationProvider';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { getErrorMessage } from '../../utils/apiError';
import { queryKeys } from '../../services/queryKeys';

const severityOptions = [
  { id: 'CRITICAL', label: 'بحرانی' },
  { id: 'HIGH', label: 'بالا' },
  { id: 'MEDIUM', label: 'متوسط' },
  { id: 'LOW', label: 'کم' },
];

const severityChip = {
  CRITICAL: 'danger',
  HIGH: 'danger',
  MEDIUM: 'warning',
  LOW: 'default',
};

const statusLabel = {
  OPEN: 'باز',
  ACKNOWLEDGED: 'دریافت‌شده',
  RESOLVED: 'رفع‌شده',
};

const emptyForm = { title: '', description: '', severity: 'HIGH', parkId: '' };
const firePreset = {
  title: 'اعلام آتش‌سوزی',
  description: 'آتش‌سوزی گزارش شده — نیروی امداد و نگهبانی شهرک را مطلع کنید.',
  severity: 'CRITICAL',
};

export const EmergencyPage = () => {
  const location = useLocation();
  const { user } = useAuth();
  const { showNotification } = useNotification();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyForm);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [fireSecondConfirmOpen, setFireSecondConfirmOpen] = useState(false);
  const [isFireAlert, setIsFireAlert] = useState(false);
  const [geoLocation, setGeoLocation] = useState(null);

  const canCreate = ['SUPER_ADMIN', 'PARK_MANAGER', 'FACTORY_OWNER', 'SECURITY_GUARD'].includes(user?.role);

  useEffect(() => {
    if (location.state?.quickFire && canCreate) {
      setForm((prev) => ({ ...prev, ...firePreset }));
      setIsFireAlert(true);
    }
  }, [location.state?.quickFire, canCreate]);
  const canResolve = ['SUPER_ADMIN', 'PARK_MANAGER'].includes(user?.role);
  const canAcknowledge = ['SUPER_ADMIN', 'PARK_MANAGER', 'SECURITY_GUARD'].includes(user?.role);
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  const { data: alerts, isLoading, isError, error } = useQuery({
    queryKey: ['emergency-alerts'],
    queryFn: () => emergencyApi.getEmergencies().then((res) => res.data),
  });

  const { data: parksData } = useQuery({
    queryKey: isSuperAdmin ? queryKeys.parks.all() : queryKeys.factories.managementScope(),
    queryFn: () => (
      isSuperAdmin
        ? parkApi.getParks().then((res) => res.data)
        : factoryApi.getManagementScope().then((res) => res.data?.parks || [])
    ),
    enabled: canCreate && (isSuperAdmin || user?.role === 'PARK_MANAGER'),
  });
  const parks = Array.isArray(parksData) ? parksData : parksData?.items || [];

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['emergency-alerts'] });
    queryClient.invalidateQueries({ queryKey: ['emergency', 'active'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };

  const createMutation = useMutation({
    mutationFn: (payload) => emergencyApi.createEmergency(payload),
    onSuccess: () => {
      showNotification('هشدار اضطراری برای همه افراد شهرک ارسال شد', 'success');
      setForm(emptyForm);
      setConfirmOpen(false);
      invalidate();
    },
    onError: (err) => showNotification(getErrorMessage(err, 'ارسال هشدار ناموفق بود'), 'error'),
  });

  const acknowledgeMutation = useMutation({
    mutationFn: (id) => emergencyApi.acknowledgeEmergency(id),
    onSuccess: () => {
      showNotification('دریافت هشدار ثبت شد', 'success');
      invalidate();
    },
    onError: (err) => showNotification(getErrorMessage(err, 'ثبت دریافت ناموفق بود'), 'error'),
  });

  const resolveMutation = useMutation({
    mutationFn: (id) => emergencyApi.resolveEmergency(id),
    onSuccess: () => {
      showNotification('وضعیت اضطراری رفع شد و به همه اطلاع داده شد', 'success');
      invalidate();
    },
    onError: (err) => showNotification(getErrorMessage(err, 'رفع هشدار ناموفق بود'), 'error'),
  });

  const activeAlerts = useMemo(
    () => (alerts || []).filter((item) => item.status !== 'RESOLVED'),
    [alerts],
  );

  const captureLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setGeoLocation({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      }),
      () => showNotification('دریافت موقعیت مکانی ممکن نشد', 'warning'),
      { enableHighAccuracy: true, timeout: 12000 },
    );
  };

  const openConfirm = () => {
    if (!form.title.trim() || !form.description.trim()) {
      showNotification('عنوان و توضیحات هشدار الزامی است', 'error');
      return;
    }
    if (isSuperAdmin && !form.parkId) {
      showNotification('انتخاب شهرک صنعتی الزامی است', 'error');
      return;
    }
    captureLocation();
    setConfirmOpen(true);
  };

  const submitEmergency = () => {
    createMutation.mutate({
      title: form.title.trim(),
      description: form.description.trim(),
      severity: form.severity,
      parkId: form.parkId || undefined,
      location: geoLocation || undefined,
    });
    setFireSecondConfirmOpen(false);
    setIsFireAlert(false);
  };

  const handleFirstConfirm = () => {
    setConfirmOpen(false);
    if (isFireAlert || form.severity === 'CRITICAL') {
      setFireSecondConfirmOpen(true);
      return;
    }
    submitEmergency();
  };

  const startFireAlert = () => {
    setForm((prev) => ({ ...prev, ...firePreset }));
    setIsFireAlert(true);
    captureLocation();
    setConfirmOpen(true);
  };

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-danger-100 text-danger-700">
          <Siren className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">هشدارهای اضطراری</h1>
          <p className="text-sm text-foreground-500">
            صدور هشدار باعث آژیر، نوتیفیکیشن و پیامک برای همه افراد همان شهرک می‌شود.
          </p>
        </div>
      </div>

      {canCreate && (
        <Card className="border border-danger-200 bg-danger-50/80 shadow-sm dark:border-danger-900 dark:bg-danger-950/40">
          <CardHeader className="p-4 pb-0">
            <div className="flex items-center gap-2 text-danger-700 dark:text-danger-300">
              <AlertTriangle className="h-5 w-5" />
              <h2 className="font-semibold">ثبت هشدار جدید</h2>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 p-4">
            <div className="flex flex-col gap-1">
              <label htmlFor="emergency-title" className="text-xs font-medium text-foreground-600">عنوان رویداد</label>
              <Input
                id="emergency-title"
                placeholder="مثال: آتش‌سوزی در سوله ۱۲"
                value={form.title}
                onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                className="rounded-xl"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="emergency-description" className="text-xs font-medium text-foreground-600">توضیحات و دستورالعمل</label>
              <TextArea
                id="emergency-description"
                placeholder="محل دقیق، نوع حادثه و اقدام فوری مورد نیاز را بنویسید..."
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                rows={4}
                className="rounded-xl"
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-foreground-600">شدت</label>
                <Select
                  value={form.severity}
                  onChange={(value) => setForm((prev) => ({ ...prev, severity: String(value || 'HIGH') }))}
                  className="rounded-xl"
                >
                  <SelectTrigger>
                    <SelectValue />
                    <SelectIndicator />
                  </SelectTrigger>
                  <SelectPopover>
                    <ListBox>
                      {severityOptions.map((option) => (
                        <ListBoxItem key={option.id} id={option.id}>{option.label}</ListBoxItem>
                      ))}
                    </ListBox>
                  </SelectPopover>
                </Select>
              </div>
              {(isSuperAdmin || parks.length > 1) && (
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-foreground-600">شهرک صنعتی</label>
                  <Select
                    value={form.parkId}
                    onChange={(value) => setForm((prev) => ({ ...prev, parkId: String(value || '') }))}
                    placeholder="انتخاب شهرک..."
                    className="rounded-xl"
                  >
                    <SelectTrigger>
                      <SelectValue />
                      <SelectIndicator />
                    </SelectTrigger>
                    <SelectPopover>
                      <ListBox>
                        {parks.map((park) => (
                          <ListBoxItem key={park.id} id={park.id}>{park.name}</ListBoxItem>
                        ))}
                      </ListBox>
                    </SelectPopover>
                  </Select>
                </div>
              )}
            </div>
            <Alert status="danger">
              <AlertContent>
                <AlertTitle>توجه</AlertTitle>
                <AlertDescription>
                  با ارسال هشدار، آژیر صوتی و نوتیفیکیشن برای مدیران شهرک، مدیران واحد، پرسنل و نگهبانان همان شهرک فعال می‌شود.
                </AlertDescription>
              </AlertContent>
            </Alert>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="danger"
                className="flex items-center gap-2 rounded-xl font-bold"
                onPress={startFireAlert}
                isDisabled={createMutation.isPending}
              >
                <Siren className="h-4 w-4" />
                اعلام آتش‌سوزی (دو مرحله‌ای)
              </Button>
              <Button
                variant="secondary"
                className="flex items-center gap-2 rounded-xl font-bold"
                onPress={openConfirm}
                isDisabled={createMutation.isPending}
              >
                <ShieldAlert className="h-4 w-4" />
                ارسال هشدار اضطراری
              </Button>
            </div>
            {geoLocation && (
              <p className="text-xs text-foreground-500" dir="ltr">
                موقعیت ثبت‌شده: {geoLocation.latitude.toFixed(5)}, {geoLocation.longitude.toFixed(5)}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="border border-default-200 shadow-sm rounded-2xl dark:border-white/10">
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
          ) : activeAlerts.length === 0 ? (
            <div className="p-8 text-center text-foreground-500">
              <CheckCircle className="mx-auto h-12 w-12 text-success-500" />
              <p className="mt-2">هیچ هشدار فعالی وجود ندارد</p>
            </div>
          ) : (
            <div className="divide-y divide-default-200 dark:divide-white/5">
              {activeAlerts.map((alert) => (
                <div key={alert.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-bold text-foreground">{alert.title}</p>
                      <Chip size="sm" color={severityChip[alert.severity] || 'default'} variant="soft">
                        {severityOptions.find((item) => item.id === alert.severity)?.label || alert.severity}
                      </Chip>
                      <Chip size="sm" variant="soft">{statusLabel[alert.status] || alert.status}</Chip>
                    </div>
                    <p className="text-sm leading-6 text-foreground-600">{alert.description}</p>
                    <p className="text-xs text-foreground-400">
                      {alert.park?.name ? `${alert.park.name} · ` : ''}
                      {alert.createdBy?.name ? `${alert.createdBy.name} · ` : ''}
                      {new Date(alert.createdAt).toLocaleString('fa-IR')}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {canAcknowledge && alert.status === 'OPEN' && (
                      <Button
                        variant="secondary"
                        size="sm"
                        className="rounded-xl"
                        onPress={() => acknowledgeMutation.mutate(alert.id)}
                        isDisabled={acknowledgeMutation.isPending}
                      >
                        دریافت شد
                      </Button>
                    )}
                    {canResolve && (
                      <Button
                        variant="primary"
                        size="sm"
                        className="flex items-center gap-2 rounded-xl"
                        onPress={() => resolveMutation.mutate(alert.id)}
                        isDisabled={resolveMutation.isPending}
                      >
                        {resolveMutation.isPending ? <Spinner size="sm" /> : <CheckCircle className="h-4 w-4" />}
                        رفع وضعیت
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirmOpen}
        title={isFireAlert ? 'مرحله ۱ — اعلام حریق' : 'تأیید ارسال هشدار اضطراری'}
        description="این اقدام برای همه افراد شهرک آژیر، نوتیفیکیشن و پیامک (شامل نگهبانی با موقعیت و تماس مدیر) ارسال می‌کند."
        confirmLabel="ادامه"
        confirmColor="danger"
        loading={createMutation.isPending}
        onConfirm={handleFirstConfirm}
        onClose={() => setConfirmOpen(false)}
      />
      <ConfirmDialog
        open={fireSecondConfirmOpen}
        title="مرحله ۲ — تأیید نهایی حریق"
        description="آیا از صحت اعلام آتش‌سوزی/امداد مطمئن هستید؟ این پیامک شامل شماره مدیر واحد و موقعیت GPS برای نگهبانی است."
        confirmLabel="ارسال قطعی"
        confirmColor="danger"
        loading={createMutation.isPending}
        onConfirm={submitEmergency}
        onClose={() => setFireSecondConfirmOpen(false)}
      />
    </div>
  );
};

export default EmergencyPage;
