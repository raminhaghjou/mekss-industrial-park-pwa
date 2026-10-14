import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
import { Ban, Download, Pencil, Plus, Printer, Ticket } from 'lucide-react';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { useNotification } from '../../providers/NotificationProvider';
import { useAuth } from '../../providers/AuthProvider';

const CANCEL_ROLES = ['SUPER_ADMIN', 'PARK_MANAGER', 'FACTORY_OWNER'];
import { displayIranLicensePlate } from '../../utils/iranLicensePlate';
import IranLicensePlateBadge from '../../components/common/IranLicensePlateBadge';
import { semanticFilter } from '../../utils/semanticSearch';
import { gatePassApi } from '../../services/api/gatePass.api';
import { getErrorMessage } from '../../utils/apiError';
import {
  CANCELLABLE_GATE_PASS_STATUSES,
  cargoTypeLabels,
  gatePassRejectionStage,
  gatePassStatusLabels as statusLabels,
  labelFor,
  vehicleTypeLabels,
} from '../../constants/persianLabels';
import { saveBlob } from '../../services/api/files.api';
import { csvLine } from '../../utils/csv';
import { EmptyState } from '../../components/common/EmptyState';
import { ResponsiveTable } from '../../components/common/ResponsiveTable';
import CreateGatePassForm from '../../components/gate-pass/CreateGatePassForm';
import { GatePassPrintDialog } from '../../components/gate-pass/GatePassPrintDialog';
import JalaliDatePicker from '../../components/common/JalaliDatePicker';

const statusColors = {
  PENDING: 'warning',
  APPROVED: 'accent',
  REJECTED: 'danger',
  COMPLETED: 'success',
  EXPIRED: 'default',
  CANCELLED: 'default',
};

const exportCsv = (rows) => {
  const header = ['نام راننده', 'پلاک', 'تاریخ خروج', 'وضعیت', 'نوع بار', 'نوع خودرو', 'واحد', 'صادرکننده', 'تایید مدیر شهرک', 'زمان تایید مدیر شهرک', 'نگهبان', 'زمان تصمیم نگهبان', 'دلیل رد'];
  const lines = rows.map((pass) => csvLine([
    pass.driverName || '',
    displayIranLicensePlate(pass.licensePlate) || pass.licensePlate || '',
    pass.exitDate ? new Date(pass.exitDate).toLocaleDateString('fa-IR-u-ca-persian') : '',
    statusLabels[pass.status] || pass.status || '',
    labelFor(cargoTypeLabels, pass.cargoType),
    labelFor(vehicleTypeLabels, pass.vehicleType),
    pass.factory?.name || '',
    pass.createdBy?.name || '',
    pass.approvedBy?.name || '',
    pass.approvedAt ? new Date(pass.approvedAt).toLocaleString('fa-IR-u-ca-persian') : '',
    pass.verifiedBy?.name || '',
    pass.verifiedAt ? new Date(pass.verifiedAt).toLocaleString('fa-IR-u-ca-persian') : '',
    pass.status === 'REJECTED' ? pass.notes || '' : '',
  ]));
  const csv = `\uFEFF${[header.join(','), ...lines].join('\n')}`;
  saveBlob(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), `gate-passes-${new Date().toISOString().slice(0, 10)}.csv`);
};

