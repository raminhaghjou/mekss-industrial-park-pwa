import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  Input,
  TextArea,
  Select,
  SelectTrigger,
  SelectValue,
  SelectIndicator,
  SelectPopover,
  ListBox,
  ListBoxItem,
  Label,
  Button,
  Alert,
  AlertContent,
  AlertTitle,
  AlertDescription,
  Spinner,
} from '@heroui/react';
import { Plus, Receipt, Trash2 } from 'lucide-react';
import { factoryApi } from '../../services/api/factory.api';
import { parkApi } from '../../services/api/park.api';
import { invoiceApi } from '../../services/api/invoice.api';
import { useAuth } from '../../providers/AuthProvider';
import { useNotification } from '../../providers/NotificationProvider';
import { getErrorMessage } from '../../utils/apiError';
import { amountInputToNumber, formatAmountInput } from '../../utils/amountFormat';
import JalaliDatePicker from '../../components/common/JalaliDatePicker';
import {
  CHARGE_ITEM_TYPES,
  OTHER_ITEM_TYPES,
  PLATFORM_ITEM_TYPES,
  invoiceCategoryLabels,
  invoiceItemTypeLabels,
} from '../../constants/persianLabels';

let rowSeed = 0;
const newRow = (type) => {
  rowSeed += 1;
  return { key: `row-${rowSeed}`, type, title: '', amount: '' };
};

const selectClass = 'h-11 w-full rounded-xl border border-default-200 bg-default-50 px-3 text-sm outline-none focus:ring-2 focus:ring-primary dark:border-white/10 dark:bg-white/5';

