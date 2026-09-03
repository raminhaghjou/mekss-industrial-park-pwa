import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, Button, Skeleton, Alert, AlertContent, AlertTitle, AlertDescription, Chip } from '@heroui/react';
import { Plus, Megaphone } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { advertisementApi } from '../../services/api/advertisement.api';
import { getErrorMessage } from '../../utils/apiError';
import { advertisementStatusLabels as statusLabels } from '../../constants/persianLabels';
import { EmptyState } from '../../components/common/EmptyState';

const statusColors = { PENDING: 'warning', APPROVED: 'success', REJECTED: 'danger', EXPIRED: 'default' };

export const AdvertisementsPage = () => {
  const navigate = useNavigate();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['advertisements'],
    queryFn: () => advertisementApi.getAdvertisements().then((res) => res.data),
  });

  const advertisements = data || [];

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div className="page-toolbar">
        <h1 className="text-xl font-bold text-foreground sm:text-2xl">آگهی‌ها</h1>
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
          </AlertContent>
        </Alert>
      ) : advertisements.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState
              icon={<Megaphone className="h-6 w-6" />}
              title="هیچ آگهی‌ای وجود ندارد"
              description="آگهی‌های شما پس از تایید مدیریت در اینجا نمایش داده می‌شوند."
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {advertisements.map((ad) => (
            <Card key={ad.id}>
              <CardHeader className="flex items-center justify-between p-4">
                <h3 className="font-semibold text-foreground">{ad.title}</h3>
                <Chip color={statusColors[ad.status] || 'default'} size="sm" variant="soft">
                  {statusLabels[ad.status] || ad.status}
                </Chip>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <p className="line-clamp-3 text-sm text-foreground-600">{ad.description}</p>
                <p className="mt-2 text-xs text-foreground-400">
                  انقضا: {new Date(ad.expiresAt).toLocaleDateString('fa-IR')}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdvertisementsPage;
