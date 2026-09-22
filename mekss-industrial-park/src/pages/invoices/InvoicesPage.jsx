import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Card, CardContent, Table, TableContent, TableHeader, TableColumn, TableBody, TableRow, TableCell,
  Chip, Skeleton, Alert, AlertContent, AlertTitle, AlertDescription, Button, Input, Label,
} from '@heroui/react';
import { CreditCard, Printer, Receipt } from 'lucide-react';
import { invoiceApi, printInvoicePayload } from '../../services/api/invoice.api';
import { getErrorMessage } from '../../utils/apiError';
import { EmptyState } from '../../components/common/EmptyState';
import { ResponsiveTable } from '../../components/common/ResponsiveTable';
import { useAuth } from '../../providers/AuthProvider';
import { invoiceStatusLabels } from '../../constants/persianLabels';
import { useNotification } from '../../providers/NotificationProvider';

const statusColors = {
  PENDING: 'warning',
  AWAITING_CONFIRMATION: 'accent',
  PAID: 'success',
  OVERDUE: 'danger',
  CANCELLED: 'default',
};
const canPayRoles = new Set(['SUPER_ADMIN', 'PARK_MANAGER', 'FACTORY_OWNER']);

export const InvoicesPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showNotification } = useNotification();
  const canPay = canPayRoles.has(user?.role);
  const [status, setStatus] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');

  const params = useMemo(() => ({
    scope: 'payable',
    ...(status ? { status } : {}),
    ...(fromDate ? { fromDate } : {}),
    ...(toDate ? { toDate } : {}),
    ...(minAmount !== '' ? { minAmount: Number(minAmount) } : {}),
    ...(maxAmount !== '' ? { maxAmount: Number(maxAmount) } : {}),
  }), [status, fromDate, toDate, minAmount, maxAmount]);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['invoices', 'payable', params],
    queryFn: () => invoiceApi.getInvoices(params).then((res) => res.data),
  });

  const invoices = data || [];

  const handlePrint = async (id) => {
    try {
      const { data: payload } = await invoiceApi.getInvoicePdf(id);
      printInvoicePayload(payload);
    } catch (err) {
      showNotification(getErrorMessage(err, 'دریافت قبض برای پرینت ناموفق بود'), 'error');
    }
  };

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          {user?.role === 'PARK_MANAGER' ? 'قبض‌های شهرک' : 'قبض‌های من'}
        </h1>
        <p className="mt-1 text-sm text-foreground-500">
          {user?.role === 'PARK_MANAGER'
            ? 'صورتحساب‌هایی که ادمین برای شهرک شما صادر کرده است'
            : 'صورتحساب‌های واحد صنعتی شما برای پرداخت'}
        </p>
      </div>

      <Card className="rounded-2xl border border-default-200">
        <CardContent className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="flex flex-col gap-1">
            <Label className="text-xs">وضعیت</Label>
            <select className="rounded-xl border border-default-200 bg-background px-3 py-2 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">همه</option>
              {Object.entries(invoiceStatusLabels).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">از تاریخ</Label>
            <Input type="date" dir="ltr" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="rounded-xl" />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">تا تاریخ</Label>
            <Input type="date" dir="ltr" value={toDate} onChange={(e) => setToDate(e.target.value)} className="rounded-xl" />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">حداقل مبلغ</Label>
            <Input type="number" dir="ltr" value={minAmount} onChange={(e) => setMinAmount(e.target.value)} className="rounded-xl" />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">حداکثر مبلغ</Label>
            <Input type="number" dir="ltr" value={maxAmount} onChange={(e) => setMaxAmount(e.target.value)} className="rounded-xl" />
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
                <AlertDescription>{getErrorMessage(error, 'دریافت قبض‌ها ناموفق بود.')}</AlertDescription>
              </AlertContent>
            </Alert>
          ) : invoices.length === 0 ? (
            <EmptyState
              icon={<Receipt className="h-6 w-6" />}
              title="هیچ قبضی برای نمایش وجود ندارد"
              description="قبض‌های صادر شده در این فهرست نمایش داده می‌شوند."
            />
          ) : (
            <ResponsiveTable>
            <Table>
              <TableContent aria-label="قبض‌ها">
              <TableHeader>
                <TableColumn isRowHeader>شماره قبض</TableColumn>
                <TableColumn>شرح</TableColumn>
                <TableColumn>مبلغ پایه</TableColumn>
                <TableColumn>جریمه تأخیر</TableColumn>
                <TableColumn>قابل پرداخت</TableColumn>
                <TableColumn>وضعیت</TableColumn>
                <TableColumn>عملیات</TableColumn>
              </TableHeader>
              <TableBody>
                {invoices.map((invoice) => {
                  const unpaid = invoice.status === 'PENDING' || invoice.status === 'OVERDUE';
                  return (
                    <TableRow key={invoice.id} id={invoice.id}>
                      <TableCell dir="ltr">{invoice.invoiceNumber}</TableCell>
                      <TableCell>{invoice.description}</TableCell>
                      <TableCell dir="ltr">{Number(invoice.totalAmount).toLocaleString('fa-IR')}</TableCell>
                      <TableCell>
                        {Number(invoice.latePenaltyAmount) > 0 ? (
                          <div className="text-xs" dir="ltr">
                            <span className="text-danger font-semibold">{Number(invoice.latePenaltyAmount).toLocaleString('fa-IR')}</span>
                            <span className="text-foreground-500 block">{Number(invoice.lateDays || 0).toLocaleString('fa-IR')} روز</span>
                          </div>
                        ) : Number(invoice.latePenaltyPerDay) > 0 ? (
                          <span className="text-xs text-foreground-500" dir="ltr">{Number(invoice.latePenaltyPerDay).toLocaleString('fa-IR')}/روز</span>
                        ) : (
                          <span className="text-xs text-foreground-400">—</span>
                        )}
                      </TableCell>
                      <TableCell dir="ltr" className="font-bold">
                        {Number(invoice.payableAmount ?? invoice.totalAmount).toLocaleString('fa-IR')}
                      </TableCell>
                      <TableCell>
                        <Chip color={statusColors[invoice.status] || 'default'} size="sm" variant="soft">
                          {invoiceStatusLabels[invoice.status] || invoice.status}
                        </Chip>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          <Button size="sm" variant="tertiary" className="rounded-xl gap-1" onPress={() => handlePrint(invoice.id)}>
                            <Printer className="h-3.5 w-3.5" />
                            PDF
                          </Button>
                          {canPay && unpaid ? (
                            <Button
                              size="sm"
                              variant="primary"
                              className="rounded-xl font-medium gap-1"
                              onPress={() => navigate(`/invoices/pay/${invoice.id}`)}
                            >
                              <CreditCard className="h-3.5 w-3.5" />
                              پرداخت
                            </Button>
                          ) : null}
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
    </div>
  );
};

export default InvoicesPage;
