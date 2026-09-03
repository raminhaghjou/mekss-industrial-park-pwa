import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, Table, TableContent, TableHeader, TableColumn, TableBody, TableRow, TableCell, Button, Chip, Skeleton, Alert, AlertContent, AlertTitle, AlertDescription } from '@heroui/react';
import { Plus, Receipt } from 'lucide-react';
import { invoiceApi } from '../../services/api/invoice.api';
import { getErrorMessage } from '../../utils/apiError';
import { EmptyState } from '../../components/common/EmptyState';
import { ResponsiveTable } from '../../components/common/ResponsiveTable';

const statusColors = { PENDING: 'warning', PAID: 'success', OVERDUE: 'danger', CANCELLED: 'default' };
const statusLabels = { PENDING: 'پرداخت نشده', PAID: 'پرداخت شده', OVERDUE: 'سررسید گذشته', CANCELLED: 'لغو شده' };

export const ManageInvoicesPage = () => {
  const navigate = useNavigate();
  const [tab, setTab] = useState('all');

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['invoices', 'managed'],
    queryFn: () => invoiceApi.getInvoices().then((res) => res.data),
  });

  const invoices = data || [];
  const filteredInvoices = invoices.filter((inv) => {
    if (tab === 'all') return true;
    if (tab === 'unpaid') return inv.status === 'PENDING' || inv.status === 'OVERDUE';
    if (tab === 'paid') return inv.status === 'PAID';
    return false;
  });

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div className="page-toolbar">
        <h1 className="text-xl font-bold text-foreground sm:text-2xl">مدیریت قبض‌ها</h1>
        <Button variant="primary" onPress={() => navigate('/admin/invoices/create')} className="flex w-full items-center justify-center gap-2 sm:w-auto">
          <Plus className="h-4 w-4" />
          صدور قبض جدید
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="flex gap-2 border-b border-default-200 p-2">
            <button
              onClick={() => setTab('all')}
              className={`px-4 py-2 text-sm font-medium rounded-xl transition-colors ${tab === 'all' ? 'bg-primary text-white font-bold' : 'text-foreground-500 hover:bg-default-100'}`}
            >
              همه
            </button>
            <button
              onClick={() => setTab('unpaid')}
              className={`px-4 py-2 text-sm font-medium rounded-xl transition-colors ${tab === 'unpaid' ? 'bg-primary text-white font-bold' : 'text-foreground-500 hover:bg-default-100'}`}
            >
              پرداخت نشده
            </button>
            <button
              onClick={() => setTab('paid')}
              className={`px-4 py-2 text-sm font-medium rounded-xl transition-colors ${tab === 'paid' ? 'bg-primary text-white font-bold' : 'text-foreground-500 hover:bg-default-100'}`}
            >
              پرداخت شده
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
                <AlertDescription>{getErrorMessage(error, 'دریافت قبض‌ها ناموفق بود.')}</AlertDescription>
              </AlertContent>
            </Alert>
          ) : filteredInvoices.length === 0 ? (
            <EmptyState
              icon={<Receipt className="h-6 w-6" />}
              title="قبضی برای نمایش وجود ندارد"
              description="قبض‌های صادرشده برای واحدهای صنعتی در این فهرست نمایش داده می‌شوند."
            />
          ) : (
            <ResponsiveTable>
            <Table>
              <TableContent aria-label="قبض‌ها">
              <TableHeader>
                <TableColumn isRowHeader>شماره قبض</TableColumn>
                <TableColumn>واحد صنعتی</TableColumn>
                <TableColumn>شرح</TableColumn>
                <TableColumn>مبلغ (ریال)</TableColumn>
                <TableColumn>وضعیت</TableColumn>
              </TableHeader>
              <TableBody>
                {filteredInvoices.map((invoice) => (
                  <TableRow key={invoice.id} id={invoice.id}>
                    <TableCell dir="ltr">{invoice.invoiceNumber}</TableCell>
                    <TableCell>{invoice.factory?.name || '—'}</TableCell>
                    <TableCell>{invoice.description}</TableCell>
                    <TableCell dir="ltr">{Number(invoice.totalAmount).toLocaleString('fa-IR')}</TableCell>
                    <TableCell>
                      <Chip color={statusColors[invoice.status] || 'default'} size="sm" variant="soft">
                        {statusLabels[invoice.status] || invoice.status}
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

      <p className="text-xs text-foreground-400">
        قبض‌های صادر شده قابل ویرایش یا حذف نیستند.
      </p>
    </div>
  );
};

export default ManageInvoicesPage;
