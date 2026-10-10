import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ModalBackdrop,
  ModalContainer,
  ModalDialog,
  ModalHeader,
  ModalHeading,
  ModalBody,
  ModalFooter,
  Button,
  Spinner,
  Input,
  TextArea,
  Label,
  Alert,
  AlertContent,
  AlertTitle,
  AlertDescription,
  Skeleton,
} from '@heroui/react';
import { Plus, Trash2 } from 'lucide-react';
import { invoiceApi } from '../../services/api/invoice.api';
import { getErrorMessage } from '../../utils/apiError';
import { amountInputToNumber, formatAmountInput } from '../../utils/amountFormat';
import { formatJalaliDate, todayIsoDate } from '../../utils/jalali';
import JalaliDatePicker from '../common/JalaliDatePicker';
import { InvoiceItemsList } from './InvoiceItemsList';
import { useNotification } from '../../providers/NotificationProvider';
import { INVOICE_OPERATION_TITLES, previewEvenSplit } from './invoiceHelpers';
import {
  CHARGE_ITEM_TYPES,
  OTHER_ITEM_TYPES,
  PLATFORM_ITEM_TYPES,
  invoiceAdjustmentTypeLabels,
  invoiceItemTypeLabels,
  invoiceStatusLabels,
  manualSettlementMethodLabels,
  roleLabels,
} from '../../constants/persianLabels';

const money = (value) => Number(value || 0).toLocaleString('fa-IR');
const isoDay = (value) => (value ? String(value).slice(0, 10) : '');
const noonUtc = (iso) => (iso ? `${iso}T12:00:00.000Z` : '');
const selectClass = 'h-11 w-full rounded-xl border border-default-200 bg-default-50 px-3 text-sm outline-none focus:ring-2 focus:ring-primary dark:border-white/10 dark:bg-white/5';

let seed = 0;
const rowKey = () => {
  seed += 1;
  return `op-row-${seed}`;
};

const Field = ({ label, children, hint = '' }) => (
  <div className="flex flex-col gap-1">
    <Label className="text-xs font-medium text-foreground-600">{label}</Label>
    {children}
    {hint && <span className="text-[11px] text-foreground-500">{hint}</span>}
  </div>
);

/**
 * One dialog for every financial operation on an invoice (issuer edit, discount,
 * installments, manual settlement, due-date extension) plus the adjustment history.
 * @param {{ invoice: any, mode: keyof typeof INVOICE_OPERATION_TITLES | null, onClose: () => void }} props
 */