export const GatePassesPage = () => {
  const [creating, setCreating] = useState(false);
  const [editingPass, setEditingPass] = useState(null);
  const [printingPass, setPrintingPass] = useState(null);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const [cancelTarget, setCancelTarget] = useState(null);
  const queryClient = useQueryClient();
  const { showNotification } = useNotification();
  const { user } = useAuth();
  const mayCancel = CANCEL_ROLES.includes(user?.role);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['gate-passes'],
    queryFn: () => gatePassApi.getGatePasses().then((res) => res.data),
  });

  const cancelMutation = useMutation({
    mutationFn: ({ id, reason }) => gatePassApi.cancelGatePass(id, reason),
    onSuccess: () => {
      showNotification('برگ خروج لغو شد.', 'success');
      setCancelTarget(null);
    },
    onError: (err) => showNotification(getErrorMessage(err, 'لغو برگ خروج ناموفق بود.'), 'error'),
    onSettled: () => Promise.all([
      queryClient.invalidateQueries({ queryKey: ['gate-passes'] }),
      queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
    ]),
  });

  const passes = useMemo(() => {
    const list = Array.isArray(data) ? data : data?.items || [];
    const byStatus = list.filter((pass) => {
      if (status && pass.status !== status) return false;
      if (fromDate) {
        const exit = pass.exitDate ? new Date(pass.exitDate) : null;
        if (!exit || exit < new Date(`${fromDate}T00:00:00`)) return false;
      }
      if (toDate) {
        const exit = pass.exitDate ? new Date(pass.exitDate) : null;
        if (!exit || exit > new Date(`${toDate}T23:59:59.999`)) return false;
      }
      return true;
    });
    return semanticFilter(byStatus, search, (pass) => [
      pass.driverName,
      pass.licensePlate,
      pass.factory?.name,
      pass.cargoType,
      pass.id,
      pass.status,
      'مجوز',
      'برگ خروج',
    ]);
  }, [data, status, search, fromDate, toDate]);

  if (creating || editingPass) {
    return (
      <CreateGatePassForm
        initialPass={editingPass}
        handleBack={() => {
          setCreating(false);
          setEditingPass(null);
        }}
      />
    );
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
            <JalaliDatePicker compact value={fromDate} onChange={(value) => setFromDate(value)} />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">تا تاریخ</Label>
            <JalaliDatePicker compact value={toDate} onChange={(value) => setToDate(value)} />
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
                    <TableColumn>صادرکننده</TableColumn>
                    <TableColumn>مراحل تایید</TableColumn>
                    <TableColumn>وضعیت</TableColumn>
                    <TableColumn>عملیات</TableColumn>
                  </TableHeader>
                  <TableBody>
                    {passes.map((pass) => {
                      const canEdit = pass.status === 'PENDING' || pass.status === 'REJECTED';
                      const canCancel = mayCancel && CANCELLABLE_GATE_PASS_STATUSES.includes(pass.status);
                      return (
                        <TableRow key={pass.id} id={pass.id}>
                          <TableCell>{pass.driverName}</TableCell>
                          <TableCell>{pass.licensePlate ? <IranLicensePlateBadge value={pass.licensePlate} size="sm" /> : '—'}</TableCell>
                          <TableCell>{new Date(pass.exitDate).toLocaleDateString('fa-IR-u-ca-persian')}</TableCell>
                          <TableCell>{pass.createdBy?.name || '—'}</TableCell>
                          <TableCell>
                            <span className="block text-xs">
                              <span className="text-foreground-500">مدیر شهرک: </span>
                              {pass.approvedBy?.name || '—'}
                            </span>
                            {pass.approvedAt ? (
                              <span className="block text-[11px] text-foreground-500">
                                {new Date(pass.approvedAt).toLocaleString('fa-IR-u-ca-persian')}
                              </span>
                            ) : null}
                            <span className="mt-1 block text-xs">
                              <span className="text-foreground-500">نگهبانی: </span>
                              {pass.verifiedBy?.name || '—'}
                            </span>
                            {pass.verifiedAt ? (
                              <span className="block text-[11px] text-foreground-500">
                                {new Date(pass.verifiedAt).toLocaleString('fa-IR-u-ca-persian')}
                              </span>
                            ) : null}
                          </TableCell>
                          <TableCell>
                            <Chip color={statusColors[pass.status] || 'default'} size="sm" variant="soft">
                              {pass.status === 'REJECTED'
                                ? (gatePassRejectionStage(pass) === 'guard' ? 'رد توسط نگهبانی' : 'رد توسط مدیر شهرک')
                                : statusLabels[pass.status] || pass.status}
                            </Chip>
                            {pass.status === 'REJECTED' && pass.notes ? (
                              <span className="mt-1 block max-w-[16rem] whitespace-normal text-[11px] leading-5 text-danger-600 dark:text-danger-300">
                                دلیل: {pass.notes}
                              </span>
                            ) : null}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap items-center gap-1.5">
                              {pass.status !== 'CANCELLED' && (
                                <Button
                                  size="sm"
                                  variant="tertiary"
                                  className="rounded-xl gap-1"
                                  onPress={() => setPrintingPass(pass)}
                                  aria-label={`پرینت برگ خروج ${pass.driverName || ''}`}
                                >
                                  <Printer className="h-3.5 w-3.5" />
                                  پرینت
                                </Button>
                              )}
                              {canCancel && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="rounded-xl gap-1 text-danger"
                                  isDisabled={cancelMutation.isPending}
                                  onPress={() => setCancelTarget(pass)}
                                >
                                  <Ban className="h-3.5 w-3.5" />
                                  لغو
                                </Button>
                              )}
                              {canEdit && (
                                <Button
                                  size="sm"
                                  variant="tertiary"
                                  className="rounded-xl gap-1"
                                  onPress={() => setEditingPass(pass)}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                  ویرایش
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </TableContent>
              </Table>
            </ResponsiveTable>
          )}
        </CardContent>
      </Card>

      {printingPass && (
        <GatePassPrintDialog pass={printingPass} onClose={() => setPrintingPass(null)} />
      )}

      <ConfirmDialog
        open={Boolean(cancelTarget)}
        title="لغو برگ خروج"
        description={cancelTarget
          ? `برگ خروج راننده ${cancelTarget.driverName} با پلاک ${displayIranLicensePlate(cancelTarget.licensePlate)} لغو می‌شود${cancelTarget.status === 'APPROVED' ? ' و به نگهبانی اطلاع داده می‌شود که اجازه خروج ندهد' : ''}. هزینهٔ صدور برگ بازگردانده نمی‌شود و این کار برگشت‌پذیر نیست.`
          : ''}
        showReason
        reasonLabel="دلیل لغو"
        confirmLabel="لغو برگ خروج"
        confirmColor="danger"
        loading={cancelMutation.isPending}
        onConfirm={(reason) => cancelTarget && cancelMutation.mutate({ id: cancelTarget.id, reason })}
        onClose={() => setCancelTarget(null)}
      />
    </div>
  );
};

export default GatePassesPage;
