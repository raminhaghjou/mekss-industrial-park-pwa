import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  CardContent,
  Table, TableContent,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Button,
  Input,
  Spinner,
  Alert,
  AlertContent,
  AlertTitle,
  AlertDescription,
  Label,
  Chip,
} from '@heroui/react';
import { Search, ShieldCheck, Eye } from 'lucide-react';
import { gatePassApi } from '../../services/api/gatePass.api';
import { getErrorMessage } from '../../utils/apiError';
import { ResponsiveTable } from '../../components/common/ResponsiveTable';
import { EmptyState } from '../../components/common/EmptyState';
import { semanticFilter } from '../../utils/semanticSearch';
import { displayIranLicensePlate } from '../../utils/iranLicensePlate';
import { gatePassStatusLabels as statusLabels } from '../../constants/persianLabels';

const statusColors = {
  PENDING: 'warning',
  APPROVED: 'accent',
  REJECTED: 'danger',
  COMPLETED: 'success',
  EXPIRED: 'default',
};

const GuardGatePassesPage = () => {
  const navigate = useNavigate();
  const [search, setSearch] = React.useState('');
  const [tab, setTab] = React.useState('pending');

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['gate-passes', 'guard'],
    queryFn: () => gatePassApi.getGatePasses().then((res) => res.data),
  });

  const filteredPasses = React.useMemo(() => {
    const list = data || [];
    const byTab = list.filter((pass) => (
      tab === 'pending'
        ? pass.status === 'PENDING' || pass.status === 'APPROVED'
        : pass.status === 'COMPLETED' || pass.status === 'REJECTED' || pass.status === 'EXPIRED'
    ));
    return semanticFilter(byTab, search, (pass) => [
      pass.licensePlate,
      displayIranLicensePlate(pass.licensePlate),
      pass.id,
      pass.driverName,
      pass.factory?.name,
      pass.cargoType,
      statusLabels[pass.status],
      'مجوز',
      'پلاک',
    ]);
  }, [data, search, tab]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">تایید برگ‌های خروج</h1>
        <p className="text-sm text-foreground-500 mt-1">فقط نگهبان می‌تواند خروج را تایید یا رد کند</p>
      </div>

      <Card className="border border-default-200 shadow-sm rounded-2xl dark:border-white/10">
        <CardContent className="p-4">
          <div className="flex flex-col gap-1">
            <Label className="text-xs font-medium text-foreground-600">جست‌وجوی برگ خروج</Label>
            <div className="relative flex items-center">
              <Search className="absolute right-3 h-4 w-4 text-default-400 pointer-events-none" />
              <Input
                placeholder="بر اساس شماره پلاک، راننده یا شناسه برگ خروج..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                variant="primary"
                className="pr-9 rounded-xl"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border border-default-200 shadow-sm rounded-2xl dark:border-white/10 overflow-hidden">
        <div className="flex gap-2 border-b border-default-200 p-2">
          <button
            type="button"
            onClick={() => setTab('pending')}
            className={`px-4 py-2 text-sm font-medium rounded-xl transition-colors ${tab === 'pending' ? 'bg-primary text-white font-bold' : 'text-foreground-500 hover:bg-default-100'}`}
          >
            در انتظار تایید
          </button>
          <button
            type="button"
            onClick={() => setTab('history')}
            className={`px-4 py-2 text-sm font-medium rounded-xl transition-colors ${tab === 'history' ? 'bg-primary text-white font-bold' : 'text-foreground-500 hover:bg-default-100'}`}
          >
            تاریخچه تایید / رد
          </button>
        </div>

        {isLoading && (
          <div className="flex min-h-[220px] items-center justify-center">
            <Spinner size="lg" />
          </div>
        )}

        {isError && (
          <Alert status="danger">
            <AlertContent>
              <AlertTitle>خطا</AlertTitle>
              <AlertDescription>{getErrorMessage(error, 'دریافت برگ‌های خروج ناموفق بود.')}</AlertDescription>
            </AlertContent>
          </Alert>
        )}

        {!isLoading && !isError && filteredPasses.length === 0 && (
          <EmptyState
            icon={<ShieldCheck className="h-6 w-6" />}
            title={tab === 'pending' ? 'برگ خروجی در انتظار تایید نیست' : 'تاریخچه‌ای برای نمایش وجود ندارد'}
            description={tab === 'pending'
              ? 'به محض ثبت برگ خروج توسط واحد صنعتی، اینجا نمایش داده می‌شود.'
              : 'برگ‌های تایید یا رد شده در این بخش ظاهر می‌شوند.'}
          />
        )}

        {!isLoading && !isError && filteredPasses.length > 0 && (
          <ResponsiveTable>
            <Table>
              <TableContent aria-label="جدول برگ خروج نگهبانی">
                <TableHeader>
                  <TableColumn className="text-right font-bold" isRowHeader>واحد صنعتی</TableColumn>
                  <TableColumn className="text-right font-bold">نام راننده</TableColumn>
                  <TableColumn className="text-right font-bold">شماره پلاک</TableColumn>
                  {tab === 'history' && <TableColumn className="text-right font-bold">تاریخ / ساعت</TableColumn>}
                  {tab === 'history' && <TableColumn className="text-right font-bold">وضعیت</TableColumn>}
                  <TableColumn className="text-center font-bold">عملیات</TableColumn>
                </TableHeader>
                <TableBody>
                  {filteredPasses.map((pass) => {
                    const decisionAt = pass.verifiedAt || pass.updatedAt || pass.exitDate;
                    return (
                      <TableRow key={pass.id} id={pass.id}>
                        <TableCell className="font-bold text-foreground">{pass.factory?.name || '—'}</TableCell>
                        <TableCell>{pass.driverName}</TableCell>
                        <TableCell className="font-mono text-sm" dir="ltr">
                          {displayIranLicensePlate(pass.licensePlate)}
                        </TableCell>
                        {tab === 'history' && (
                          <TableCell className="text-sm whitespace-nowrap">
                            {decisionAt ? new Date(decisionAt).toLocaleString('fa-IR') : '—'}
                          </TableCell>
                        )}
                        {tab === 'history' && (
                          <TableCell>
                            <Chip color={statusColors[pass.status] || 'default'} size="sm" variant="soft">
                              {statusLabels[pass.status] || pass.status}
                            </Chip>
                          </TableCell>
                        )}
                        <TableCell className="text-center">
                          <Button
                            size="sm"
                            variant={tab === 'pending' ? 'secondary' : 'tertiary'}
                            onPress={() => navigate(`/guard/gate-passes/${pass.id}/verify`)}
                            className="rounded-xl font-bold flex items-center gap-2"
                          >
                            {tab === 'pending' ? <ShieldCheck className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            {tab === 'pending' ? 'بررسی و تایید خروج' : 'جزئیات'}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </TableContent>
            </Table>
          </ResponsiveTable>
        )}
      </Card>
    </div>
  );
};

export default GuardGatePassesPage;
