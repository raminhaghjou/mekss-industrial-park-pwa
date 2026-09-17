import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Card, CardContent, Table, TableContent, TableHeader, TableColumn, TableBody, TableRow, TableCell,
  Chip, Skeleton, Alert, AlertContent, AlertTitle, AlertDescription, Button,
} from '@heroui/react';
import { CreditCard, Receipt } from 'lucide-react';
import { invoiceApi } from '../../services/api/invoice.api';
import { getErrorMessage } from '../../utils/apiError';
import { EmptyState } from '../../components/common/EmptyState';
import { ResponsiveTable } from '../../components/common/ResponsiveTable';
import { useAuth } from '../../providers/AuthProvider';

const statusColors = { PENDING: 'warning', PAID: 'success', OVERDUE: 'danger', CANCELLED: 'default' };
const statusLabels = { PENDING: 'پرداخت نشده', PAID: 'پرداخت شده', OVERDUE: 'سررسید گذشته', CANCELLED: 'لغو شده' };
const canPayRoles = new Set(['SUPER_ADMIN', 'PARK_MANAGER', 'FACTORY_OWNER']);

export const InvoicesPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canPay = canPayRoles.has(user?.role);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => invoiceApi.getInvoices().then((res) => res.data),
  });

  const invoices = data || [];

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <h1 className="text-2xl font-bold text-foreground">قبض‌ها</h1>

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
                          {statusLabels[invoice.status] || invoice.status}
                        </Chip>
                      </TableCell>
                      <TableCell>
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
                        ) : (
                          <span className="text-xs text-foreground-400">—</span>
                        )}
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
