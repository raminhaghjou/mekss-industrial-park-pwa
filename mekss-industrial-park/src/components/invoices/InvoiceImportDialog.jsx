import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
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
  Alert,
  AlertContent,
  AlertTitle,
  AlertDescription,
} from '@heroui/react';
import { Download, FileSpreadsheet, Upload } from 'lucide-react';
import { invoiceApi } from '../../services/api/invoice.api';
import { saveResponseBlob } from '../../services/api/files.api';
import { getErrorMessage } from '../../utils/apiError';
import { invoiceItemLabel } from '../../constants/persianLabels';
import { useNotification } from '../../providers/NotificationProvider';
import { summarizeImportPreview } from './invoiceHelpers';

const MAX_BYTES = 2 * 1024 * 1024;
const money = (value) => Number(value || 0).toLocaleString('fa-IR');

/**
 * Excel bulk issuing: download template → pick file → server-side preview (rows with
 * errors in red) → confirm. Nothing is saved until the confirm step, and the server
 * saves either every row or none.
 * @param {{ open: boolean, onClose: () => void, isSuperAdmin?: boolean }} props
 */
export const InvoiceImportDialog = ({ open, onClose, isSuperAdmin = false }) => {
  const queryClient = useQueryClient();
  const { showNotification } = useNotification();
  const inputRef = useRef(null);
  const [target, setTarget] = useState('FACTORY');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) {
      setFile(null);
      setPreview(null);
      setBusy('');
      setError('');
      setTarget('FACTORY');
    }
  }, [open]);

  if (!open) return null;

  const resetFile = () => {
    setFile(null);
    setPreview(null);
    setError('');
    if (inputRef.current) inputRef.current.value = '';
  };

  const downloadTemplate = async () => {
    setBusy('template');
    try {
      const response = await invoiceApi.downloadImportTemplate({ target });
      saveResponseBlob(response, `mekss-invoices-${target.toLowerCase()}-template.xlsx`);
    } catch (err) {
      showNotification(getErrorMessage(err, 'دریافت قالب اکسل ناموفق بود'), 'error');
    } finally {
      setBusy('');
    }
  };

  const runPreview = async (selected) => {
    setError('');
    setPreview(null);
    if (!selected) return;
    if (!/\.xlsx$/i.test(selected.name)) {
      setError('فقط فایل اکسل با پسوند xlsx (قالب سامانه) پذیرفته می‌شود.');
      return;
    }
    if (selected.size > MAX_BYTES) {
      setError('حجم فایل بیش از ۲ مگابایت است.');
      return;
    }
    setFile(selected);
    setBusy('preview');
    try {
      const { data } = await invoiceApi.importInvoices(selected, { dryRun: true, target });
      setPreview(data);
    } catch (err) {
      setError(getErrorMessage(err, 'بررسی فایل ناموفق بود'));
    } finally {
      setBusy('');
    }
  };

  const commit = async () => {
    if (!file) return;
    setBusy('commit');
    try {
      const { data } = await invoiceApi.importInvoices(file, { dryRun: false, target });
      showNotification(`${money(data?.created)} قبض به مبلغ ${money(data?.totalAmount)} ریال صادر شد.`, 'success');
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      onClose();
    } catch (err) {
      setError(getErrorMessage(err, 'ثبت قبوض ناموفق بود؛ هیچ قبضی ثبت نشد.'));
    } finally {
      setBusy('');
    }
  };

  const { rows, invalid, validCount, canCommit } = summarizeImportPreview(preview);

  return (
    <ModalBackdrop isOpen={open} onOpenChange={(isOpen) => !isOpen && !busy && onClose()} isDismissable={!busy} variant="blur">
      <ModalContainer size="lg">
        <ModalDialog aria-label="صدور گروهی قبض با اکسل" className="max-h-[92dvh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-default-200 bg-background p-4 sm:p-6 dark:border-white/10">
          <ModalHeader className="flex items-center gap-2 text-lg font-bold text-foreground">
            <FileSpreadsheet className="h-5 w-5 text-[var(--color-brand)]" />
            <ModalHeading>صدور گروهی قبض با فایل اکسل</ModalHeading>
          </ModalHeader>
          <ModalBody className="gap-4">
            <ol className="flex flex-col gap-1 text-xs text-foreground-500">
              <li>۱. قالب اکسل را دانلود و ردیف‌ها را تکمیل کنید (ردیف نمونه را حذف کنید).</li>
              <li>۲. فایل را انتخاب کنید تا پیش‌نمایش و خطاهای هر ردیف نمایش داده شود.</li>
              <li>۳. اگر همهٔ ردیف‌ها درست بود، ثبت را تأیید کنید. ثبت «همه یا هیچ» است.</li>
            </ol>

            {isSuperAdmin && (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-foreground-600">گیرندگان:</span>
                {[
                  { id: 'FACTORY', label: 'واحدهای صنعتی (شناسه ملی)' },
                  { id: 'PARK', label: 'شهرک‌ها (نام دقیق شهرک)' },
                ].map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    disabled={Boolean(busy)}
                    onClick={() => {
                      setTarget(option.id);
                      resetFile();
                    }}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${target === option.id ? 'bg-[var(--color-brand)] text-white' : 'bg-default-100 text-foreground-600'}`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" className="gap-2" onPress={downloadTemplate} isDisabled={Boolean(busy)}>
                {busy === 'template' ? <Spinner size="sm" /> : <Download className="h-4 w-4" />}
                دانلود قالب اکسل
              </Button>
              <Button variant="tertiary" className="gap-2" onPress={() => inputRef.current?.click()} isDisabled={Boolean(busy)}>
                {busy === 'preview' ? <Spinner size="sm" /> : <Upload className="h-4 w-4" />}
                {file ? 'انتخاب فایل دیگر' : 'انتخاب فایل'}
              </Button>
              <input
                ref={inputRef}
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="hidden"
                data-testid="invoice-import-file"
                onChange={(e) => {
                  const selected = e.target.files?.[0] || null;
                  // Allow re-selecting the same (edited) file; otherwise no change event fires.
                  e.target.value = '';
                  runPreview(selected);
                }}
              />
              {file && <span className="self-center text-xs text-foreground-500" dir="ltr">{file.name}</span>}
            </div>

            {error && (
              <Alert status="danger">
                <AlertContent>
                  <AlertTitle>خطا</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </AlertContent>
              </Alert>
            )}

            {preview?.alreadyImported && (
              <Alert status="warning">
                <AlertContent>
                  <AlertTitle>این فایل قبلاً ثبت شده است</AlertTitle>
                  <AlertDescription>برای جلوگیری از صدور تکراری، همین فایل دوباره ثبت نمی‌شود.</AlertDescription>
                </AlertContent>
              </Alert>
            )}

            {preview && (
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap gap-3 text-xs">
                  <span className="rounded-lg bg-default-100 px-2 py-1">کل ردیف‌ها: {money(rows.length)}</span>
                  <span className="rounded-lg bg-success-50 px-2 py-1 text-success-800">سالم: {money(validCount)}</span>
                  <span className="rounded-lg bg-danger-50 px-2 py-1 text-danger-700">دارای خطا: {money(invalid.length)}</span>
                  <span className="rounded-lg bg-default-100 px-2 py-1">جمع ردیف‌های سالم: {money(preview.summary?.totalAmount)} ریال</span>
                </div>
                <div className="max-h-[45dvh] overflow-auto rounded-xl border border-default-200 dark:border-white/10">
                  <table className="w-full text-xs" data-testid="invoice-import-preview">
                    <thead className="sticky top-0 bg-default-100 text-foreground-600">
                      <tr>
                        <th className="px-2 py-2 text-start">ردیف</th>
                        <th className="px-2 py-2 text-start">{target === 'PARK' ? 'شهرک' : 'واحد'}</th>
                        <th className="px-2 py-2 text-start">اقلام</th>
                        <th className="px-2 py-2 text-start">جمع (ریال)</th>
                        <th className="px-2 py-2 text-start">مهلت</th>
                        <th className="px-2 py-2 text-start">وضعیت</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => {
                        const hasError = row.errors?.length > 0;
                        return (
                          <tr key={row.rowNumber} className={`border-t border-default-100 align-top ${hasError ? 'bg-danger-50 text-danger-800 dark:bg-danger-950/30' : ''}`} data-error={hasError ? 'true' : 'false'}>
                            <td className="px-2 py-2">{money(row.rowNumber)}</td>
                            <td className="px-2 py-2">
                              {row.targetName || '—'}
                              <span className="block text-[10px] text-foreground-500" dir="ltr">{row.key}</span>
                            </td>
                            <td className="px-2 py-2">{(row.items || []).map((item) => `${invoiceItemLabel(item)}: ${money(item.amount)}`).join('، ') || '—'}</td>
                            <td className="px-2 py-2 font-medium">{money(row.total)}</td>
                            <td className="px-2 py-2 whitespace-nowrap">{row.dueDateJalali || '—'}</td>
                            <td className="px-2 py-2">
                              {hasError ? (
                                <ul className="list-disc ps-4">
                                  {row.errors.map((message) => <li key={message}>{message}</li>)}
                                </ul>
                              ) : 'آماده ثبت'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </ModalBody>
          <ModalFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="tertiary" onPress={onClose} isDisabled={Boolean(busy)} className="w-full rounded-xl sm:w-auto">انصراف</Button>
            <Button variant="primary" onPress={commit} isDisabled={!canCommit || Boolean(busy)} className="w-full gap-2 rounded-xl font-bold sm:w-auto">
              {busy === 'commit' ? <Spinner size="sm" /> : null}
              ثبت {money(validCount)} قبض
            </Button>
          </ModalFooter>
        </ModalDialog>
      </ModalContainer>
    </ModalBackdrop>
  );
};

export default InvoiceImportDialog;
