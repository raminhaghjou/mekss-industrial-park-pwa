import React from 'react';
import { useQuery } from '@tanstack/react-query';
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
  Table, TableContent,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
} from '@heroui/react';
import { Filter, BarChart3 } from 'lucide-react';
import { reportApi } from '../../services/api/report.api';
import { getErrorMessage } from '../../utils/apiError';
import JalaliDatePicker from '../../components/common/JalaliDatePicker';
import { ResponsiveTable } from '../../components/common/ResponsiveTable';

const typeOptions = [
  { value: 'financial', label: 'مالی' },
  { value: 'gatepass', label: 'تردد' },
  { value: 'requests', label: 'درخواست‌ها' },
];
const statusLabels = {
  PENDING: 'در انتظار', PAID: 'پرداخت شده', OVERDUE: 'سررسید گذشته', CANCELLED: 'لغو شده',
  APPROVED: 'تایید شده', REJECTED: 'رد شده', COMPLETED: 'تکمیل شده', EXPIRED: 'منقضی شده',
};

const ReportsPage = () => {
  const [type, setType] = React.useState('financial');
  const [from, setFrom] = React.useState('');
  const [to, setTo] = React.useState('');
  const [submittedFilters, setSubmittedFilters] = React.useState({ type: 'financial', from: '', to: '' });

  const { data, isLoading, isError, error, isFetched } = useQuery({
    queryKey: ['reports', submittedFilters],
    queryFn: () => reportApi.getReport(submittedFilters.type, submittedFilters.from || undefined, submittedFilters.to || undefined).then((res) => res.data),
  });

  const handleGenerate = () => setSubmittedFilters({ type, from, to });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-100 dark:bg-primary-900/40 text-primary-600">
          <BarChart3 className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">گزارش‌گیری جامع</h1>
          <p className="text-sm text-foreground-500">تحلیل داده‌های مالی، ترددها و درخواست‌های شهرک صنعتی</p>
        </div>
      </div>

      <Card className="border border-default-200 shadow-sm rounded-2xl p-2 dark:border-white/10">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="h-4 w-4 text-primary-500" />
            <h2 className="text-base font-bold text-foreground">فیلترهای گزارش</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="flex flex-col gap-1">
              <Label className="text-xs font-medium text-foreground-600">نوع گزارش</Label>
              <Select
                value={type}
                onChange={(value) => setType(String(value || 'financial'))}
                variant="primary"
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

          <div className="flex justify-end">
            <Button variant="primary" onPress={handleGenerate} className="rounded-xl font-bold px-6">
              ایجاد گزارش
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border border-default-200 shadow-sm rounded-2xl p-2 dark:border-white/10">
        <CardContent className="p-6">
          <h2 className="text-lg font-bold text-foreground mb-4">
            نمایش گزارش: {typeOptions.find((option) => option.value === submittedFilters.type)?.label || submittedFilters.type}
          </h2>

          {isLoading && (
            <div className="flex min-h-[160px] flex-col items-center justify-center gap-3">
              <Spinner size="lg" />
              <p className="text-sm text-foreground-500">در حال دریافت داده‌های گزارش...</p>
            </div>
          )}

          {isError && (
            <Alert status="danger">
              <AlertContent>
                <AlertTitle>خطا</AlertTitle>
                <AlertDescription>{getErrorMessage(error, 'دریافت گزارش ناموفق بود.')}</AlertDescription>
              </AlertContent>
            </Alert>
          )}

          {!isLoading && !isError && isFetched && data?.type === 'financial' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 my-2">
              <div className="p-4 rounded-2xl bg-default-100 dark:bg-default-100/30 text-center">
                <span className="text-xs text-foreground-500">تعداد قبض‌ها</span>
                <p className="text-2xl font-bold text-foreground mt-1">{data.count}</p>
              </div>
              <div className="p-4 rounded-2xl bg-primary-50 dark:bg-primary-950/30 text-center">
                <span className="text-xs text-primary-600 dark:text-primary-400">جمع کل مبلغ</span>
                <p className="text-2xl font-bold text-primary-600 dark:text-primary-400 mt-1">
                  {data.totalAmount.toLocaleString('fa-IR')} <span className="text-xs">ریال</span>
                </p>
              </div>
              <div className="p-4 rounded-2xl bg-success-50 dark:bg-success-950/30 text-center">
                <span className="text-xs text-success-600 dark:text-success-400">مبلغ پرداخت‌شده</span>
                <p className="text-2xl font-bold text-success-600 dark:text-success-400 mt-1">
                  {data.paidAmount.toLocaleString('fa-IR')} <span className="text-xs">ریال</span>
                </p>
              </div>
            </div>
          )}

          {!isLoading && !isError && isFetched && (data?.type === 'gatepass' || data?.type === 'requests') && (
            <ResponsiveTable>
            <Table>
              <TableContent aria-label="جدول خلاصه آمار">
              <TableHeader>
                <TableColumn className="font-bold text-right" isRowHeader>وضعیت</TableColumn>
                <TableColumn className="font-bold text-left">تعداد</TableColumn>
              </TableHeader>
              <TableBody>
                {data.byStatus.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={2} className="text-center text-foreground-400">
                      داده‌ای برای نمایش وجود ندارد.
                    </TableCell>
                  </TableRow>
                ) : (
                  data.byStatus.map((row) => (
                    <TableRow key={row.status} id={row.status}>
                      <TableCell className="font-medium">{statusLabels[row.status] || row.status}</TableCell>
                      <TableCell className="text-left font-mono font-bold">{row.count}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
              </TableContent>
            </Table>
            </ResponsiveTable>
          )}

          <p className="mt-4 text-xs text-foreground-400">
            خروجی فایل قابل دانلود برای گزارش‌ها در این نسخه پشتیبانی نمی‌شود.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default ReportsPage;

