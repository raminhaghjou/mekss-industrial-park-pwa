import { useQuery } from '@tanstack/react-query';
import { Card, CardBody, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, Chip, Skeleton, Alert, Tabs, Tab } from '@heroui/react';
import { Receipt } from 'lucide-react';
import { invoiceApi } from '../../services/api/invoice.api';
import { getErrorMessage } from '../../utils/apiError';
import { EmptyState } from '../../components/common/EmptyState';

const statusColors = { PENDING: 'warning', PAID: 'success', OVERDUE: 'danger', CANCELLED: 'default' };
const statusLabels = { PENDING: 'پرداخت نشده', PAID: 'پرداخت شده', OVERDUE: 'سررسید گذشته', CANCELLED: 'لغو شده' };

export const InvoicesPage = () => {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => invoiceApi.getInvoices().then((res) => res.data),
  });

  const invoices = data || [];

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <h1 className="text-2xl font-bold text-foreground">قبض‌ها</h1>

      <Card>
        <CardBody className="p-0">
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
          ) : invoices.length === 0 ? (
            <EmptyState
              icon={<Receipt className="h-6 w-6" />}
              title="هیچ قبضی برای نمایش وجود ندارد"
              description="قبض‌های صادر شده در این فهرست نمایش داده می‌شوند."
            />
          ) : (
            <Table removeWrapper aria-label="قبض‌ها">
              <TableHeader>
                <TableColumn>شماره قبض</TableColumn>
                <TableColumn>شرح</TableColumn>
                <TableColumn>مبلغ (ریال)</TableColumn>
                <TableColumn>وضعیت</TableColumn>
              </TableHeader>
              <TableBody>
                {invoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell dir="ltr">{invoice.invoiceNumber}</TableCell>
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
    </div>
  );
};

export default InvoicesPage;
