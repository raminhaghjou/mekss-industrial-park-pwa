import React from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  Select,
  SelectTrigger,
  SelectValue,
  SelectIndicator,
  SelectPopover,
  ListBox,
  ListBoxItem,
  Label,
  Button,
  Spinner,
  Alert,
  AlertContent,
  AlertTitle,
  AlertDescription,
  Table,
  TableContent,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
} from '@heroui/react';
import { Filter, BarChart3, FileSpreadsheet, FileText, RefreshCw } from 'lucide-react';
import { reportApi } from '../../services/api/report.api';
import { getErrorMessage } from '../../utils/apiError';
import JalaliDatePicker from '../../components/common/JalaliDatePicker';
import { ResponsiveTable } from '../../components/common/ResponsiveTable';
import {
  exportReportExcel,
  exportReportPdf,
  reportStatusLabels,
  reportTypeLabels,
} from '../../utils/reportExport';
import { useNotification } from '../../providers/NotificationProvider';

const typeOptions = [
  { value: 'financial', label: 'مالی' },
  { value: 'gatepass', label: 'تردد' },
  { value: 'requests', label: 'درخواست‌ها' },
];

const formatMoney = (value) =>
  Number(value || 0).toLocaleString('fa-IR', { maximumFractionDigits: 0 });

const formatDate = (value) => {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleDateString('fa-IR');
  } catch {
    return '—';
  }
};

