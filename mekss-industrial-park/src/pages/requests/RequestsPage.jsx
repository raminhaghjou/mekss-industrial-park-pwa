import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Card, CardBody, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, Button, Chip, Skeleton, Alert } from '@heroui/react';
import { Plus, FileText } from 'lucide-react';
import { requestApi } from '../../services/api/request.api';
import { getErrorMessage } from '../../utils/apiError';
import { requestStatusLabels as statusLabels, requestTypeLabels as typeLabels } from '../../constants/persianLabels';
import { EmptyState } from '../../components/common/EmptyState';

const statusColors = { PENDING: 'warning', APPROVED: 'success', REJECTED: 'danger', CANCELLED: 'default' };

export const RequestsPage = () => {
  const navigate = useNavigate();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['requests'],
    queryFn: () => requestApi.getRequests().then((res) => res.data),
  });

  const requests = data || [];

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">درخواست‌های من</h1>
        <Button color="primary" startContent={<Plus className="h-4 w-4" />} onClick={() => navigate('/requests/new/general')}>
          ثبت درخواست جدید
        </Button>
      </div>

      <Card>
        <CardBody className="p-0">
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
          ) : requests.length === 0 ? (
            <EmptyState
              icon={<FileText className="h-6 w-6" />}
              title="هنوز درخواستی ثبت نکرده‌اید"
              description="با دکمه «ثبت درخواست جدید» می‌توانید اولین درخواست خود را ارسال کنید."
            />
          ) : (
            <Table removeWrapper aria-label="درخواست‌ها">
              <TableHeader>
                <TableColumn>نوع</TableColumn>
                <TableColumn>موضوع</TableColumn>
                <TableColumn>تاریخ</TableColumn>
                <TableColumn>وضعیت</TableColumn>
              </TableHeader>
              <TableBody>
                {requests.map((req) => (
                  <TableRow key={req.id}>
                    <TableCell>{typeLabels[req.type] || req.type}</TableCell>
                    <TableCell>{req.title}</TableCell>
                    <TableCell>{new Date(req.createdAt).toLocaleDateString('fa-IR')}</TableCell>
                    <TableCell>
                      <Chip color={statusColors[req.status] || 'default'} size="sm" variant="flat">
                        {statusLabels[req.status] || req.status}
                      </Chip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardBody>
      </Card>
    </div>
  );
};

export default RequestsPage;
