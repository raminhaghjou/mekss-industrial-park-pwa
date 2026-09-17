import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, Button, Skeleton, Alert, AlertContent, AlertTitle, AlertDescription, Chip } from '@heroui/react';
import { Plus, Megaphone, Pencil, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { advertisementApi } from '../../services/api/advertisement.api';
import { getErrorMessage } from '../../utils/apiError';
import { advertisementStatusLabels as statusLabels } from '../../constants/persianLabels';
import { EmptyState } from '../../components/common/EmptyState';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { useNotification } from '../../providers/NotificationProvider';

const statusColors = { PENDING: 'warning', APPROVED: 'success', REJECTED: 'danger', EXPIRED: 'default' };

const contactPhone = (contactInfo) => {
  if (!contactInfo || typeof contactInfo !== 'object') return null;
  return contactInfo.phone || contactInfo.phoneNumber || null;
};

export const AdvertisementsPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showNotification } = useNotification();
  const [deleteId, setDeleteId] = useState(null);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['advertisements', 'mine'],
    queryFn: () => advertisementApi.getMyAdvertisements().then((res) => res.data),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => advertisementApi.deleteMyAdvertisement(id),
    onSuccess: async () => {
      setDeleteId(null);
      showNotification('آگهی حذف شد.', 'success');
      await queryClient.invalidateQueries({ queryKey: ['advertisements', 'mine'] });
    },
    onError: (err) => showNotification(getErrorMessage(err, 'حذف آگهی ناموفق بود.'), 'error'),
  });

  const advertisements = data || [];

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div className="page-toolbar">
        <div>
          <h1 className="text-xl font-bold text-foreground sm:text-2xl">آگهی‌های من</h1>
          <p className="mt-1 text-sm text-foreground-500">
            تا قبل از تایید مدیریت می‌توانید آگهی را ویرایش یا حذف کنید.
          </p>
        </div>
        <Button variant="primary" onPress={() => navigate('/advertisements/new')} className="flex w-full items-center justify-center gap-2 sm:w-auto">
          <Plus className="h-4 w-4" />
          ثبت آگهی جدید
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-xl" />
          ))}
        </div>
      ) : isError ? (
        <Alert status="danger">
          <AlertContent>
            <AlertTitle>خطا در دریافت اطلاعات</AlertTitle>
            <AlertDescription>{getErrorMessage(error, 'دریافت آگهی‌ها ناموفق بود.')}</AlertDescription>
            <Button size="sm" variant="secondary" className="mt-2 rounded-xl" onPress={() => refetch()} isDisabled={isFetching}>
              تلاش دوباره
            </Button>
          </AlertContent>
        </Alert>
      ) : advertisements.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState
              icon={<Megaphone className="h-6 w-6" />}
              title="هنوز آگهی ثبت نکرده‌اید"
              description="آگهی جدید ثبت کنید؛ تا تایید مدیریت اینجا قابل ویرایش و حذف است."
              action={(
                <Button variant="primary" onPress={() => navigate('/advertisements/new')} className="rounded-xl font-medium">
                  ثبت آگهی جدید
                </Button>
              )}
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {advertisements.map((ad) => {
            const pending = ad.status === 'PENDING';
            const phone = contactPhone(ad.contactInfo);
            return (
              <Card key={ad.id} className="border border-default-200 dark:border-white/10">
                <CardHeader className="flex items-start justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <h3 className="font-semibold text-foreground">{ad.title}</h3>
                    <p className="mt-1 text-xs text-foreground-400">
                      {[ad.province, ad.city].filter(Boolean).join(' / ')}
                      {ad.category?.label ? ` · ${ad.category.label}` : ''}
                    </p>
                  </div>
                  <Chip color={statusColors[ad.status] || 'default'} size="sm" variant="soft">
                    {statusLabels[ad.status] || ad.status}
                  </Chip>
                </CardHeader>
                <CardContent className="flex flex-col gap-3 p-4 pt-0">
                  <p className="line-clamp-3 text-sm text-foreground-600">{ad.content || ad.description}</p>
                  {phone && <p className="text-xs text-foreground-400" dir="ltr">{phone}</p>}
                  {ad.rejectionReason && (
                    <p className="rounded-xl bg-danger-50 px-3 py-2 text-xs text-danger-700 dark:bg-danger-950/40">
                      دلیل رد: {ad.rejectionReason}
                    </p>
                  )}
                  {pending && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      <Button
                        size="sm"
                        variant="secondary"
                        className="rounded-xl font-medium gap-1.5"
                        onPress={() => navigate(`/advertisements/${ad.id}/edit`)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        ویرایش
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        className="rounded-xl font-medium gap-1.5"
                        onPress={() => setDeleteId(ad.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        حذف
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteId)}
        title="حذف آگهی"
        description="این آگهی برای همیشه حذف می‌شود. ادامه می‌دهید؟"
        confirmLabel="حذف"
        confirmColor="danger"
        loading={deleteMutation.isPending}
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        onClose={() => !deleteMutation.isPending && setDeleteId(null)}
      />
    </div>
  );
};

export default AdvertisementsPage;
