import React, { useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import {
  Card,
  CardBody,
  Input,
  Select,
  SelectItem,
  Textarea,
  Button,
  Alert,
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

  return (
    <Card className="border border-default-200 shadow-sm rounded-2xl p-2 dark:border-white/10">
      <CardBody className="p-6">
        <div className="flex items-center gap-3 mb-6 border-b border-default-100 pb-4 dark:border-white/5">
          <Button isIconOnly variant="light" onPress={handleBack} aria-label="بازگشت به لیست" className="rounded-xl">
            <ArrowRight className="h-5 w-5" />
          </Button>
          <h2 className="text-xl font-bold text-foreground">
            فرم ایجاد برگ خروج جدید
          </h2>
        </div>

        {factoriesError && (
          <Alert color="danger" title="خطا" className="mb-4">
            دریافت لیست واحدهای صنعتی ناموفق بود.
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="واحد صنعتی"
              selectedKeys={form.factoryId ? [form.factoryId] : []}
              onSelectionChange={(keys) => handleChange('factoryId', Array.from(keys)[0] || '')}
              variant="bordered"
              isDisabled={loadingFactories}
              isRequired
              classNames={{ trigger: 'rounded-xl' }}
            >
              {(factories || []).map((factory) => (
                <SelectItem key={factory.id}>{factory.name}</SelectItem>
              ))}
            </Select>

            <Select
              label="نوع بار"
              selectedKeys={[form.cargoType]}
              onSelectionChange={(keys) => handleChange('cargoType', Array.from(keys)[0] || '')}
              variant="bordered"
              isRequired
              classNames={{ trigger: 'rounded-xl' }}
            >
              {cargoTypes.map((option) => (
                <SelectItem key={option.value}>{option.label}</SelectItem>
              ))}
            </Select>

            <Input
              label="نام راننده"
              placeholder="نام و نام خانوادگی راننده"
              value={form.driverName}
              onValueChange={(val) => handleChange('driverName', val)}
              variant="bordered"
              isRequired
              classNames={{ inputWrapper: 'rounded-xl' }}
            />

            <Input
              label="کد ملی راننده"
              placeholder="کد ملی ۱۰ رقمی"
              value={form.driverNationalId}
              onValueChange={(val) => handleChange('driverNationalId', val)}
              variant="bordered"
              dir="ltr"
              isRequired
              classNames={{ inputWrapper: 'rounded-xl' }}
            />

            <Input
              label="تلفن راننده"
              placeholder="۰۹۱۲۳۴۵۶۷۸۹"
              value={form.driverPhone}
              onValueChange={(val) => handleChange('driverPhone', val)}
              variant="bordered"
              dir="ltr"
              isRequired
              classNames={{ inputWrapper: 'rounded-xl' }}
            />

            <Select
              label="نوع خودرو"
              selectedKeys={[form.vehicleType]}
              onSelectionChange={(keys) => handleChange('vehicleType', Array.from(keys)[0] || '')}
              variant="bordered"
              isRequired
              classNames={{ trigger: 'rounded-xl' }}
            >
              {vehicleTypes.map((option) => (
                <SelectItem key={option.value}>{option.label}</SelectItem>
              ))}
            </Select>

            <Input
              label="شماره پلاک"
              placeholder="مثلا: ۱۲ ب ۳۴۵ ایران ۷۸"
              value={form.licensePlate}
              onValueChange={(val) => handleChange('licensePlate', val)}
              variant="bordered"
              isRequired
              classNames={{ inputWrapper: 'rounded-xl' }}
            />

            <Input
              type="datetime-local"
              label="تاریخ و ساعت خروج"
              value={form.exitDate}
              onValueChange={(val) => handleChange('exitDate', val)}
              variant="bordered"
              isRequired
              classNames={{ inputWrapper: 'rounded-xl' }}
            />
          </div>

          <Textarea
            label="توضیحات بار (اختیاری)"
            placeholder="شرح جزئیات محموله..."
            value={form.cargoDescription}
            onValueChange={(val) => handleChange('cargoDescription', val)}
            variant="bordered"
            minRows={3}
            classNames={{ inputWrapper: 'rounded-xl' }}
          />

          <div className="flex items-center justify-end gap-3 mt-4">
            <Button variant="flat" color="default" onPress={handleBack} isDisabled={createMutation.isPending} className="rounded-xl font-medium">
              انصراف
            </Button>
            <Button type="submit" color="primary" isLoading={createMutation.isPending} className="rounded-xl font-bold">
              ثبت و ارسال برای تایید
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
};

export default CreateGatePassForm;

