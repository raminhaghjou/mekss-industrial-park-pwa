import React, { useEffect, useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  CardContent,
  Input,
  Select,
  SelectTrigger,
  SelectValue,
  SelectIndicator,
  SelectPopover,
  ListBox,
  ListBoxItem,
  Label,
  TextArea,
  Button,
  Alert,
  AlertContent,
  AlertTitle,
  AlertDescription,
  Spinner,
} from '@heroui/react';
import { ArrowRight } from 'lucide-react';
import { factoryApi } from '../../services/api/factory.api';
import { gatePassApi } from '../../services/api/gatePass.api';
import { settingsApi } from '../../services/api/settings.api';
import { useNotification } from '../../providers/NotificationProvider';
import { getErrorMessage } from '../../utils/apiError';
import JalaliDatePicker from '../common/JalaliDatePicker';
import IranLicensePlateInput from '../common/IranLicensePlateInput';
import { isCompleteIranLicensePlate } from '../../utils/iranLicensePlate';
import { ConfirmDialog } from '../common/ConfirmDialog';

const cargoTypes = [
  { value: 'RAW_MATERIALS', label: 'مواد اولیه' },
  { value: 'FINISHED_GOODS', label: 'محصول نهایی' },
  { value: 'WASTE', label: 'ضایعات' },
  { value: 'SUPPLIES', label: 'ملزومات' },
  { value: 'EQUIPMENT', label: 'تجهیزات' },
  { value: 'OTHER', label: 'سایر' },
];

const vehicleTypes = [
  { value: 'TRUCK', label: 'کامیون' },
  { value: 'VAN', label: 'وانت' },
  { value: 'CAR', label: 'سواری' },
  { value: 'MOTORCYCLE', label: 'موتورسیکلت' },
  { value: 'OTHER', label: 'سایر' },
];

const emptyForm = {
  factoryId: '', cargoType: 'RAW_MATERIALS', cargoDescription: '', driverName: '', driverNationalId: '',
  driverPhone: '', vehicleType: 'TRUCK', licensePlate: '', exitDate: '',
};

const FormSelect = ({ label, value, onChange, options, isDisabled = false, isRequired = false, placeholder = 'انتخاب کنید' }) => (
  <div className="flex flex-col gap-1">
    <Label className="text-xs font-medium text-foreground-600">{label}</Label>
    <Select
      value={value || null}
      onChange={(key) => onChange(key == null ? '' : String(key))}
      placeholder={placeholder}
      variant="primary"
      isDisabled={isDisabled}
      isRequired={isRequired}
      className="rounded-xl"
    >
      <SelectTrigger>
        <SelectValue />
        <SelectIndicator />
      </SelectTrigger>
      <SelectPopover>
        <ListBox>
          {options.map((option) => (
            <ListBoxItem key={option.value} id={option.value}>{option.label}</ListBoxItem>
          ))}
        </ListBox>
      </SelectPopover>
    </Select>
  </div>
);

const FormInput = ({ label, isRequired, ...props }) => (
  <div className="flex flex-col gap-1">
    <Label className="text-xs font-medium text-foreground-600">{label}</Label>
    <Input variant="primary" className="rounded-xl" required={isRequired} {...props} />
  </div>
);

const isInsufficientWalletError = (err) => {
  const errorCode = err?.response?.data?.error;
  const message = String(err?.response?.data?.message || '');
  return errorCode === 'INSUFFICIENT_GATE_PASS_WALLET' || message.includes('موجودی کیف‌پول برگ خروج کافی نیست');
};

