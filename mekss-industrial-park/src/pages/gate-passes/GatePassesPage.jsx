import { useQuery } from '@tanstack/react-query';
import { Card, CardBody, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, Chip, Skeleton, Alert } from '@heroui/react';
import { Ticket } from 'lucide-react';
import { gatePassApi } from '../../services/api/gatePass.api';
import { getErrorMessage } from '../../utils/apiError';
import { gatePassStatusLabels as statusLabels } from '../../constants/persianLabels';
import { EmptyState } from '../../components/common/EmptyState';

const statusColors = { PENDING: 'warning', APPROVED: 'success', REJECTED: 'danger', USED: 'primary', CANCELLED: 'default' };

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
        <CardBody className="p-0">
          {isLoading ? (
            <div className="flex flex-col gap-2 p-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 rounded-lg" />
              ))}
            </div>
          ) : isError ? (
            <Alert color="danger" title="خطا در دریافت اطلاعات">
              {getErrorMessage(error, 'دریافت برگ‌های خروج ناموفق بود.')}
            </Alert>
          ) : passes.length === 0 ? (
            <EmptyState
              icon={<Ticket className="h-6 w-6" />}
              title="هیچ برگ خروجی ثبت نشده است"
              description="برگ‌های خروج صادر شده برای واحد صنعتی شما در اینجا نمایش داده می‌شوند."
            />
          ) : (
            <Table removeWrapper aria-label="برگ‌های خروج">
              <TableHeader>
                <TableColumn>نام راننده</TableColumn>
                <TableColumn>شماره پلاک</TableColumn>
                <TableColumn>تاریخ خروج</TableColumn>
                <TableColumn>وضعیت</TableColumn>
              </TableHeader>
              <TableBody>
                {passes.map((pass) => (
                  <TableRow key={pass.id}>
                    <TableCell>{pass.driverName}</TableCell>
                    <TableCell dir="ltr">{pass.licensePlate}</TableCell>
                    <TableCell>{new Date(pass.exitDate).toLocaleDateString('fa-IR')}</TableCell>
                    <TableCell>
                      <Chip color={statusColors[pass.status] || 'default'} size="sm" variant="flat">
                        {statusLabels[pass.status] || pass.status}
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

export default GatePassesPage;