export const InvoiceOperationDialog = ({ invoice, mode, onClose }) => {
  const open = Boolean(invoice && mode);
  const queryClient = useQueryClient();
  const { showNotification } = useNotification();
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  // edit
  const [items, setItems] = useState([]);
  const [amount, setAmount] = useState('');
  const [taxAmount, setTaxAmount] = useState('');
  const [penaltyPerDay, setPenaltyPerDay] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  // discount
  const [discount, setDiscount] = useState('');
  // installments
  const [splitMode, setSplitMode] = useState('even');
  const [count, setCount] = useState('3');
  const [firstDueDate, setFirstDueDate] = useState('');
  const [intervalDays, setIntervalDays] = useState('30');
  const [customRows, setCustomRows] = useState([]);
  // settle
  const [method, setMethod] = useState('CASH');
  const [reference, setReference] = useState('');
  const [paidAt, setPaidAt] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    setNote('');
    const editable = (invoice.items || []).filter((item) => item.type !== 'CARRIED_PENALTY');
    setItems(editable.map((item) => ({ key: rowKey(), type: item.type, title: item.title || '', amount: String(Math.round(Number(item.amount))) })));
    setAmount(String(Math.round(Number(invoice.amount || 0))));
    setTaxAmount(String(Math.round(Number(invoice.taxAmount || 0))));
    setPenaltyPerDay(String(Math.round(Number(invoice.latePenaltyPerDay || 0))));
    setDescription(invoice.description || '');
    setDueDate(isoDay(invoice.dueDate));
    setDiscount(String(Math.round(Number(invoice.discountAmount || 0))));
    setSplitMode('even');
    setCount('3');
    setFirstDueDate('');
    setIntervalDays('30');
    setCustomRows([{ key: rowKey(), amount: '', dueDate: '' }, { key: rowKey(), amount: '', dueDate: '' }]);
    setMethod('CASH');
    setReference('');
    setPaidAt(todayIsoDate());
  }, [open, invoice, mode]);

  const history = useQuery({
    queryKey: ['invoices', 'adjustments', invoice?.id],
    queryFn: () => invoiceApi.getAdjustments(invoice.id).then((res) => res.data),
    enabled: open && mode === 'history',
  });

  const category = invoice?.category === 'PLATFORM' ? 'PLATFORM' : 'CHARGE';
  const itemTypes = category === 'PLATFORM' ? PLATFORM_ITEM_TYPES : CHARGE_ITEM_TYPES;
  const carried = (invoice?.items || []).filter((item) => item.type === 'CARRIED_PENALTY');
  const carriedTotal = carried.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const lateDays = Number(invoice?.lateDays || 0);
  const latePenalty = Number(invoice?.latePenaltyAmount || 0);
  const netBase = Number(invoice?.totalAmount || 0);
  const grossBase = Number(invoice?.amount || 0) + Number(invoice?.taxAmount || 0);
  const discountCap = Math.max(0, grossBase - carriedTotal);

  const evenPreview = useMemo(() => previewEvenSplit(netBase, count), [netBase, count]);
  const customTotal = customRows.reduce((sum, row) => {
    const value = amountInputToNumber(row.amount);
    return Number.isFinite(value) ? sum + value : sum;
  }, 0);

  const mutation = useMutation({
    mutationFn: async () => {
      const withNote = (payload) => (note.trim() ? { ...payload, note: note.trim() } : payload);
      if (mode === 'edit') {
        /** @type {Record<string, unknown>} */
        const payload = {};
        if ((invoice.items || []).length) {
          payload.items = items.map((row) => ({
            type: row.type,
            amount: amountInputToNumber(row.amount),
            ...(OTHER_ITEM_TYPES.includes(row.type) ? { title: row.title.trim() } : {}),
          }));
        } else {
          payload.amount = amountInputToNumber(amount);
        }
        const tax = amountInputToNumber(taxAmount);
        payload.taxAmount = Number.isFinite(tax) ? tax : 0;
        const perDay = amountInputToNumber(penaltyPerDay);
        payload.latePenaltyPerDay = Number.isFinite(perDay) ? perDay : 0;
        if (description.trim() && description.trim() !== invoice.description) payload.description = description.trim();
        if (dueDate && dueDate !== isoDay(invoice.dueDate)) payload.dueDate = noonUtc(dueDate);
        return invoiceApi.updateInvoice(invoice.id, payload);
      }
      if (mode === 'discount') {
        return invoiceApi.discount(invoice.id, withNote({ discountAmount: Number.isFinite(amountInputToNumber(discount)) ? amountInputToNumber(discount) : 0 }));
      }
      if (mode === 'installments') {
        if (splitMode === 'even') {
          return invoiceApi.splitInstallments(invoice.id, withNote({
            count: Number(count),
            firstDueDate: noonUtc(firstDueDate),
            intervalDays: Number(intervalDays) || 30,
          }));
        }
        return invoiceApi.splitInstallments(invoice.id, withNote({
          installments: customRows.map((row) => ({ amount: amountInputToNumber(row.amount), dueDate: noonUtc(row.dueDate) })),
        }));
      }
      if (mode === 'settle') {
        return invoiceApi.settle(invoice.id, withNote({
          method,
          ...(reference.trim() ? { reference: reference.trim() } : {}),
          ...(paidAt && paidAt !== todayIsoDate() ? { paidAt: noonUtc(paidAt) } : {}),
        }));
      }
      if (mode === 'extend') {
        return invoiceApi.extendDue(invoice.id, withNote({ dueDate: noonUtc(dueDate) }));
      }
      return null;
    },
    onSuccess: () => {
      showNotification('عملیات با موفقیت ثبت شد.', 'success');
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      onClose();
    },
    onError: (err) => setError(getErrorMessage(err, 'ثبت عملیات ناموفق بود.')),
  });

  if (!open) return null;

  const validate = () => {
    if (mode === 'edit') {
      if ((invoice.items || []).length) {
        if (!items.length) return 'حداقل یک ردیف لازم است.';
        for (const [index, row] of items.entries()) {
          const value = amountInputToNumber(row.amount);
          if (!Number.isFinite(value) || value <= 0) return `مبلغ ردیف ${(index + 1).toLocaleString('fa-IR')} نامعتبر است.`;
          if (OTHER_ITEM_TYPES.includes(row.type) && !row.title.trim()) return 'برای ردیف «سایر» عنوان بنویسید.';
        }
      } else {
        const value = amountInputToNumber(amount);
        if (!Number.isFinite(value) || value <= 0) return 'مبلغ نامعتبر است.';
      }
      const perDay = amountInputToNumber(penaltyPerDay);
      if (lateDays > 0 && (!Number.isFinite(perDay) || perDay < Number(invoice.latePenaltyPerDay || 0))) {
        return 'جریمهٔ روزانه پس از شروع جریمه قابل کاهش یا صفر شدن نیست.';
      }
      if (!dueDate) return 'مهلت پرداخت را انتخاب کنید.';
    }
    if (mode === 'discount') {
      const value = amountInputToNumber(discount);
      if (!Number.isFinite(value) || value < 0) return 'مبلغ تخفیف نامعتبر است.';
      if (value > discountCap) return `سقف تخفیف ${money(discountCap)} ریال است.`;
    }
    if (mode === 'installments') {
      if (splitMode === 'even') {
        if (!Number.isInteger(Number(count)) || !evenPreview.length) return 'تعداد اقساط باید عددی صحیح بین ۲ تا ۳۶ باشد.';
        if (Number(count) > 36) return 'حداکثر ۳۶ قسط مجاز است.';
        if (intervalDays !== '' && (!Number.isInteger(Number(intervalDays)) || Number(intervalDays) < 1 || Number(intervalDays) > 365)) {
          return 'فاصلهٔ اقساط باید عددی صحیح بین ۱ تا ۳۶۵ روز باشد.';
        }
        if (!firstDueDate) return 'تاریخ قسط اول را انتخاب کنید.';
      } else {
        if (customRows.length < 2) return 'حداقل دو قسط لازم است.';
        if (customRows.some((row) => !row.dueDate || !(amountInputToNumber(row.amount) > 0))) return 'مبلغ و تاریخ همهٔ اقساط را وارد کنید.';
        if (Math.round(customTotal * 100) !== Math.round(netBase * 100)) return `جمع اقساط باید دقیقاً ${money(netBase)} ریال باشد.`;
      }
    }
    if (mode === 'extend') {
      if (!dueDate) return 'تاریخ جدید را انتخاب کنید.';
      if (dueDate <= isoDay(invoice.dueDate)) return 'تاریخ جدید باید بعد از مهلت فعلی باشد.';
    }
    return '';
  };

  const submit = () => {
    const message = validate();
    if (message) {
      setError(message);
      return;
    }
    setError('');
    mutation.mutate();
  };

  const noteField = (
    <Field label="توضیح (اختیاری)">
      <TextArea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={1000} className="rounded-xl" />
    </Field>
  );

  const summary = (
    <div className="grid grid-cols-2 gap-2 rounded-xl bg-default-50 p-3 text-xs dark:bg-white/5">
      <span className="text-foreground-500">قبض</span><span dir="ltr" className="text-end">{invoice.invoiceNumber}</span>
      <span className="text-foreground-500">مهلت فعلی</span><span className="text-end">{formatJalaliDate(invoice.dueDate)}</span>
      <span className="text-foreground-500">جمع خالص</span><span className="text-end">{money(netBase)} ریال</span>
      <span className="text-foreground-500">جریمهٔ تا امروز</span><span className={`text-end ${latePenalty > 0 ? 'text-danger' : ''}`}>{money(latePenalty)} ریال{lateDays ? ` (${money(lateDays)} روز)` : ''}</span>
      <span className="font-bold">قابل پرداخت</span><span className="text-end font-bold">{money(invoice.payableAmount ?? netBase)} ریال</span>
    </div>
  );

  let body = null;
  if (mode === 'edit') {
    body = (
      <>
        {summary}
        {(invoice.items || []).length ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-bold">ردیف‌ها</Label>
              <Button size="sm" variant="secondary" className="gap-1 rounded-xl" isDisabled={items.length >= 20} onPress={() => setItems((rows) => [...rows, { key: rowKey(), type: itemTypes[0], title: '', amount: '' }])}>
                <Plus className="h-4 w-4" />
                افزودن ردیف
              </Button>
            </div>
            {items.map((row, index) => (
              <div key={row.key} className="grid grid-cols-12 gap-2">
                <select aria-label={`نوع ردیف ${index + 1}`} className={`${selectClass} col-span-12 sm:col-span-4`} value={row.type} onChange={(e) => setItems((rows) => rows.map((r) => (r.key === row.key ? { ...r, type: e.target.value } : r)))}>
                  {itemTypes.map((type) => <option key={type} value={type}>{invoiceItemTypeLabels[type]}</option>)}
                </select>
                <Input aria-label={`مبلغ ردیف ${index + 1}`} dir="ltr" inputMode="numeric" className={`rounded-xl ${OTHER_ITEM_TYPES.includes(row.type) ? 'col-span-5 sm:col-span-3' : 'col-span-10 sm:col-span-7'}`} value={formatAmountInput(row.amount)} onChange={(e) => setItems((rows) => rows.map((r) => (r.key === row.key ? { ...r, amount: e.target.value } : r)))} />
                {OTHER_ITEM_TYPES.includes(row.type) && (
                  <Input aria-label={`عنوان ردیف ${index + 1}`} placeholder="عنوان" className="col-span-5 rounded-xl sm:col-span-4" value={row.title} maxLength={200} onChange={(e) => setItems((rows) => rows.map((r) => (r.key === row.key ? { ...r, title: e.target.value } : r)))} />
                )}
                <Button isIconOnly variant="ghost" aria-label={`حذف ردیف ${index + 1}`} className="col-span-2 rounded-xl text-danger sm:col-span-1" isDisabled={items.length === 1} onPress={() => setItems((rows) => rows.filter((r) => r.key !== row.key))}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            {carried.length > 0 && (
              <div className="rounded-xl border border-danger-200 bg-danger-50 p-2 text-xs text-danger-700">
                ردیف «جریمه تأخیر قبلی» ({money(carriedTotal)} ریال) قابل ویرایش یا حذف نیست.
              </div>
            )}
          </div>
        ) : (
          <Field label="مبلغ (ریال)">
            <Input dir="ltr" inputMode="numeric" className="rounded-xl" value={formatAmountInput(amount)} onChange={(e) => setAmount(e.target.value)} />
          </Field>
        )}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="مالیات (ریال)">
            <Input dir="ltr" inputMode="numeric" className="rounded-xl" value={formatAmountInput(taxAmount)} onChange={(e) => setTaxAmount(e.target.value)} />
          </Field>
          <Field label="جریمهٔ روزانه (ریال)" hint={lateDays > 0 ? 'جریمه شروع شده؛ فقط افزایش مجاز است.' : undefined}>
            <Input dir="ltr" inputMode="numeric" className="rounded-xl" value={formatAmountInput(penaltyPerDay)} onChange={(e) => setPenaltyPerDay(e.target.value)} />
          </Field>
        </div>
        <Field label="شرح">
          <TextArea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="rounded-xl" />
        </Field>
        <JalaliDatePicker label="مهلت پرداخت" value={dueDate} onChange={setDueDate} required />
        {lateDays > 0 && (
          <p className="text-[11px] text-danger">تغییر مهلت، جریمهٔ {money(lateDays)} روز گذشته را حذف نمی‌کند و جریمه از سررسید اولیه ادامه دارد.</p>
        )}
      </>
    );
  } else if (mode === 'discount') {
    body = (
      <>
        {summary}
        <Field label="مبلغ کل تخفیف (ریال)" hint={`سقف تخفیف: ${money(discountCap)} ریال (مبلغ پایه + مالیات). جریمهٔ تأخیر هرگز تخفیف نمی‌خورد.`}>
          <Input dir="ltr" inputMode="numeric" className="rounded-xl" value={formatAmountInput(discount)} onChange={(e) => setDiscount(e.target.value)} />
        </Field>
        {noteField}
      </>
    );
  } else if (mode === 'installments') {
    body = (
      <>
        {summary}
        {latePenalty > 0 && (
          <Alert status="warning">
            <AlertContent>
              <AlertTitle>انتقال جریمه</AlertTitle>
              <AlertDescription>جریمهٔ انباشته ({money(latePenalty)} ریال) به‌صورت ردیف «جریمه تأخیر قبلی» به قسط اول اضافه می‌شود.</AlertDescription>
            </AlertContent>
          </Alert>
        )}
        <div className="inline-flex rounded-xl bg-default-100 p-1 text-sm">
          {[{ id: 'even', label: 'اقساط مساوی' }, { id: 'custom', label: 'اقساط دلخواه' }].map((option) => (
            <button key={option.id} type="button" onClick={() => setSplitMode(option.id)} className={`rounded-lg px-3 py-1.5 ${splitMode === option.id ? 'bg-white font-bold text-[var(--color-brand)] shadow-sm dark:bg-white/10' : 'text-foreground-600'}`}>
              {option.label}
            </button>
          ))}
        </div>
        {splitMode === 'even' ? (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="تعداد اقساط (۲ تا ۳۶)">
                <Input type="number" min={2} max={36} dir="ltr" className="rounded-xl" value={count} onChange={(e) => setCount(e.target.value)} />
              </Field>
              <Field label="فاصلهٔ اقساط (روز)">
                <Input type="number" min={1} max={365} dir="ltr" className="rounded-xl" value={intervalDays} onChange={(e) => setIntervalDays(e.target.value)} />
              </Field>
            </div>
            <JalaliDatePicker label="مهلت قسط اول" value={firstDueDate} onChange={setFirstDueDate} required />
            {evenPreview.length > 0 && (
              <p className="text-xs text-foreground-500">
                مبلغ هر قسط: {money(evenPreview[0])} ریال
                {evenPreview[evenPreview.length - 1] !== evenPreview[0] ? ` (قسط آخر ${money(evenPreview[evenPreview.length - 1])} ریال)` : ''}
              </p>
            )}
          </>
        ) : (
          <div className="flex flex-col gap-2">
            {customRows.map((row, index) => (
              <div key={row.key} className="grid grid-cols-12 items-end gap-2">
                <div className="col-span-12 sm:col-span-5">
                  <Field label={`مبلغ قسط ${(index + 1).toLocaleString('fa-IR')}`}>
                    <Input dir="ltr" inputMode="numeric" className="rounded-xl" value={formatAmountInput(row.amount)} onChange={(e) => setCustomRows((rows) => rows.map((r) => (r.key === row.key ? { ...r, amount: e.target.value } : r)))} />
                  </Field>
                </div>
                <div className="col-span-10 sm:col-span-6">
                  <JalaliDatePicker label="مهلت" value={row.dueDate} onChange={(value) => setCustomRows((rows) => rows.map((r) => (r.key === row.key ? { ...r, dueDate: value } : r)))} />
                </div>
                <Button isIconOnly variant="ghost" aria-label={`حذف قسط ${index + 1}`} className="col-span-2 rounded-xl text-danger sm:col-span-1" isDisabled={customRows.length <= 2} onPress={() => setCustomRows((rows) => rows.filter((r) => r.key !== row.key))}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <div className="flex items-center justify-between text-xs">
              <Button size="sm" variant="secondary" className="gap-1 rounded-xl" isDisabled={customRows.length >= 36} onPress={() => setCustomRows((rows) => [...rows, { key: rowKey(), amount: '', dueDate: '' }])}>
                <Plus className="h-4 w-4" />
                افزودن قسط
              </Button>
              <span className={Math.round(customTotal * 100) === Math.round(netBase * 100) ? 'text-success-700' : 'text-danger'}>
                جمع: {money(customTotal)} از {money(netBase)} ریال
              </span>
            </div>
          </div>
        )}
        {noteField}
      </>
    );
  } else if (mode === 'settle') {
    body = (
      <>
        {summary}
        <Field label="روش پرداخت">
          <select aria-label="روش پرداخت" className={selectClass} value={method} onChange={(e) => setMethod(e.target.value)}>
            {Object.entries(manualSettlementMethodLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
        </Field>
        <Field label="شماره پیگیری / چک (اختیاری)">
          <Input dir="ltr" className="rounded-xl" value={reference} maxLength={120} onChange={(e) => setReference(e.target.value)} />
        </Field>
        <JalaliDatePicker label="تاریخ پرداخت" value={paidAt} onChange={setPaidAt} />
        <p className="text-[11px] text-foreground-500">جریمهٔ تأخیر تا تاریخ پرداخت محاسبه و همراه قبض تسویه می‌شود.</p>
        {noteField}
      </>
    );
  } else if (mode === 'extend') {
    body = (
      <>
        {summary}
        <JalaliDatePicker label="مهلت جدید" value={dueDate} onChange={setDueDate} required />
        {lateDays > 0 ? (
          <Alert status="warning">
            <AlertContent>
              <AlertTitle>جریمه ادامه دارد</AlertTitle>
              <AlertDescription>
                این قبض از {formatJalaliDate(invoice.penaltyStartsAt || invoice.dueDate)} مشمول جریمه است. با تمدید، جریمهٔ گذشته حذف نمی‌شود و برای روزهای تمدید هم ادامه پیدا می‌کند.
              </AlertDescription>
            </AlertContent>
          </Alert>
        ) : (
          <p className="text-[11px] text-foreground-500">چون مهلت فعلی هنوز نگذشته، جریمه از مهلت جدید شروع می‌شود.</p>
        )}
        {noteField}
      </>
    );
  } else if (mode === 'history') {
    const adjustments = history.data?.adjustments || [];
    const installments = history.data?.installments || [];
    body = history.isLoading ? (
      <div className="flex flex-col gap-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-14 rounded-xl" />)}</div>
    ) : history.isError ? (
      <Alert status="danger"><AlertContent><AlertTitle>خطا</AlertTitle><AlertDescription>{getErrorMessage(history.error, 'دریافت تاریخچه ناموفق بود')}</AlertDescription></AlertContent></Alert>
    ) : (
      <>
        <InvoiceItemsList items={invoice.items} />
        {installments.length > 0 && (
          <div className="flex flex-col gap-1">
            <Label className="text-sm font-bold">اقساط</Label>
            <ul className="divide-y divide-default-100 rounded-xl border border-default-200 text-xs dark:border-white/10">
              {installments.map((child) => (
                <li key={child.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                  <span>قسط {money(child.installmentNo)} · {formatJalaliDate(child.dueDate)}</span>
                  <span>{money(child.payableAmount)} ریال · {invoiceStatusLabels[child.status] || child.status}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {adjustments.length === 0 ? (
          <p className="text-sm text-foreground-500">هنوز تغییری روی این قبض ثبت نشده است.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {adjustments.map((row) => (
              <li key={row.id} className="rounded-xl border border-default-200 p-3 text-xs dark:border-white/10">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <strong className="text-sm">{invoiceAdjustmentTypeLabels[row.type] || row.type}</strong>
                  <span className="text-foreground-500">{new Date(row.createdAt).toLocaleString('fa-IR-u-ca-persian')}</span>
                </div>
                <p className="mt-1 text-foreground-500">
                  {row.actor?.name || '—'}{row.actor?.role ? ` (${roleLabels[row.actor.role] || row.actor.role})` : ''}
                  {row.amount !== null && row.amount !== undefined ? ` · ${money(row.amount)} ریال` : ''}
                  {row.fromDueDate && row.toDueDate ? ` · مهلت از ${formatJalaliDate(row.fromDueDate)} به ${formatJalaliDate(row.toDueDate)}` : ''}
                  {row.type === 'SETTLEMENT' && row.details?.method ? ` · ${manualSettlementMethodLabels[row.details.method] || row.details.method}` : ''}
                  {row.details?.reference ? ` · پیگیری ${row.details.reference}` : ''}
                </p>
                {row.note && <p className="mt-1">{row.note}</p>}
              </li>
            ))}
          </ul>
        )}
      </>
    );
  }

  return (
    <ModalBackdrop isOpen={open} onOpenChange={(isOpen) => !isOpen && !mutation.isPending && onClose()} isDismissable={!mutation.isPending} variant="blur">
      <ModalContainer size="lg">
        <ModalDialog aria-label={INVOICE_OPERATION_TITLES[mode]} className="max-h-[92dvh] overflow-y-auto rounded-2xl border border-default-200 bg-background p-4 sm:p-6 dark:border-white/10">
          <ModalHeader className="text-lg font-bold text-foreground">
            <ModalHeading>{INVOICE_OPERATION_TITLES[mode]}</ModalHeading>
          </ModalHeader>
          <ModalBody className="gap-3">
            {body}
            {error && (
              <Alert status="danger">
                <AlertContent>
                  <AlertTitle>خطا</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </AlertContent>
              </Alert>
            )}
          </ModalBody>
          <ModalFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="tertiary" onPress={onClose} isDisabled={mutation.isPending} className="w-full rounded-xl sm:w-auto">
              {mode === 'history' ? 'بستن' : 'انصراف'}
            </Button>
            {mode !== 'history' && (
              <Button variant="primary" onPress={submit} isDisabled={mutation.isPending} className="w-full gap-2 rounded-xl font-bold sm:w-auto">
                {mutation.isPending ? <Spinner size="sm" /> : null}
                ثبت
              </Button>
            )}
          </ModalFooter>
        </ModalDialog>
      </ModalContainer>
    </ModalBackdrop>
  );
};

export default InvoiceOperationDialog;