const CreateGatePassForm = ({ handleBack, initialPass = null }) => {
  const isEdit = Boolean(initialPass?.id);
  const navigate = useNavigate();
  const { showNotification } = useNotification();
  const queryClient = useQueryClient();
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [form, setForm] = useState(() => (initialPass ? {
    factoryId: initialPass.factoryId || '',
    cargoType: initialPass.cargoType || 'RAW_MATERIALS',
    cargoDescription: initialPass.cargoDescription || '',
    driverName: initialPass.driverName || '',
    driverNationalId: initialPass.driverNationalId || '',
    driverPhone: initialPass.driverPhone || '',
    vehicleType: initialPass.vehicleType || 'TRUCK',
    licensePlate: initialPass.licensePlate || '',
    exitDate: initialPass.exitDate || '',
  } : emptyForm));

  const { data: factories, isLoading: loadingFactories, isError: factoriesError } = useQuery({
    queryKey: ['factories', 'managed'],
    queryFn: () => factoryApi.getFactories().then((res) => res.data),
  });

  const { data: walletSettings } = useQuery({
    queryKey: ['settings', 'gate-pass-wallet'],
    queryFn: () => settingsApi.getGatePassWallet().then((res) => res.data),
    enabled: !isEdit,
  });

  const { data: wallet } = useQuery({
    queryKey: ['factory-wallet', form.factoryId],
    queryFn: () => factoryApi.getWallet(form.factoryId).then((res) => res.data),
    enabled: !isEdit && Boolean(form.factoryId),
  });

  const requireWallet = walletSettings?.requireWalletBalance !== false;
  const fee = Number(walletSettings?.fee || 0);
  const balance = Number(wallet?.balance ?? NaN);
  const walletBlocked = !isEdit
    && requireWallet
    && fee > 0
    && form.factoryId
    && Number.isFinite(balance)
    && balance < fee;

  useEffect(() => {
    if (walletBlocked) setWalletModalOpen(true);
  }, [walletBlocked]);

  useEffect(() => {
    if (isEdit || form.factoryId || !factories?.length) return;
    if (factories.length === 1) {
      setForm((prev) => ({ ...prev, factoryId: factories[0].id }));
    }
  }, [factories, form.factoryId, isEdit]);

  const saveMutation = useMutation({
    mutationFn: (/** @type {typeof emptyForm} */ payload) => (
      isEdit
        ? gatePassApi.updateGatePass(initialPass.id, {
            cargoType: payload.cargoType,
            cargoDescription: payload.cargoDescription,
            driverName: payload.driverName,
            driverNationalId: payload.driverNationalId,
            driverPhone: payload.driverPhone,
            vehicleType: payload.vehicleType,
            licensePlate: payload.licensePlate,
            exitDate: payload.exitDate,
          })
        : gatePassApi.createGatePass(payload)
    ),
    onSuccess: () => {
      showNotification(
        isEdit
          ? 'برگ خروج با موفقیت به‌روز شد.'
          : 'برگ خروج ثبت شد و برای تایید نگهبان ارسال گردید.',
        'success',
      );
      queryClient.invalidateQueries({ queryKey: ['gate-passes'] });
      queryClient.invalidateQueries({ queryKey: ['factory-wallet'] });
      handleBack();
    },
    onError: (err) => {
      if (isInsufficientWalletError(err)) {
        setWalletModalOpen(true);
        return;
      }
      showNotification(getErrorMessage(err, isEdit ? 'ویرایش برگ خروج ناموفق بود.' : 'ثبت برگ خروج ناموفق بود.'), 'error');
    },
  });

  const handleChange = (name, value) => setForm((prev) => ({ ...prev, [name]: value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    const required = ['factoryId', 'cargoType', 'driverName', 'driverNationalId', 'driverPhone', 'vehicleType', 'licensePlate', 'exitDate'];
    if (required.some((field) => !form[field])) {
      showNotification('لطفا تمام فیلدهای الزامی را پر کنید.', 'error');
      return;
    }
    if (!isCompleteIranLicensePlate(form.licensePlate)) {
      showNotification('شماره پلاک را کامل و صحیح انتخاب کنید.', 'error');
      return;
    }
    if (walletBlocked) {
      setWalletModalOpen(true);
      return;
    }
    const toAscii = (value) => String(value || '')
      .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
      .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
    let phoneDigits = toAscii(form.driverPhone).replace(/\D/g, '');
    if (phoneDigits.startsWith('0098')) phoneDigits = `0${phoneDigits.slice(4)}`;
    else if (phoneDigits.startsWith('98') && phoneDigits.length === 12) phoneDigits = `0${phoneDigits.slice(2)}`;
    else if (phoneDigits.length === 10 && phoneDigits.startsWith('9')) phoneDigits = `0${phoneDigits}`;
    const nationalId = toAscii(form.driverNationalId).replace(/\D/g, '');
    if (!/^09\d{9}$/.test(phoneDigits)) {
      showNotification('شماره موبایل باید ۱۱ رقم و با ۰۹ شروع شود.', 'error');
      return;
    }
    if (!/^\d{10}$/.test(nationalId)) {
      showNotification('کد ملی باید دقیقاً ۱۰ رقم باشد.', 'error');
      return;
    }
    saveMutation.mutate({
      ...form,
      driverPhone: phoneDigits,
      driverNationalId: nationalId,
      cargoDescription: form.cargoDescription?.trim() || undefined,
    });
  };

  const factoryOptions = (factories || []).map((factory) => ({ value: factory.id, label: factory.name }));
  const feeLabel = fee > 0 ? fee.toLocaleString('fa-IR') : '—';
  const balanceLabel = Number.isFinite(balance) ? balance.toLocaleString('fa-IR') : '—';

  return (
    <>
      <Card className="border border-default-200 shadow-sm rounded-2xl p-2 dark:border-white/10">
        <CardContent className="p-6">
          <div className="flex items-center gap-3 mb-6 border-b border-default-100 pb-4 dark:border-white/5">
            <Button isIconOnly variant="ghost" onPress={handleBack} aria-label="بازگشت به لیست" className="rounded-xl">
              <ArrowRight className="h-5 w-5" />
            </Button>
            <h2 className="text-xl font-bold text-foreground">
              {isEdit ? 'ویرایش برگ خروج' : 'فرم ایجاد برگ خروج جدید'}
            </h2>
          </div>

          {factoriesError && (
            <Alert status="danger" className="mb-4">
              <AlertContent>
                <AlertTitle>خطا</AlertTitle>
                <AlertDescription>دریافت لیست واحدهای صنعتی ناموفق بود.</AlertDescription>
              </AlertContent>
            </Alert>
          )}

          {walletBlocked && (
            <Alert status="warning" className="mb-4">
              <AlertContent>
                <AlertTitle>موجودی کیف‌پول کافی نیست</AlertTitle>
                <AlertDescription>
                  برای ثبت برگ خروج باید کیف‌پول واحد صنعتی شارژ شود. موجودی فعلی {balanceLabel} ریال است
                  {fee > 0 ? ` و هزینه هر برگ خروج ${feeLabel} ریال است` : ''}.
                </AlertDescription>
              </AlertContent>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormSelect
                label="واحد صنعتی"
                value={form.factoryId}
                onChange={(value) => handleChange('factoryId', value)}
                options={factoryOptions}
                isDisabled={loadingFactories || isEdit}
                isRequired
                placeholder="واحد صنعتی را انتخاب کنید..."
              />

              <FormSelect
                label="نوع بار"
                value={form.cargoType}
                onChange={(value) => handleChange('cargoType', value)}
                options={cargoTypes}
                isRequired
              />

              <FormInput
                label="نام راننده"
                placeholder="نام و نام خانوادگی راننده"
                value={form.driverName}
                onChange={(e) => handleChange('driverName', e.target.value)}
                isRequired
              />

              <FormInput
                label="کد ملی راننده"
                placeholder="کد ملی ۱۰ رقمی"
                value={form.driverNationalId}
                onChange={(e) => handleChange('driverNationalId', e.target.value)}
                dir="ltr"
                isRequired
              />

              <FormInput
                label="تلفن راننده"
                placeholder="۰۹۱۲۳۴۵۶۷۸۹"
                value={form.driverPhone}
                onChange={(e) => handleChange('driverPhone', e.target.value)}
                dir="ltr"
                isRequired
              />

              <FormSelect
                label="نوع خودرو"
                value={form.vehicleType}
                onChange={(value) => handleChange('vehicleType', value)}
                options={vehicleTypes}
                isRequired
              />

              <IranLicensePlateInput
                value={form.licensePlate}
                onChange={(value) => handleChange('licensePlate', value)}
                required
              />

              <JalaliDatePicker
                label="تاریخ و ساعت خروج"
                value={form.exitDate}
                onChange={(value) => handleChange('exitDate', value)}
                includeTime
                required
              />
            </div>

            <div className="flex flex-col gap-1">
              <Label className="text-xs font-medium text-foreground-600">توضیحات بار (اختیاری)</Label>
              <TextArea
                placeholder="شرح جزئیات محموله..."
                value={form.cargoDescription}
                onChange={(e) => handleChange('cargoDescription', e.target.value)}
                variant="primary"
                rows={3}
                className="rounded-xl"
              />
            </div>

            <div className="flex items-center justify-end gap-3 mt-4">
              <Button variant="tertiary" onPress={handleBack} isDisabled={saveMutation.isPending} className="rounded-xl font-medium">
                انصراف
              </Button>
              <Button
                type="submit"
                variant="primary"
                isDisabled={saveMutation.isPending || loadingFactories || walletBlocked}
                className="rounded-xl font-bold min-w-32 flex items-center justify-center gap-2"
              >
                {saveMutation.isPending ? <Spinner size="sm" color="current" /> : (isEdit ? 'ذخیره تغییرات' : 'ثبت برگ خروج')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={walletModalOpen}
        title="موجودی کیف‌پول کافی نیست"
        description={`ثبت برگ خروج ممکن نیست چون موجودی کیف‌پول واحد صنعتی کافی نیست. ابتدا کیف‌پول را شارژ کنید${fee > 0 ? ` (هزینه هر برگ خروج: ${feeLabel} ریال)` : ''}. موجودی فعلی: ${balanceLabel} ریال.`}
        confirmLabel="رفتن به کیف پول"
        cancelLabel="بستن"
        onConfirm={() => {
          setWalletModalOpen(false);
          navigate('/factory/wallet');
        }}
        onClose={() => setWalletModalOpen(false)}
      />
    </>
  );
};

export default CreateGatePassForm;
