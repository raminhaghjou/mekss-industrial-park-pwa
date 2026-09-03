import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, Table, TableContent, TableHeader, TableColumn, TableBody, TableRow, TableCell, Button, Chip, Skeleton, Alert, AlertContent, AlertTitle, AlertDescription } from '@heroui/react';
import { Plus, FileText } from 'lucide-react';
import { requestApi } from '../../services/api/request.api';
import { getErrorMessage } from '../../utils/apiError';
import { requestStatusLabels as statusLabels, requestTypeLabels as typeLabels } from '../../constants/persianLabels';
import { EmptyState } from '../../components/common/EmptyState';
import { ResponsiveTable } from '../../components/common/ResponsiveTable';

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
      <div className="page-toolbar">
        <h1 className="text-xl font-bold text-foreground sm:text-2xl">درخواست‌های من</h1>
        <Button variant="primary" onPress={() => navigate('/requests/new/general')} className="flex w-full items-center justify-center gap-2 sm:w-auto">
          <Plus className="h-4 w-4" />
          ثبت درخواست جدید
        </Button>
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
              title="هنوز درخواستی ثبت نکرده‌اید"
              description="با دکمه «ثبت درخواست جدید» می‌توانید اولین درخواست خود را ارسال کنید."
            />
          ) : (
            <ResponsiveTable>
            <Table>
              <TableContent aria-label="درخواست‌ها">
              <TableHeader>
                <TableColumn isRowHeader>نوع</TableColumn>
                <TableColumn>موضوع</TableColumn>
                <TableColumn>تاریخ</TableColumn>
                <TableColumn>وضعیت</TableColumn>
              </TableHeader>
              <TableBody>
                {requests.map((req) => (
                  <TableRow key={req.id} id={req.id}>
                    <TableCell>{typeLabels[req.type] || req.type}</TableCell>
                    <TableCell>{req.title}</TableCell>
                    <TableCell>{new Date(req.createdAt).toLocaleDateString('fa-IR')}</TableCell>
                    <TableCell>
                      <Chip color={statusColors[req.status] || 'default'} size="sm" variant="soft">
                        {statusLabels[req.status] || req.status}
                      </Chip>
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
