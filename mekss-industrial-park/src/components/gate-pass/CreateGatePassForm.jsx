import React, { useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
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
import { useNotification } from '../../providers/NotificationProvider';
import { getErrorMessage } from '../../utils/apiError';

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

const FormSelect = ({ label, value, onChange, options, isDisabled, isRequired, placeholder }) => (
  <div className="flex flex-col gap-1">
    <Label className="text-xs font-medium text-foreground-600">{label}</Label>
    <Select
      value={value}
      onChange={onChange}
      variant="primary"
      isDisabled={isDisabled}
      isRequired={isRequired}
      className="rounded-xl"
    >
      <SelectTrigger>
        <SelectValue placeholder={placeholder} />
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

const FormInput = ({ label, ...props }) => (
  <div className="flex flex-col gap-1">
    <Label className="text-xs font-medium text-foreground-600">{label}</Label>
    <Input variant="primary" className="rounded-xl" {...props} />
  </div>
);

const CreateGatePassForm = ({ handleBack }) => {
  const { showNotification } = useNotification();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyForm);

  const { data: factories, isLoading: loadingFactories, isError: factoriesError } = useQuery({
    queryKey: ['factories', 'managed'],
    queryFn: () => factoryApi.getFactories().then((res) => res.data),
  });

  const createMutation = useMutation({
    mutationFn: (/** @type {typeof emptyForm} */ payload) => gatePassApi.createGatePass(payload),
    onSuccess: () => {
      showNotification('برگ خروج با موفقیت ثبت و برای تایید ارسال شد.', 'success');
      queryClient.invalidateQueries({ queryKey: ['gate-passes'] });
      handleBack();
    },
    onError: (err) => showNotification(getErrorMessage(err, 'ثبت برگ خروج ناموفق بود.'), 'error'),
  });

  const handleChange = (name, value) => setForm((prev) => ({ ...prev, [name]: value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    const required = ['factoryId', 'cargoType', 'driverName', 'driverNationalId', 'driverPhone', 'vehicleType', 'licensePlate', 'exitDate'];
    if (required.some((field) => !form[field])) {
      showNotification('لطفا تمام فیلدهای الزامی را پر کنید.', 'error');
      return;
    }
    createMutation.mutate(form);
  };

  const factoryOptions = (factories || []).map((factory) => ({ value: factory.id, label: factory.name }));

  return (
    <Card className="border border-default-200 shadow-sm rounded-2xl p-2 dark:border-white/10">
      <CardContent className="p-6">
        <div className="flex items-center gap-3 mb-6 border-b border-default-100 pb-4 dark:border-white/5">
          <Button isIconOnly variant="ghost" onPress={handleBack} aria-label="بازگشت به لیست" className="rounded-xl">
            <ArrowRight className="h-5 w-5" />
          </Button>
          <h2 className="text-xl font-bold text-foreground">
            فرم ایجاد برگ خروج جدید
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

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormSelect
              label="واحد صنعتی"
              value={form.factoryId}
              onChange={(value) => handleChange('factoryId', value)}
              options={factoryOptions}
              isDisabled={loadingFactories}
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

            <FormInput
              label="شماره پلاک"
              placeholder="مثلا: ۱۲ ب ۳۴۵ ایران ۷۸"
              value={form.licensePlate}
              onChange={(e) => handleChange('licensePlate', e.target.value)}
              isRequired
            />

            <FormInput
              type="datetime-local"
              label="تاریخ و ساعت خروج"
              value={form.exitDate}
              onChange={(e) => handleChange('exitDate', e.target.value)}
              isRequired
            />
          </div>

          <div className="flex flex-col gap-1">
            <Label className="text-xs font-medium text-foreground-600">توضیحات بار (اختیاری)</Label>
            <TextArea
              placeholder="شرح جزئیات محموله..."
              value={form.cargoDescription}
              onChange={(e) => handleChange('cargoDescription', e.target.value)}
              variant="primary"
              minRows={3}
              className="rounded-xl"
            />
          </div>

          <div className="flex items-center justify-end gap-3 mt-4">
            <Button variant="tertiary" onPress={handleBack} isDisabled={createMutation.isPending} className="rounded-xl font-medium">
              انصراف
            </Button>
            <Button type="submit" className="rounded-xl font-bold" variant="primary" isDisabled={createMutation.isPending}>
              {createMutation.isPending ? <Spinner size="sm" /> : 'ثبت و ارسال برای تایید'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default CreateGatePassForm;