const CreateInvoicePage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { showNotification } = useNotification();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const category = isSuperAdmin ? 'PLATFORM' : 'CHARGE';
  const itemTypes = isSuperAdmin ? PLATFORM_ITEM_TYPES : CHARGE_ITEM_TYPES;

  const [targetType, setTargetType] = React.useState('FACTORY');
  const [factoryId, setFactoryId] = React.useState(searchParams.get('factoryId') || '');
  const [parkId, setParkId] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [rows, setRows] = React.useState(() => [newRow(itemTypes[0])]);
  const [taxAmount, setTaxAmount] = React.useState('');
  const [latePenaltyPerDay, setLatePenaltyPerDay] = React.useState('');
  const [dueDate, setDueDate] = React.useState('');

  const { data: factories, isLoading: loadingFactories, isError: factoriesError } = useQuery({
    queryKey: ['factories', 'managed'],
    queryFn: () => factoryApi.getFactories().then((res) => res.data),
    enabled: targetType === 'FACTORY',
  });

  const { data: parks, isLoading: loadingParks, isError: parksError } = useQuery({
    queryKey: ['parks', 'all'],
    queryFn: () => parkApi.getParks().then((res) => res.data),
    enabled: isSuperAdmin && targetType === 'PARK',
  });
  const parkList = Array.isArray(parks) ? parks : parks?.items || [];
  const factoryList = Array.isArray(factories) ? factories : factories?.items || [];

  const itemsTotal = rows.reduce((sum, row) => {
    const value = amountInputToNumber(row.amount);
    return Number.isFinite(value) ? sum + value : sum;
  }, 0);
  const taxValue = Number.isFinite(amountInputToNumber(taxAmount)) ? amountInputToNumber(taxAmount) : 0;
  const grandTotal = itemsTotal + taxValue;

  const updateRow = (key, patch) => setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  const removeRow = (key) => setRows((current) => (current.length > 1 ? current.filter((row) => row.key !== key) : current));
  const addRow = () => {
    const used = new Set(rows.map((row) => row.type));
    const nextType = itemTypes.find((type) => !used.has(type) || OTHER_ITEM_TYPES.includes(type)) || itemTypes[0];
    setRows((current) => (current.length >= 20 ? current : [...current, newRow(nextType)]));
  };

  const createMutation = useMutation({
    mutationFn: (/** @type {Record<string, any>} */ payload) => invoiceApi.createInvoice(payload),
    onSuccess: () => {
      showNotification('قبض با موفقیت صادر شد.', 'success');
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      navigate('/admin/finance');
    },
    onError: (err) => showNotification(getErrorMessage(err, 'صدور قبض ناموفق بود.'), 'error'),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (targetType === 'FACTORY' && !factoryId) {
      showNotification('انتخاب واحد صنعتی الزامی است.', 'error');
      return;
    }
    if (targetType === 'PARK' && !parkId) {
      showNotification('انتخاب شهرک صنعتی الزامی است.', 'error');
      return;
    }
    const items = [];
    for (const [index, row] of rows.entries()) {
      const amount = amountInputToNumber(row.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        showNotification(`مبلغ ردیف ${(index + 1).toLocaleString('fa-IR')} را وارد کنید.`, 'error');
        return;
      }
      if (OTHER_ITEM_TYPES.includes(row.type) && !row.title.trim()) {
        showNotification(`برای ردیف «سایر» (ردیف ${(index + 1).toLocaleString('fa-IR')}) عنوان بنویسید.`, 'error');
        return;
      }
      items.push({ type: row.type, amount, ...(OTHER_ITEM_TYPES.includes(row.type) ? { title: row.title.trim() } : {}) });
    }
    if (!dueDate) {
      showNotification('مهلت پرداخت را انتخاب کنید.', 'error');
      return;
    }
    const penalty = amountInputToNumber(latePenaltyPerDay);
    createMutation.mutate({
      targetType,
      ...(targetType === 'FACTORY' ? { factoryId } : { parkId }),
      items,
      ...(description.trim() ? { description: description.trim() } : {}),
      taxAmount: taxValue,
      latePenaltyPerDay: Number.isFinite(penalty) ? penalty : 0,
      dueDate,
    });
  };

  return (
    <div className="flex flex-col gap-6 max-w-3xl mx-auto">
      <Card className="border border-default-200 shadow-sm rounded-3xl p-2 dark:border-white/10 glass-card">
        <CardContent className="p-6 gap-6">
          <div className="flex items-center gap-3 border-b border-default-100 pb-4 dark:border-white/5">
            <div className="p-2.5 rounded-2xl bg-primary-50 dark:bg-primary-950/40 text-primary">
              <Receipt className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">فرم صدور قبض جدید</h1>
              <p className="text-xs text-foreground-500 mt-0.5">
                {invoiceCategoryLabels[category]}
                {' — '}
                {isSuperAdmin
                  ? 'ورودی، حق عضویت ماهانه و سایر برای واحد صنعتی یا شهرک'
                  : 'آب‌بها، فاضلاب‌بها، سهم نوسازی، بدهی سهام و سایر برای واحدهای شهرک'}
              </p>
            </div>
          </div>

          {(factoriesError || parksError) && (
            <Alert status="danger">
              <AlertContent>
                <AlertTitle>خطا</AlertTitle>
                <AlertDescription>دریافت فهرست گیرندگان ناموفق بود.</AlertDescription>
              </AlertContent>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            {isSuperAdmin && (
              <div className="flex flex-col gap-1">
                <Label className="text-xs font-medium text-foreground-600">گیرندهٔ صورتحساب</Label>
                <select
                  aria-label="گیرندهٔ صورتحساب"
                  value={targetType}
                  onChange={(e) => {
                    setTargetType(e.target.value);
                    setFactoryId('');
                    setParkId('');
                  }}
                  className={selectClass}
                >
                  <option value="FACTORY">واحد صنعتی</option>
                  <option value="PARK">شهرک صنعتی (مدیر شهرک پرداخت می‌کند)</option>
                </select>
              </div>
            )}

            {targetType === 'FACTORY' ? (
              <div className="flex flex-col gap-1">
                <Label className="text-xs font-medium text-foreground-600">انتخاب واحد صنعتی</Label>
                <Select
                  value={factoryId}
                  onChange={(value) => setFactoryId(String(value || ''))}
                  placeholder="واحد صنعتی مورد نظر را انتخاب کنید..."
                  variant="primary"
                  isDisabled={loadingFactories}
                  className="rounded-xl"
                >
                  <SelectTrigger>
                    <SelectValue />
                    <SelectIndicator />
                  </SelectTrigger>
                  <SelectPopover>
                    <ListBox>
                      {factoryList.map((factory) => (
                        <ListBoxItem key={factory.id} id={factory.id}>{factory.name}</ListBoxItem>
                      ))}
                    </ListBox>
                  </SelectPopover>
                </Select>
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                <Label className="text-xs font-medium text-foreground-600">انتخاب شهرک صنعتی</Label>
                <Select
                  value={parkId}
                  onChange={(value) => setParkId(String(value || ''))}
                  placeholder="شهرک مورد نظر را انتخاب کنید..."
                  variant="primary"
                  isDisabled={loadingParks}
                  className="rounded-xl"
                >
                  <SelectTrigger>
                    <SelectValue />
                    <SelectIndicator />
                  </SelectTrigger>
                  <SelectPopover>
                    <ListBox>
                      {parkList.map((park) => (
                        <ListBoxItem key={park.id} id={park.id}>{park.name}</ListBoxItem>
                      ))}
                    </ListBox>
                  </SelectPopover>
                </Select>
              </div>
            )}

            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-bold text-foreground">ردیف‌های قبض</Label>
                <Button type="button" size="sm" variant="secondary" onPress={addRow} isDisabled={rows.length >= 20} className="rounded-xl gap-1">
                  <Plus className="h-4 w-4" />
                  افزودن ردیف
                </Button>
              </div>
              {rows.map((row, index) => {
                const isOther = OTHER_ITEM_TYPES.includes(row.type);
                return (
                  <div key={row.key} className="grid grid-cols-1 sm:grid-cols-12 gap-2 rounded-2xl border border-default-200 p-3 dark:border-white/10" data-testid="invoice-item-row">
                    <div className="sm:col-span-4 flex flex-col gap-1">
                      <span className="text-[11px] text-foreground-500">نوع ردیف {(index + 1).toLocaleString('fa-IR')}</span>
                      <select
                        aria-label={`نوع ردیف ${index + 1}`}
                        value={row.type}
                        onChange={(e) => updateRow(row.key, { type: e.target.value, ...(OTHER_ITEM_TYPES.includes(e.target.value) ? {} : { title: '' }) })}
                        className={selectClass}
                      >
                        {itemTypes.map((type) => (
                          <option key={type} value={type}>{invoiceItemTypeLabels[type]}</option>
                        ))}
                      </select>
                    </div>
                    <div className={`${isOther ? 'sm:col-span-3' : 'sm:col-span-7'} flex flex-col gap-1`}>
                      <span className="text-[11px] text-foreground-500">مبلغ (ریال)</span>
                      <Input
                        aria-label={`مبلغ ردیف ${index + 1}`}
                        inputMode="numeric"
                        placeholder="مثلاً 1/500/000"
                        value={formatAmountInput(row.amount)}
                        onChange={(e) => updateRow(row.key, { amount: e.target.value })}
                        variant="primary"
                        dir="ltr"
                        className="rounded-xl"
                      />
                    </div>
                    {isOther && (
                      <div className="sm:col-span-4 flex flex-col gap-1">
                        <span className="text-[11px] text-foreground-500">عنوان «سایر»</span>
                        <Input
                          aria-label={`عنوان ردیف ${index + 1}`}
                          placeholder="مثلاً هزینه نگهبانی"
                          value={row.title}
                          maxLength={200}
                          onChange={(e) => updateRow(row.key, { title: e.target.value })}
                          variant="primary"
                          className="rounded-xl"
                        />
                      </div>
                    )}
                    <div className="sm:col-span-1 flex items-end justify-end">
                      <Button
                        type="button"
                        isIconOnly
                        variant="ghost"
                        aria-label={`حذف ردیف ${index + 1}`}
                        onPress={() => removeRow(row.key)}
                        isDisabled={rows.length === 1}
                        className="rounded-xl text-danger"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-col gap-1">
              <Label className="text-xs font-medium text-foreground-600">شرح قبض (اختیاری)</Label>
              <TextArea
                placeholder="اگر خالی بماند، از روی ردیف‌ها ساخته می‌شود"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                variant="primary"
                rows={2}
                className="rounded-xl"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <Label className="text-xs font-medium text-foreground-600">مبلغ مالیات (ریال)</Label>
                <Input
                  inputMode="numeric"
                  placeholder="اختیاری"
                  value={formatAmountInput(taxAmount)}
                  onChange={(e) => setTaxAmount(e.target.value)}
                  variant="primary"
                  dir="ltr"
                  className="rounded-xl"
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs font-medium text-foreground-600">جریمه تأخیر روزانه (ریال)</Label>
                <Input
                  inputMode="numeric"
                  placeholder="پس از مهلت، به ازای هر روز"
                  value={formatAmountInput(latePenaltyPerDay)}
                  onChange={(e) => setLatePenaltyPerDay(e.target.value)}
                  variant="primary"
                  dir="ltr"
                  className="rounded-xl"
                />
              </div>
            </div>

            <JalaliDatePicker
              label="مهلت پرداخت"
              value={dueDate}
              onChange={setDueDate}
              required
            />

            <div className="flex items-center justify-between rounded-2xl bg-primary-50 px-4 py-3 text-sm dark:bg-primary-950/30" data-testid="invoice-total">
              <span className="font-medium text-foreground-600">جمع کل قبض</span>
              <strong className="text-lg text-primary">{grandTotal.toLocaleString('fa-IR')} ریال</strong>
            </div>

            <div className="flex items-center justify-end gap-3 mt-2">
              <Button variant="tertiary" onPress={() => navigate('/admin/finance')} isDisabled={createMutation.isPending} className="rounded-xl font-medium">
                انصراف
              </Button>
              <Button type="submit" variant="primary" isDisabled={createMutation.isPending} className="rounded-xl font-bold px-6 shadow-md shadow-primary/20">
                {createMutation.isPending ? <Spinner size="sm" /> : 'صدور قبض'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default CreateInvoicePage;
