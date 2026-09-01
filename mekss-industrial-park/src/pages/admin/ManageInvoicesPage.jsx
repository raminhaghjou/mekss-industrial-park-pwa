import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Card, CardBody, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, Button, Chip, Tabs, Tab, Skeleton, Alert } from '@heroui/react';
import { Plus, Receipt } from 'lucide-react';
import { invoiceApi } from '../../services/api/invoice.api';
import { getErrorMessage } from '../../utils/apiError';
import { EmptyState } from '../../components/common/EmptyState';

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
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">مدیریت قبض‌ها</h1>
        <Button color="primary" startContent={<Plus className="h-4 w-4" />} onClick={() => navigate('/admin/invoices/create')}>
          صدور قبض جدید
        </Button>
      </div>

      <Card>
        <CardBody className="p-0">
          <div className="border-b border-default-200 p-2">
            <Tabs selectedKey={tab} onSelectionChange={setTab} variant="underlined">
              <Tab key="all" title="همه" />
              <Tab key="unpaid" title="پرداخت نشده" />
              <Tab key="paid" title="پرداخت شده" />
            </Tabs>
          </div>

          {isLoading ? (
            <div className="flex flex-col gap-2 p-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 rounded-lg" />
              ))}
            </div>
          ) : isError ? (
            <Alert color="danger" title="خطا در دریافت اطلاعات">
              {getErrorMessage(error, 'دریافت قبض‌ها ناموفق بود.')}
            </Alert>
          ) : filteredInvoices.length === 0 ? (
            <EmptyState
              icon={<Receipt className="h-6 w-6" />}
              title="قبضی برای نمایش وجود ندارد"
              description="قبض‌های صادرشده برای واحدهای صنعتی در این فهرست نمایش داده می‌شوند."
            />
          ) : (
            <Table removeWrapper aria-label="قبض‌ها">
              <TableHeader>
                <TableColumn>شماره قبض</TableColumn>
                <TableColumn>واحد صنعتی</TableColumn>
                <TableColumn>شرح</TableColumn>
                <TableColumn>مبلغ (ریال)</TableColumn>
                <TableColumn>وضعیت</TableColumn>
              </TableHeader>
              <TableBody>
                {filteredInvoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell dir="ltr">{invoice.invoiceNumber}</TableCell>
                    <TableCell>{invoice.factory?.name || '—'}</TableCell>
                    <TableCell>{invoice.description}</TableCell>
                    <TableCell dir="ltr">{Number(invoice.totalAmount).toLocaleString('fa-IR')}</TableCell>
                    <TableCell>
                      <Chip color={statusColors[invoice.status] || 'default'} size="sm" variant="flat">
                        {statusLabels[invoice.status] || invoice.status}
                      </Chip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardBody>
      </Card>

      <p className="text-xs text-foreground-400">
        قبض‌های صادر شده قابل ویرایش یا حذف نیستند.
      </p>
    </div>
  );
};

import { useState } from 'react';
export default ManageInvoicesPage;
