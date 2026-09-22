import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  CardContent,
  Button,
  Chip,
  Skeleton,
  Alert,
  AlertContent,
  AlertTitle,
  AlertDescription,
  Spinner,
  Input,
  TextArea,
  Label,
} from '@heroui/react';
import {
  Building2,
  CheckCircle2,
  MessageSquare,
  Plus,
  Receipt,
  Send,
  TriangleAlert,
  Wallet,
  Bell,
} from 'lucide-react';
import { invoiceApi } from '../../services/api/invoice.api';
import { messageApi } from '../../services/api/message.api';
import { getErrorMessage } from '../../utils/apiError';
import { EmptyState } from '../../components/common/EmptyState';
import { useNotification } from '../../providers/NotificationProvider';
import { invoiceStatusLabels } from '../../constants/persianLabels';

const statusColors = {
  PENDING: 'warning',
  PAID: 'success',
  OVERDUE: 'danger',
  CANCELLED: 'default',
};

const formatRial = (value) => `${Number(value || 0).toLocaleString('fa-IR')} ریال`;

/**
 * Park-manager / SA accounting hub:
 * - Collectible factory-unit invoices (paid + unpaid)
 * - Per-unit messaging for financial follow-up
 */
export const FinanceAccountingPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showNotification } = useNotification();
  const [tab, setTab] = useState('unpaid');
  const [composeFor, setComposeFor] = useState(null);
  const [compose, setCompose] = useState({ subject: '', body: '' });

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['invoices', 'managed'],
    queryFn: () => invoiceApi.getInvoices({ scope: 'managed' }).then((res) => res.data || []),
  });

  const invoices = data || [];

  const stats = useMemo(() => {
    const unpaid = invoices.filter((inv) => inv.status === 'PENDING' || inv.status === 'OVERDUE');
    const paid = invoices.filter((inv) => inv.status === 'PAID');
    const unpaidTotal = unpaid.reduce((sum, inv) => sum + Number(inv.payableAmount ?? inv.totalAmount ?? 0), 0);
    const paidTotal = paid.reduce((sum, inv) => sum + Number(inv.totalAmount ?? 0), 0);
    const factoryIds = new Set(unpaid.map((inv) => inv.factoryId).filter(Boolean));
    return {
      unpaidCount: unpaid.length,
      unpaidTotal,
      paidCount: paid.length,
      paidTotal,
      unitsWithDebt: factoryIds.size,
      allCount: invoices.length,
    };
  }, [invoices]);

  const filtered = useMemo(() => {
    if (tab === 'unpaid') return invoices.filter((inv) => inv.status === 'PENDING' || inv.status === 'OVERDUE');
    if (tab === 'paid') return invoices.filter((inv) => inv.status === 'PAID');
    if (tab === 'overdue') return invoices.filter((inv) => inv.status === 'OVERDUE');
    return invoices;
  }, [invoices, tab]);

  const byFactory = useMemo(() => {
    const map = new Map();
    for (const inv of filtered) {
      const key = inv.factoryId || 'unknown';
      if (!map.has(key)) {
        map.set(key, {
          factoryId: inv.factoryId,
          factoryName: inv.factory?.name || 'واحد نامشخص',
          managerId: inv.factory?.managerId || null,
          invoices: [],
          unpaidTotal: 0,
        });
      }
      const row = map.get(key);
      row.invoices.push(inv);
      if (inv.status === 'PENDING' || inv.status === 'OVERDUE') {
        row.unpaidTotal += Number(inv.payableAmount ?? inv.totalAmount ?? 0);
      }
    }
    return [...map.values()].sort((a, b) => b.unpaidTotal - a.unpaidTotal || a.factoryName.localeCompare(b.factoryName, 'fa'));
  }, [filtered]);

  const sendMutation = useMutation({
    mutationFn: (payload) => messageApi.sendMessage(payload),
    onSuccess: () => {
      showNotification('پیام مالی برای مدیر واحد ارسال شد', 'success');
      setComposeFor(null);
      setCompose({ subject: '', body: '' });
      queryClient.invalidateQueries({ queryKey: ['messages'] });
    },
    onError: (err) => showNotification(getErrorMessage(err, 'ارسال پیام ناموفق بود'), 'error'),
  });

  const openCompose = (unit) => {
    if (!unit.managerId) {
      showNotification('مدیر این واحد برای پیام‌رسانی یافت نشد', 'error');
      return;
    }
    setComposeFor(unit);
    setCompose({
      subject: `پیگیری مالی — ${unit.factoryName}`,
      body: unit.unpaidTotal > 0
        ? `با سلام،\nمجموع بدهی معوق واحد «${unit.factoryName}» برابر ${formatRial(unit.unpaidTotal)} است. لطفاً در اسرع وقت نسبت به تسویه اقدام فرمایید.\n`
        : `با سلام،\nدر خصوص وضعیت مالی واحد «${unit.factoryName}» با شما در ارتباط هستیم.\n`,
    });
  };

  const tabs = [
    { id: 'unpaid', label: 'پرداخت‌نشده', count: stats.unpaidCount },
    { id: 'overdue', label: 'سررسید گذشته', count: invoices.filter((i) => i.status === 'OVERDUE').length },
    { id: 'paid', label: 'پرداخت‌شده', count: stats.paidCount },
    { id: 'all', label: 'همه', count: stats.allCount },
  ];

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div className="page-toolbar">
        <div>
          <h1 className="text-xl font-bold text-foreground sm:text-2xl">حسابداری و مالی</h1>
          <p className="mt-1 text-sm text-foreground-500">
            مدیریت مطالبات واحدهای صنعتی، وضعیت پرداخت و پیگیری مالی
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            className="gap-2 font-bold"
            onPress={() => navigate('/admin/announcements')}
          >
            <Bell className="h-4 w-4" />
            اطلاعیه مالی
          </Button>
          <Button
            variant="primary"
            className="gap-2 font-bold"
            onPress={() => navigate('/admin/invoices/create')}
          >
            <Plus className="h-4 w-4" />
            صدور قبض واحد
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          icon={TriangleAlert}
          tone="danger"
          label="بدهی معوق واحدها"
          value={formatRial(stats.unpaidTotal)}
          hint={`${stats.unpaidCount.toLocaleString('fa-IR')} قبض · ${stats.unitsWithDebt.toLocaleString('fa-IR')} واحد`}
        />
        <SummaryCard
          icon={Building2}
          tone="warning"
          label="واحدهای بدهکار"
          value={stats.unitsWithDebt.toLocaleString('fa-IR')}
          hint="واحدهایی با حداقل یک قبض باز"
        />
        <SummaryCard
          icon={CheckCircle2}
          tone="success"
          label="وصول‌شده"
          value={formatRial(stats.paidTotal)}
          hint={`${stats.paidCount.toLocaleString('fa-IR')} قبض پرداخت‌شده`}
        />
        <SummaryCard
          icon={Wallet}
          tone="primary"
          label="کل قبض‌های صادره"
          value={stats.allCount.toLocaleString('fa-IR')}
          hint="همه وضعیت‌ها"
        />
      </div>

      <div className="inline-flex flex-wrap rounded-xl bg-default-100 p-1">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              tab === item.id ? 'bg-white text-[var(--color-brand)] shadow-sm' : 'text-foreground-600'
            }`}
          >
            <span className="inline-flex items-center gap-2">
              {item.label}
              <span className="rounded-full bg-default-200 px-1.5 py-0.5 text-[10px] font-bold">
                {item.count.toLocaleString('fa-IR')}
              </span>
            </span>
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
        </div>
      ) : isError ? (
        <Alert status="danger">
          <AlertContent>
            <AlertTitle>خطا در دریافت اطلاعات مالی</AlertTitle>
            <AlertDescription>{getErrorMessage(error, 'دریافت قبض‌ها ناموفق بود.')}</AlertDescription>
          </AlertContent>
        </Alert>
      ) : byFactory.length === 0 ? (
        <EmptyState
          icon={<Receipt className="h-6 w-6" />}
          title="قبضی در این وضعیت وجود ندارد"
          description="با صدور قبض جدید برای واحدهای صنعتی، وضعیت مطالبات اینجا نمایش داده می‌شود."
        />
      ) : (
        <div className="flex flex-col gap-4">
          {byFactory.map((unit) => (
            <Card key={unit.factoryId || unit.factoryName} className="rounded-2xl border border-default-200">
              <CardContent className="p-0">
                <div className="flex flex-col gap-3 border-b border-default-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Building2 className="h-4 w-4 text-[var(--color-brand)]" />
                      <h2 className="truncate font-bold text-foreground">{unit.factoryName}</h2>
                      {unit.unpaidTotal > 0 && (
                        <Chip size="sm" color="danger" variant="soft">
                          بدهی {formatRial(unit.unpaidTotal)}
                        </Chip>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-foreground-500">
                      {unit.invoices.length.toLocaleString('fa-IR')} قبض در این فهرست
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      className="gap-1.5 font-bold"
                      onPress={() => openCompose(unit)}
                    >
                      <MessageSquare className="h-3.5 w-3.5" />
                      پیام به مدیر واحد
                    </Button>
                    <Button
                      size="sm"
                      variant="tertiary"
                      className="gap-1.5"
                      onPress={() => navigate(`/admin/invoices/create?factoryId=${unit.factoryId || ''}`)}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      قبض جدید
                    </Button>
                  </div>
                </div>

                {composeFor?.factoryId === unit.factoryId && (
                  <form
                    className="flex flex-col gap-3 border-b border-default-100 bg-default-50/60 px-4 py-4"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!compose.subject.trim() || !compose.body.trim()) {
                        showNotification('موضوع و متن پیام الزامی است', 'error');
                        return;
                      }
                      sendMutation.mutate({
                        receiverId: unit.managerId,
                        subject: compose.subject.trim(),
                        body: compose.body.trim(),
                      });
                    }}
                  >
                    <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                      <Send className="h-4 w-4 text-[var(--color-brand)]" />
                      ارسال پیام مالی به مدیر «{unit.factoryName}»
                    </div>
                    <div className="flex flex-col gap-1">
                      <Label className="text-xs">موضوع</Label>
                      <Input
                        value={compose.subject}
                        onChange={(e) => setCompose((p) => ({ ...p, subject: e.target.value }))}
                        className="rounded-xl"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <Label className="text-xs">متن</Label>
                      <TextArea
                        value={compose.body}
                        onChange={(e) => setCompose((p) => ({ ...p, body: e.target.value }))}
                        rows={4}
                        className="rounded-xl"
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="tertiary" onPress={() => setComposeFor(null)}>انصراف</Button>
                      <Button type="submit" variant="primary" className="gap-2 font-bold" isDisabled={sendMutation.isPending}>
                        {sendMutation.isPending ? <Spinner size="sm" /> : <Send className="h-4 w-4" />}
                        ارسال
                      </Button>
                    </div>
                  </form>
                )}

                <ul className="divide-y divide-default-100">
                  {unit.invoices.map((inv) => (
                    <li key={inv.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-foreground">{inv.description}</span>
                          <Chip size="sm" color={statusColors[inv.status] || 'default'} variant="soft">
                            {invoiceStatusLabels[inv.status] || inv.status}
                          </Chip>
                        </div>
                        <p className="mt-1 text-xs text-foreground-500">
                          {inv.invoiceNumber}
                          {' · '}
                          سررسید {new Date(inv.dueDate).toLocaleDateString('fa-IR')}
                          {inv.paymentDate ? ` · پرداخت ${new Date(inv.paymentDate).toLocaleDateString('fa-IR')}` : ''}
                        </p>
                      </div>
                      <div className="text-start sm:text-end">
                        <p className="font-bold text-foreground">
                          {formatRial(inv.payableAmount ?? inv.totalAmount)}
                        </p>
                        {Number(inv.latePenaltyAmount || 0) > 0 && (
                          <p className="text-[11px] text-danger-600">
                            شامل جریمه {formatRial(inv.latePenaltyAmount)}
                          </p>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

const SummaryCard = ({ icon: Icon, tone, label, value, hint }) => {
  const tones = {
    danger: 'bg-danger-50 text-danger-700 border-danger-100',
    warning: 'bg-warning-50 text-warning-800 border-warning-100',
    success: 'bg-success-50 text-success-800 border-success-100',
    primary: 'bg-[var(--color-brand-soft)] text-[var(--color-brand)] border-[var(--color-brand)]/20',
  };
  return (
    <Card className={`rounded-2xl border ${tones[tone] || tones.primary}`}>
      <CardContent className="flex items-start gap-3 p-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/70">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium opacity-80">{label}</p>
          <p className="mt-1 truncate text-base font-bold">{value}</p>
          <p className="mt-0.5 text-[11px] opacity-70">{hint}</p>
        </div>
      </CardContent>
    </Card>
  );
};

export default FinanceAccountingPage;
