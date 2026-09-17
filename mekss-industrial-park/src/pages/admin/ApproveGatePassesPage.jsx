import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, Table, TableContent, TableHeader, TableColumn, TableBody, TableRow, TableCell, Chip, Skeleton, Alert, AlertContent, AlertTitle, AlertDescription } from '@heroui/react';
import { Ticket } from 'lucide-react';
import { gatePassApi } from '../../services/api/gatePass.api';
import { getErrorMessage } from '../../utils/apiError';
import { EmptyState } from '../../components/common/EmptyState';
import { ResponsiveTable } from '../../components/common/ResponsiveTable';
import { gatePassStatusLabels as statusLabels } from '../../constants/persianLabels';

const statusColors = {
  PENDING: 'warning',
  APPROVED: 'accent',
  REJECTED: 'danger',
  COMPLETED: 'success',
  EXPIRED: 'default',
};

/** Park manager view-only list — no approve/reject actions. */
export const ApproveGatePassesPage = () => {
  const [tab, setTab] = useState('pending');

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['gate-passes', 'managed'],
    queryFn: () => gatePassApi.getGatePasses().then((res) => res.data),
  });

  const passes = data || [];
  const filteredPasses = passes.filter((p) => (tab === 'pending' ? p.status === 'PENDING' || p.status === 'APPROVED' : p.status === 'COMPLETED' || p.status === 'REJECTED' || p.status === 'EXPIRED'));

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">برگ‌های خروج</h1>
        <p className="text-sm text-foreground-500 mt-1">مشاهده وضعیت برگ‌های خروج واحدهای صنعتی — تایید فقط توسط نگهبان انجام می‌شود.</p>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="flex gap-2 border-b border-default-200 p-2">
            <button
              onClick={() => setTab('pending')}
              className={`px-4 py-2 text-sm font-medium rounded-xl transition-colors ${tab === 'pending' ? 'bg-primary text-white font-bold' : 'text-foreground-500 hover:bg-default-100'}`}
            >
              در انتظار نگهبان
            </button>
            <button
              onClick={() => setTab('history')}
              className={`px-4 py-2 text-sm font-medium rounded-xl transition-colors ${tab === 'history' ? 'bg-primary text-white font-bold' : 'text-foreground-500 hover:bg-default-100'}`}
            >
              تاریخچه
            </button>
          </div>

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
          ) : filteredPasses.length === 0 ? (
            <EmptyState
              icon={<Ticket className="h-6 w-6" />}
              title={tab === 'pending' ? 'برگ خروجی در انتظار تایید نگهبان نیست' : 'تاریخچه‌ای برای نمایش وجود ندارد'}
              description={tab === 'pending' ? 'به محض ثبت برگ خروج توسط واحد صنعتی، اینجا نمایش داده می‌شود.' : undefined}
            />
          ) : (
            <ResponsiveTable>
              <Table>
                <TableContent aria-label="برگ‌های خروج">
                  <TableHeader>
                    <TableColumn isRowHeader>واحد صنعتی</TableColumn>
                    <TableColumn>نام راننده</TableColumn>
                    <TableColumn>شماره پلاک</TableColumn>
                    <TableColumn>تاریخ خروج</TableColumn>
                    <TableColumn>وضعیت</TableColumn>
                  </TableHeader>
                  <TableBody>
                    {filteredPasses.map((pass) => (
                      <TableRow key={pass.id} id={pass.id}>
                        <TableCell>{pass.factory?.name || '—'}</TableCell>
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
            </ResponsiveTable>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ApproveGatePassesPage;
