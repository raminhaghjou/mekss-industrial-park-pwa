import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  Table,
  TableContent,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Chip,
  Skeleton,
  Alert,
  AlertContent,
  AlertTitle,
  AlertDescription,
  Button,
  Input,
  Select,
  SelectTrigger,
  SelectValue,
  SelectIndicator,
  SelectPopover,
  ListBox,
  ListBoxItem,
  Label,
} from '@heroui/react';
import { Download, Plus, Ticket } from 'lucide-react';
import { gatePassApi } from '../../services/api/gatePass.api';
import { getErrorMessage } from '../../utils/apiError';
import { gatePassStatusLabels as statusLabels } from '../../constants/persianLabels';
import { EmptyState } from '../../components/common/EmptyState';
import { ResponsiveTable } from '../../components/common/ResponsiveTable';
import CreateGatePassForm from '../../components/gate-pass/CreateGatePassForm';

const statusColors = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
  COMPLETED: 'accent',
  EXPIRED: 'default',
};

const exportCsv = (rows) => {
  const header = ['نام راننده', 'پلاک', 'تاریخ خروج', 'وضعیت', 'نوع بار', 'واحد'];
  const lines = rows.map((pass) => [
    pass.driverName || '',
    pass.licensePlate || '',
    pass.exitDate ? new Date(pass.exitDate).toLocaleDateString('fa-IR') : '',
    statusLabels[pass.status] || pass.status || '',
    pass.cargoType || '',
    pass.factory?.name || '',
  ].map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','));
  const csv = `\uFEFF${[header.join(','), ...lines].join('\n')}`;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `gate-passes-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
};

export const GatePassesPage = () => {
  const [creating, setCreating] = useState(false);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['gate-passes'],
    queryFn: () => gatePassApi.getGatePasses().then((res) => res.data),
  });

  const passes = useMemo(() => {
    const list = Array.isArray(data) ? data : data?.items || [];
    return list.filter((pass) => {
      if (status && pass.status !== status) return false;
      if (search.trim()) {
        const term = search.trim().toLowerCase();
        const hay = [pass.driverName, pass.licensePlate, pass.factory?.name, pass.cargoType]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!hay.includes(term)) return false;
      }
      if (fromDate) {
        const exit = pass.exitDate ? new Date(pass.exitDate) : null;
        if (!exit || exit < new Date(fromDate)) return false;
      }
      if (toDate) {
        const exit = pass.exitDate ? new Date(pass.exitDate) : null;
        const end = new Date(toDate);
        end.setHours(23, 59, 59, 999);
        if (!exit || exit > end) return false;
      }
      return true;
    });
  }, [data, status, search, fromDate, toDate]);

  if (creating) {
    return <CreateGatePassForm handleBack={() => setCreating(false)} />;
  }

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div className="page-toolbar">
        <h1 className="text-xl font-bold sm:text-2xl">برگ‌های خروج</h1>
        <div className="flex flex-wrap gap-2">
          <Button variant="tertiary" className="gap-2" onPress={() => exportCsv(passes)} isDisabled={!passes.length}>
            <Download className="h-4 w-4" />
            خروجی Excel
          </Button>
          <Button variant="primary" className="gap-2 font-bold" onPress={() => setCreating(true)}>
            <Plus className="h-4 w-4" />
            برگ خروج جدید
          </Button>
        </div>
      </div>

      <Card className="rounded-2xl border border-default-200">
        <CardContent className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex flex-col gap-1">
            <Label className="text-xs">جستجو</Label>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="راننده، پلاک، واحد..."
              className="rounded-xl"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">وضعیت</Label>
            <Select value={status || null} onChange={(val) => setStatus(val ? String(val) : '')} className="rounded-xl" placeholder="همه">
              <SelectTrigger><SelectValue /><SelectIndicator /></SelectTrigger>
              <SelectPopover>
                <ListBox>
                  <ListBoxItem id="">همه</ListBoxItem>
                  {Object.entries(statusLabels).map(([key, label]) => (
                    <ListBoxItem key={key} id={key}>{label}</ListBoxItem>
                  ))}
                </ListBox>
              </SelectPopover>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">از تاریخ</Label>
            <Input type="date" dir="ltr" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="rounded-xl" />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">تا تاریخ</Label>
            <Input type="date" dir="ltr" value={toDate} onChange={(e) => setToDate(e.target.value)} className="rounded-xl" />
          </div>
        </CardContent>
      </Card>

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
            <ResponsiveTable>
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
            </ResponsiveTable>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default GatePassesPage;
