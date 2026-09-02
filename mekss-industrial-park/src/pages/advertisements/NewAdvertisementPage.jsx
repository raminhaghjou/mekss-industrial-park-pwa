import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Card,
  CardBody,
  Input,
  Select,
  SelectItem,
  Textarea,
  Button,
  Alert,
  Spinner,
} from '@heroui/react';
import { ArrowRight, MegaPhone, RotateCw } from 'lucide-react';
import { advertisementApi } from '../../services/api/advertisement.api';
import { useNotification } from '../../providers/NotificationProvider';
import { getErrorMessage } from '../../utils/apiError';

const categories = [
  { value: 'EQUIPMENT', label: 'تجهیزات' },
  { value: 'SERVICES', label: 'خدمات' },
  { value: 'RAW_MATERIALS', label: 'مواد اولیه' },
  { value: 'JOB_LISTINGS', label: 'فرصت شغلی' },
  { value: 'REAL_ESTATE', label: 'املاک' },
  { value: 'OTHER', label: 'سایر' },
];

const NewAdvertisementPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showNotification } = useNotification();
  const [form, setForm] = React.useState({
    title: '', category: 'OTHER', province: '', city: '', content: '', contact: '', parkId: '',
  });

  const scopeQuery = useQuery({
    queryKey: ['advertisements', 'creation-scope'],
    queryFn: () => advertisementApi.getCreationScope().then((response) => response.data),
  });

  React.useEffect(() => {
    if (scopeQuery.data?.autoSelectedParkId) {
      setForm((current) => current.parkId ? current : { ...current, parkId: scopeQuery.data.autoSelectedParkId });
    }
  }, [scopeQuery.data?.autoSelectedParkId]);

  const createMutation = useMutation({
    mutationFn: (/** @type {{title: string, category: string, province: string, city: string, content: string, contactInfo: {phone: string}, parkId: string}} */ payload) => advertisementApi.createAdvertisement(payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['advertisements'] }),
        queryClient.invalidateQueries({ queryKey: ['analytics', 'dashboard'] }),
      ]);
      showNotification('آگهی با scope معتبر ثبت شد و پس از تایید نمایش داده می‌شود.', 'success');
      navigate('/advertisements');
    },
    onError: (error) => showNotification(getErrorMessage(error, 'ثبت آگهی ناموفق بود.'), 'error'),
  });

  const update = (field, val) => setForm((current) => ({ ...current, [field]: val }));

  const handleSubmit = (event) => {
    event.preventDefault();
    const required = [form.title, form.content, form.contact, form.province, form.city, form.parkId];
    if (required.some((value) => !value.trim())) {
      showNotification('لطفاً همه فیلدهای الزامی و شهرک صنعتی را تکمیل کنید.', 'error');
      return;
    }
    createMutation.mutate({
      title: form.title,
      category: form.category,
      province: form.province,
      city: form.city,
      content: form.content,
      contactInfo: { phone: form.contact },
      parkId: form.parkId,
    });
  };

  const scope = scopeQuery.data;
  const unavailable = scope && !scope.canCreate;

  return (
    <div className="flex flex-col gap-6 max-w-3xl mx-auto">
      <div className="flex items-center">
        <Button startContent={<ArrowRight className="h-4 w-4" />} onPress={() => navigate('/advertisements')} variant="light" className="rounded-xl font-medium">
          بازگشت به آگهی‌ها
        </Button>
      </div>

      <Card className="border border-default-200 shadow-sm rounded-3xl p-2 dark:border-white/10 glass-card">
        <CardBody className="p-6 gap-6">
          <div className="flex items-center gap-3 border-b border-default-100 pb-4 dark:border-white/5">
            <div className="p-2.5 rounded-2xl bg-primary-50 dark:bg-primary-950/40 text-primary">
              <MegaPhone className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">ثبت آگهی جدید</h1>
              <p className="text-xs text-foreground-500 mt-0.5">شهرک صنعتی از دسترسی واقعی حساب شما تعیین می‌شود و پس از ثبت قابل جابه‌جایی نیست.</p>
            </div>
          </div>

          {scopeQuery.isLoading && (
            <div className="flex min-h-[180px] items-center justify-center">
              <Spinner size="lg" label="در حال دریافت محدوده مجاز..." />
            </div>
          )}

          {scopeQuery.isError && (
            <Alert color="danger" title="خطا" endContent={<Button size="sm" variant="flat" color="danger" startContent={<RotateCw className="h-4 w-4" />} onPress={() => scopeQuery.refetch()}>تلاش دوباره</Button>}>
              {getErrorMessage(scopeQuery.error, 'دریافت محدوده مجاز ثبت آگهی ناموفق بود.')}
            </Alert>
          )}

          {unavailable && (
            <Alert color="warning" title="هشدار عدم دسترسی">
              هیچ شهرک صنعتی فعال و مرتبطی برای حساب شما وجود ندارد؛ ثبت آگهی فعلاً ممکن نیست.
            </Alert>
          )}

          {!scopeQuery.isLoading && !scopeQuery.isError && !unavailable && (
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              <Input
                required
                label="عنوان آگهی"
                placeholder="عنوان مناسب آگهی..."
                value={form.title}
                onValueChange={(val) => update('title', val)}
                maxLength={200}
                variant="bordered"
                classNames={{ inputWrapper: 'rounded-xl' }}
              />

              <Select
                label="دسته‌بندی"
                selectedKeys={[form.category]}
                onSelectionChange={(keys) => update('category', Array.from(keys)[0] || '')}
                variant="bordered"
                isRequired
                classNames={{ trigger: 'rounded-xl' }}
              >
                {categories.map((option) => (
                  <SelectItem key={option.value}>{option.label}</SelectItem>
                ))}
              </Select>

              <Select
                label="شهرک صنعتی"
                selectedKeys={form.parkId ? [form.parkId] : []}
                onSelectionChange={(keys) => update('parkId', Array.from(keys)[0] || '')}
                variant="bordered"
                isDisabled={!scope?.requiresSelection}
                isRequired
                classNames={{ trigger: 'rounded-xl' }}
                description={scope?.requiresSelection ? 'یکی از محدوده‌های مجاز حساب را انتخاب کنید.' : 'شهرک مرتبط به‌صورت خودکار تعیین شده است.'}
              >
                {(scope?.parks || []).map((park) => (
                  <SelectItem key={park.id}>{`${park.name} (${park.code})`}</SelectItem>
                ))}
              </Select>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  required
                  label="استان"
                  placeholder="استان..."
                  value={form.province}
                  onValueChange={(val) => update('province', val)}
                  variant="bordered"
                  classNames={{ inputWrapper: 'rounded-xl' }}
                />
                <Input
                  required
                  label="شهر"
                  placeholder="شهر..."
                  value={form.city}
                  onValueChange={(val) => update('city', val)}
                  variant="bordered"
                  classNames={{ inputWrapper: 'rounded-xl' }}
                />
              </div>

              <Textarea
                required
                label="شرح آگهی"
                placeholder="متن کامل و جزئیات آگهی..."
                value={form.content}
                onValueChange={(val) => update('content', val)}
                minRows={5}
                maxLength={8000}
                variant="bordered"
                classNames={{ inputWrapper: 'rounded-xl' }}
              />

              <Input
                required
                label="شماره تماس"
                placeholder="۰۹۱۲۳۴۵۶۷۸۹"
                value={form.contact}
                onValueChange={(val) => update('contact', val)}
                maxLength={20}
                variant="bordered"
                dir="ltr"
                classNames={{ inputWrapper: 'rounded-xl' }}
              />

              <div className="flex justify-end mt-2">
                <Button
                  type="submit"
                  color="primary"
                  isLoading={createMutation.isPending}
                  isDisabled={createMutation.isPending || !form.parkId}
                  className="rounded-xl font-bold px-8 shadow-md shadow-primary/20"
                >
                  ثبت برای بررسی
                </Button>
              </div>
            </form>
          )}
        </CardBody>
      </Card>
    </div>
  );
};

export default NewAdvertisementPage;