const ReportsPage = () => {
  const { showNotification } = useNotification();
  const [type, setType] = React.useState('financial');
  const [from, setFrom] = React.useState('');
  const [to, setTo] = React.useState('');
  const [report, setReport] = React.useState(null);

  const generateMutation = useMutation({
    mutationFn: ({ reportType, fromDate, toDate }) =>
      reportApi
        .getReport(reportType, fromDate || undefined, toDate || undefined)
        .then((res) => res.data),
    onSuccess: (data) => {
      setReport(data);
      showNotification('گزارش با موفقیت تولید شد', 'success');
    },
    onError: (error) => {
      showNotification(getErrorMessage(error, 'تولید گزارش ناموفق بود'), 'error');
    },
  });

  const handleGenerate = () => {
    if (from && to && from > to) {
      showNotification('بازه تاریخ نامعتبر است', 'error');
      return;
    }
    generateMutation.mutate({ reportType: type, fromDate: from, toDate: to });
  };

  const handleExcel = () => {
    if (!report) return;
    try {
      exportReportExcel(report);
      showNotification('فایل اکسل دانلود شد', 'success');
    } catch (error) {
      showNotification(getErrorMessage(error, 'ساخت فایل اکسل ناموفق بود'), 'error');
    }
  };

  const handlePdf = () => {
    if (!report) return;
    try {
      exportReportPdf(report);
      showNotification('پیش‌نمایش PDF باز شد — از پنجره چاپ ذخیره کنید', 'success');
    } catch (error) {
      showNotification(getErrorMessage(error, 'ساخت PDF ناموفق بود'), 'error');
    }
  };

  const isLoading = generateMutation.isPending;
  const data = report;

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--color-brand-soft)] text-[var(--color-brand)]">
          <BarChart3 className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">گزارش‌گیری جامع</h1>
          <p className="text-sm text-foreground-500">تحلیل داده‌های مالی، ترددها و درخواست‌های شهرک صنعتی</p>
        </div>
      </div>

      <Card className="rounded-2xl border border-default-200 shadow-sm dark:border-white/10">
        <CardContent className="gap-4 p-6">
          <div className="mb-2 flex items-center gap-2">
            <Filter className="h-4 w-4 text-[var(--color-brand)]" />
            <h2 className="text-base font-bold text-foreground">فیلترهای گزارش</h2>
          </div>

          <div className="mb-2 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="flex flex-col gap-1">
              <Label className="text-xs font-medium text-foreground-600">نوع گزارش</Label>
              <Select
                value={type}
                onChange={(value) => setType(String(value || 'financial'))}
                className="rounded-xl"
              >
                <SelectTrigger>
                  <SelectValue />
                  <SelectIndicator />
                </SelectTrigger>
                <SelectPopover>
                  <ListBox>
                    {typeOptions.map((option) => (
                      <ListBoxItem key={option.value} id={option.value}>{option.label}</ListBoxItem>
                    ))}
                  </ListBox>
                </SelectPopover>
              </Select>
            </div>

            <JalaliDatePicker label="از تاریخ" value={from} onChange={setFrom} />
            <JalaliDatePicker label="تا تاریخ" value={to} onChange={setTo} />
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <Button
              variant="primary"
              onPress={handleGenerate}
              className="rounded-xl px-6 font-bold"
              isDisabled={isLoading}
            >
              {isLoading ? (
                <span className="inline-flex items-center gap-2">
                  <Spinner size="sm" />
                  در حال تولید...
                </span>
              ) : (
                <span className="inline-flex items-center gap-2">
                  <RefreshCw className="h-4 w-4" />
                  ایجاد گزارش
                </span>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {generateMutation.isError && (
        <Alert status="danger">
          <AlertContent>
            <AlertTitle>خطا در تولید گزارش</AlertTitle>
            <AlertDescription>
              {getErrorMessage(generateMutation.error, 'دریافت گزارش ناموفق بود.')}
            </AlertDescription>
          </AlertContent>
        </Alert>
      )}

      {!data && !isLoading && (
        <Card className="rounded-2xl border border-dashed border-default-300">
          <CardContent className="p-10 text-center text-sm text-foreground-500">
            فیلترها را انتخاب کنید و روی «ایجاد گزارش» بزنید تا گزارش کامل تولید شود.
          </CardContent>
        </Card>
      )}

      {data && (
        <Card className="rounded-2xl border border-default-200 shadow-sm dark:border-white/10">
          <CardContent className="gap-5 p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-bold text-foreground">
                  نمایش گزارش: {reportTypeLabels[data.type] || data.type}
                </h2>
                <p className="mt-1 text-xs text-foreground-500">
                  {data.count?.toLocaleString('fa-IR') || '۰'} رکورد
                  {data.from || data.to
                    ? ` · بازه ${data.from ? formatDate(data.from) : '—'} تا ${data.to ? formatDate(data.to) : '—'}`
                    : ' · بدون محدودیت تاریخ'}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  className="rounded-xl font-bold"
                  onPress={handleExcel}
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  دانلود اکسل
                </Button>
                <Button
                  variant="primary"
                  className="rounded-xl font-bold"
                  onPress={handlePdf}
                >
                  <FileText className="h-4 w-4" />
                  دانلود PDF
                </Button>
              </div>
            </div>

            {data.type === 'financial' && (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                <div className="rounded-2xl bg-default-100 p-4 text-center dark:bg-default-100/30">
                  <span className="text-xs text-foreground-500">تعداد قبض‌ها</span>
                  <p className="mt-1 text-2xl font-bold">{(data.count || 0).toLocaleString('fa-IR')}</p>
                </div>
                <div className="rounded-2xl bg-[var(--color-brand-soft)] p-4 text-center">
                  <span className="text-xs text-[var(--color-brand)]">جمع کل</span>
                  <p className="mt-1 text-xl font-bold text-[var(--color-brand)]">
                    {formatMoney(data.totalAmount)} <span className="text-xs">ریال</span>
                  </p>
                </div>
                <div className="rounded-2xl bg-success-50 p-4 text-center dark:bg-success-950/30">
                  <span className="text-xs text-success-600">پرداخت‌شده</span>
                  <p className="mt-1 text-xl font-bold text-success-600">
                    {formatMoney(data.paidAmount)} <span className="text-xs">ریال</span>
                  </p>
                </div>
                <div className="rounded-2xl bg-warning-50 p-4 text-center dark:bg-warning-950/30">
                  <span className="text-xs text-warning-700">پرداخت‌نشده</span>
                  <p className="mt-1 text-xl font-bold text-warning-700">
                    {formatMoney(data.unpaidAmount)} <span className="text-xs">ریال</span>
                  </p>
                </div>
              </div>
            )}

            {(data.byStatus || []).length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-bold">خلاصه وضعیت‌ها</h3>
                <ResponsiveTable>
                  <Table>
                    <TableContent aria-label="خلاصه وضعیت گزارش">
                      <TableHeader>
                        <TableColumn isRowHeader>وضعیت</TableColumn>
                        <TableColumn>تعداد</TableColumn>
                      </TableHeader>
                      <TableBody>
                        {data.byStatus.map((row) => (
                          <TableRow key={row.status} id={row.status}>
                            <TableCell className="font-medium">
                              {reportStatusLabels[row.status] || row.status}
                            </TableCell>
                            <TableCell className="font-mono font-bold">
                              {Number(row.count).toLocaleString('fa-IR')}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </TableContent>
                  </Table>
                </ResponsiveTable>
              </div>
            )}

            <div>
              <h3 className="mb-2 text-sm font-bold">جزئیات رکوردها</h3>
              <ResponsiveTable>
                <Table>
                  <TableContent aria-label="جزئیات گزارش">
                    {data.type === 'financial' && (
                      <>
                        <TableHeader>
                          <TableColumn isRowHeader>شماره قبض</TableColumn>
                          <TableColumn>واحد</TableColumn>
                          <TableColumn>مبلغ</TableColumn>
                          <TableColumn>وضعیت</TableColumn>
                          <TableColumn>تاریخ صدور</TableColumn>
                        </TableHeader>
                        <TableBody>
                          {(data.items || []).length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={5} className="text-center text-foreground-400">
                                داده‌ای برای نمایش وجود ندارد.
                              </TableCell>
                            </TableRow>
                          ) : (
                            data.items.map((item) => (
                              <TableRow key={item.id} id={item.id}>
                                <TableCell className="font-mono text-xs">{item.invoiceNumber}</TableCell>
                                <TableCell>{item.factoryName || '—'}</TableCell>
                                <TableCell>{formatMoney(item.totalAmount)}</TableCell>
                                <TableCell>{reportStatusLabels[item.status] || item.status}</TableCell>
                                <TableCell>{formatDate(item.issueDate)}</TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </>
                    )}

                    {data.type === 'gatepass' && (
                      <>
                        <TableHeader>
                          <TableColumn isRowHeader>واحد</TableColumn>
                          <TableColumn>راننده</TableColumn>
                          <TableColumn>پلاک</TableColumn>
                          <TableColumn>وضعیت</TableColumn>
                          <TableColumn>تاریخ</TableColumn>
                        </TableHeader>
                        <TableBody>
                          {(data.items || []).length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={5} className="text-center text-foreground-400">
                                داده‌ای برای نمایش وجود ندارد.
                              </TableCell>
                            </TableRow>
                          ) : (
                            data.items.map((item) => (
                              <TableRow key={item.id} id={item.id}>
                                <TableCell>{item.factoryName || '—'}</TableCell>
                                <TableCell>{item.driverName || '—'}</TableCell>
                                <TableCell className="font-mono text-xs">{item.licensePlate}</TableCell>
                                <TableCell>{reportStatusLabels[item.status] || item.status}</TableCell>
                                <TableCell>{formatDate(item.createdAt)}</TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </>
                    )}

                    {data.type === 'requests' && (
                      <>
                        <TableHeader>
                          <TableColumn isRowHeader>عنوان</TableColumn>
                          <TableColumn>واحد</TableColumn>
                          <TableColumn>اولویت</TableColumn>
                          <TableColumn>وضعیت</TableColumn>
                          <TableColumn>تاریخ</TableColumn>
                        </TableHeader>
                        <TableBody>
                          {(data.items || []).length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={5} className="text-center text-foreground-400">
                                داده‌ای برای نمایش وجود ندارد.
                              </TableCell>
                            </TableRow>
                          ) : (
                            data.items.map((item) => (
                              <TableRow key={item.id} id={item.id}>
                                <TableCell className="font-medium">{item.title}</TableCell>
                                <TableCell>{item.factoryName || '—'}</TableCell>
                                <TableCell>{item.priority || '—'}</TableCell>
                                <TableCell>{reportStatusLabels[item.status] || item.status}</TableCell>
                                <TableCell>{formatDate(item.createdAt)}</TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </>
                    )}
                  </TableContent>
                </Table>
              </ResponsiveTable>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ReportsPage;
