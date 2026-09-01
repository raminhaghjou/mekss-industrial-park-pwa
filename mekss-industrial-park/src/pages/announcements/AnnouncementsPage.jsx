import { useQuery } from '@tanstack/react-query';
import { Card, CardBody, CardHeader, Divider, Skeleton, Alert, Chip } from '@heroui/react';
import { Bell } from 'lucide-react';
import { announcementApi } from '../../services/api/announcement.api';
import { getErrorMessage } from '../../utils/apiError';
import { EmptyState } from '../../components/common/EmptyState';

export const AnnouncementsPage = () => {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['announcements'],
    queryFn: () => announcementApi.getAnnouncements().then((res) => res.data),
  });

  const announcements = data || [];

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <h1 className="text-2xl font-bold text-foreground">اطلاعیه‌ها</h1>

      {isLoading ? (
        <div className="flex flex-col gap-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      ) : isError ? (
        <Alert color="danger" title="خطا در دریافت اطلاعات">
          {getErrorMessage(error, 'دریافت اطلاعیه‌ها ناموفق بود.')}
        </Alert>
      ) : announcements.length === 0 ? (
        <Card>
          <CardBody>
            <EmptyState
              icon={<Bell className="h-6 w-6" />}
              title="هیچ اطلاعیه‌ای وجود ندارد"
              description="اطلاعیه‌های مدیریت شهرک در اینجا نمایش داده می‌شوند."
            />
          </CardBody>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {announcements.map((ann) => (
            <Card key={ann.id}>
              <CardHeader className="flex items-center justify-between p-4">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-foreground">{ann.title}</h3>
                  {ann.isPinned && <Chip color="primary" size="sm">سنجاق شده</Chip>}
                  {ann.isGlobal && <Chip color="secondary" size="sm">همگانی</Chip>}
                </div>
                <span className="text-sm text-foreground-500">
                  {new Date(ann.createdAt).toLocaleDateString('fa-IR')}
                </span>
              </CardHeader>
              <Divider />
              <CardBody className="p-4">
                <p className="whitespace-pre-wrap text-foreground-600">{ann.content}</p>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default AnnouncementsPage;
