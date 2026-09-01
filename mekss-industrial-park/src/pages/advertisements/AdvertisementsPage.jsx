import { useQuery } from '@tanstack/react-query';
import { Card, CardBody, CardHeader, Button, Skeleton, Alert, Chip } from '@heroui/react';
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
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">آگهی‌ها</h1>
        <Button color="primary" startContent={<Plus className="h-4 w-4" />} onClick={() => navigate('/advertisements/new')}>
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
        <Alert color="danger" title="خطا در دریافت اطلاعات">
          {getErrorMessage(error, 'دریافت آگهی‌ها ناموفق بود.')}
        </Alert>
      ) : advertisements.length === 0 ? (
        <Card>
          <CardBody>
            <EmptyState
              icon={<Megaphone className="h-6 w-6" />}
              title="هیچ آگهی‌ای وجود ندارد"
              description="آگهی‌های شما پس از تایید مدیریت در اینجا نمایش داده می‌شوند."
            />
          </CardBody>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {advertisements.map((ad) => (
            <Card key={ad.id}>
              <CardHeader className="flex items-center justify-between p-4">
                <h3 className="font-semibold text-foreground">{ad.title}</h3>
                <Chip color={statusColors[ad.status] || 'default'} size="sm" variant="flat">
                  {statusLabels[ad.status] || ad.status}
                </Chip>
              </CardHeader>
              <CardBody className="p-4 pt-0">
                <p className="line-clamp-3 text-sm text-foreground-600">{ad.description}</p>
                <p className="mt-2 text-xs text-foreground-400">
                  انقضا: {new Date(ad.expiresAt).toLocaleDateString('fa-IR')}
                </p>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdvertisementsPage;
