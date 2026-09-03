import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, Table, TableContent, TableHeader, TableColumn, TableBody, TableRow, TableCell, Chip, Skeleton, Alert, AlertContent, AlertTitle, AlertDescription } from '@heroui/react';
import { Ticket } from 'lucide-react';
import { gatePassApi } from '../../services/api/gatePass.api';
import { getErrorMessage } from '../../utils/apiError';
import { gatePassStatusLabels as statusLabels } from '../../constants/persianLabels';
import { EmptyState } from '../../components/common/EmptyState';

const statusColors = { PENDING: 'warning', APPROVED: 'success', REJECTED: 'danger', USED: 'accent', CANCELLED: 'default' };

export const GatePassesPage = () => {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['gate-passes'],
    queryFn: () => gatePassApi.getGatePasses().then((res) => res.data),
  });

  const passes = data || [];

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <h1 className="text-2xl font-bold text-foreground">برگ‌های خروج</h1>

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
                <AlertDescription>{getErrorMessage(error, 'دریافت برگ‌های خروج ناموفق بود.')}</AlertDescription>
              </AlertContent>
            </Alert>
          ) : passes.length === 0 ? (
            <EmptyState
              icon={<Ticket className="h-6 w-6" />}
              title="هیچ برگ خروجی ثبت نشده است"
              description="برگ‌های خروج صادر شده برای واحد صنعتی شما در اینجا نمایش داده می‌شوند."
            />
          ) : (
            <Table>
              <TableContent aria-label="برگ‌های خروج">
              <TableHeader>
                <TableColumn isRowHeader>نام راننده</TableColumn>
                <TableColumn>شماره پلاک</TableColumn>
                <TableColumn>تاریخ خروج</TableColumn>
                <TableColumn>وضعیت</TableColumn>
              </TableHeader>
              <TableBody>
                {passes.map((pass) => (
                  <TableRow key={pass.id} id={pass.id}>
                    <TableCell>{pass.driverName}</TableCell>
                    <TableCell dir="ltr">{pass.licensePlate}</TableCell>
                    <TableCell>{new Date(pass.exitDate).toLocaleDateString('fa-IR')}</TableCell>
                    <TableCell>
                      <Chip color={statusColors[pass.status] || 'default'} size="sm" variant="soft">
                        {statusLabels[pass.status] || pass.status}
                      </Chip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              </TableContent>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default GatePassesPage;
