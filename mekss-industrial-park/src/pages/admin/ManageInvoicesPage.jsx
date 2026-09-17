import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Card, CardContent, Table, TableContent, TableHeader, TableColumn, TableBody, TableRow, TableCell,
  Button, Chip, Skeleton, Alert, AlertContent, AlertTitle, AlertDescription, Input, Label, Spinner,
} from '@heroui/react';
import { Plus, Receipt, Pencil } from 'lucide-react';
import { invoiceApi } from '../../services/api/invoice.api';
import { getErrorMessage } from '../../utils/apiError';
import { EmptyState } from '../../components/common/EmptyState';
import { ResponsiveTable } from '../../components/common/ResponsiveTable';
import { useNotification } from '../../providers/NotificationProvider';
import { formatAmountInput, amountInputToNumber } from '../../utils/amountFormat';
import JalaliDatePicker from '../../components/common/JalaliDatePicker';

const statusColors = { PENDING: 'warning', PAID: 'success', OVERDUE: 'danger', CANCELLED: 'default' };
const statusLabels = { PENDING: 'پرداخت نشده', PAID: 'پرداخت شده', OVERDUE: 'سررسید گذشته', CANCELLED: 'لغو شده' };

export const ManageInvoicesPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showNotification } = useNotification();
  const [tab, setTab] = useState('all');
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ amount: '', taxAmount: '', description: '', dueDate: '', status: 'PENDING' });

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['invoices', 'managed'],
    queryFn: () => invoiceApi.getInvoices().then((res) => res.data),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => invoiceApi.updateInvoice(id, payload),
    onSuccess: () => {
      showNotification('قبض به‌روز شد', 'success');
      setEditing(null);
      queryClient.invalidateQueries({ queryKey: ['invoices', 'managed'] });
    },
    onError: (err) => showNotification(getErrorMessage(err, 'ویرایش قبض ناموفق بود'), 'error'),
  });

  const invoices = data || [];
  const filteredInvoices = invoices.filter((inv) => {
    if (tab === 'all') return true;
    if (tab === 'unpaid') return inv.status === 'PENDING' || inv.status === 'OVERDUE';
    if (tab === 'paid') return inv.status === 'PAID';
    return false;
  });

  const openEdit = (invoice) => {
    if (invoice.status === 'PAID') {
      showNotification('قبض پرداخت‌شده قابل ویرایش نیست', 'error');
      return;
    }
    setEditing(invoice);
    setForm({
      amount: formatAmountInput(String(invoice.amount)),
      taxAmount: formatAmountInput(String(invoice.taxAmount || 0)),
      description: invoice.description || '',
      dueDate: invoice.dueDate ? String(invoice.dueDate).slice(0, 10) : '',
      status: invoice.status === 'CANCELLED' ? 'CANCELLED' : invoice.status === 'OVERDUE' ? 'OVERDUE' : 'PENDING',
    });
  };

  const submitEdit = (e) => {
    e.preventDefault();
    const amount = amountInputToNumber(form.amount);
    const taxAmount = amountInputToNumber(form.taxAmount) || 0;
    if (!Number.isFinite(amount) || amount <= 0 || !form.description.trim() || !form.dueDate) {
      showNotification('مقادیر قبض معتبر نیست', 'error');
      return;
    }
    updateMutation.mutate({
      id: editing.id,
      payload: {
        amount,
        taxAmount,
        description: form.description.trim(),
        dueDate: form.dueDate,
        status: form.status,
      },
    });
  };

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
            {[
              { id: 'all', label: 'همه' },
              { id: 'unpaid', label: 'پرداخت نشده' },
              { id: 'paid', label: 'پرداخت شده' },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => setTab(item.id)}
                className={`px-4 py-2 text-sm font-medium rounded-xl transition-colors ${tab === item.id ? 'bg-primary text-white font-bold' : 'text-foreground-500 hover:bg-default-100'}`}
              >
                {item.label}
              </button>
            ))}
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
                    <TableColumn>عملیات</TableColumn>
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
                        <TableCell>
                          <Button
                            size="sm"
                            variant="tertiary"
                            isDisabled={invoice.status === 'PAID'}
                            onPress={() => openEdit(invoice)}
                          >
                            <Pencil className="h-4 w-4" />
                            ویرایش
                          </Button>
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

      {editing && (
        <Card className="rounded-2xl border border-[var(--color-brand)]">
          <CardContent className="gap-4 p-5">
            <h2 className="font-bold">ویرایش قبض {editing.invoiceNumber}</h2>
            <form className="grid gap-3 md:grid-cols-2" onSubmit={submitEdit}>
              <div className="flex flex-col gap-1">
                <Label className="text-xs">مبلغ</Label>
                <Input
                  dir="ltr"
                  className="rounded-xl font-mono"
                  value={form.amount}
                  onChange={(e) => setForm((p) => ({ ...p, amount: formatAmountInput(e.target.value) }))}
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs">مالیات</Label>
                <Input
                  dir="ltr"
                  className="rounded-xl font-mono"
                  value={form.taxAmount}
                  onChange={(e) => setForm((p) => ({ ...p, taxAmount: formatAmountInput(e.target.value) }))}
                />
              </div>
              <div className="flex flex-col gap-1 md:col-span-2">
                <Label className="text-xs">شرح</Label>
                <Input
                  className="rounded-xl"
                  value={form.description}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                />
              </div>
              <JalaliDatePicker label="سررسید" value={form.dueDate} onChange={(dueDate) => setForm((p) => ({ ...p, dueDate }))} />
              <div className="flex flex-col gap-1">
                <Label className="text-xs">وضعیت</Label>
                <select
                  className="h-11 rounded-xl border border-default-200 bg-default-50 px-3 text-sm"
                  value={form.status}
                  onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
                >
                  <option value="PENDING">پرداخت نشده</option>
                  <option value="OVERDUE">سررسید گذشته</option>
                  <option value="CANCELLED">لغو شده</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 md:col-span-2">
                <Button type="button" variant="tertiary" onPress={() => setEditing(null)}>انصراف</Button>
                <Button type="submit" variant="primary" className="font-bold" isDisabled={updateMutation.isPending}>
                  {updateMutation.isPending ? <Spinner size="sm" /> : 'ذخیره تغییرات'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ManageInvoicesPage;
