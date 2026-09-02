import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
  TextArea,
  Button,
  Alert,
  AlertContent,
  AlertTitle,
  AlertDescription,
  Spinner,
  Label,
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
        <Button variant="ghost" onPress={() => navigate('/advertisements')} className="rounded-xl font-medium flex items-center gap-2">
          <ArrowRight className="h-4 w-4" />
          بازگشت به آگهی‌ها
        </Button>
      </div>

      <Card className="border border-default-200 shadow-sm rounded-3xl p-2 dark:border-white/10 glass-card">
        <CardContent className="p-6 gap-6">
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
              <Spinner size="lg" />
            </div>
          )}

          {scopeQuery.isError && (
            <Alert status="danger" className="flex flex-wrap items-center justify-between gap-3">
              <AlertContent>
                <AlertTitle>خطا</AlertTitle>
                <AlertDescription>{getErrorMessage(scopeQuery.error, 'دریافت محدوده مجاز ثبت آگهی ناموفق بود.')}</AlertDescription>
              </AlertContent>
              <Button size="sm" variant="secondary" onPress={() => scopeQuery.refetch()} className="rounded-xl flex items-center gap-2">
                <RotateCw className="h-4 w-4" />
                تلاش دوباره
              </Button>
            </Alert>
          )}

          {unavailable && (
            <Alert status="warning">
              <AlertContent>
                <AlertTitle>هشدار عدم دسترسی</AlertTitle>
                <AlertDescription>
                  هیچ شهرک صنعتی فعال و مرتبطی برای حساب شما وجود ندارد؛ ثبت آگهی فعلاً ممکن نیست.
                </AlertDescription>
              </AlertContent>
            </Alert>
          )}

          {!scopeQuery.isLoading && !scopeQuery.isError && !unavailable && (
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              <div className="flex flex-col gap-1">
                <Label className="text-xs font-medium text-foreground-600">عنوان آگهی</Label>
                <Input
                  required
                  placeholder="عنوان مناسب آگهی..."
                  value={form.title}
                  onChange={(e) => update('title', e.target.value)}
                  maxLength={200}
                  variant="primary"
                  className="rounded-xl"
                />
              </div>

              <div className="flex flex-col gap-1">
                <Label className="text-xs font-medium text-foreground-600">دسته‌بندی</Label>
                <Select
                  value={form.category}
                  onChange={(val) => update('category', val || 'OTHER')}
                  variant="primary"
                  isRequired
                  className="rounded-xl"
                >
                  <SelectTrigger>
                    <SelectValue />
                    <SelectIndicator />
                  </SelectTrigger>
                  <SelectPopover>
                    <ListBox>
                      {categories.map((option) => (
                        <ListBoxItem key={option.value} id={option.value}>{option.label}</ListBoxItem>
                      ))}
                    </ListBox>
                  </SelectPopover>
                </Select>
              </div>

              <div className="flex flex-col gap-1">
                <Label className="text-xs font-medium text-foreground-600">شهرک صنعتی</Label>
                <Select
                  value={form.parkId}
                  onChange={(val) => update('parkId', val || '')}
                  variant="primary"
                  isDisabled={!scope?.requiresSelection}
                  isRequired
                  className="rounded-xl"
                >
                  <SelectTrigger>
                    <SelectValue placeholder={scope?.requiresSelection ? 'یکی از محدوده‌های مجاز حساب را انتخاب کنید.' : 'شهرک مرتبط به‌صورت خودکار تعیین شده است.'} />
                    <SelectIndicator />
                  </SelectTrigger>
                  <SelectPopover>
                    <ListBox>
                      {(scope?.parks || []).map((park) => (
                        <ListBoxItem key={park.id} id={park.id}>{`${park.name} (${park.code})`}</ListBoxItem>
                      ))}
                    </ListBox>
                  </SelectPopover>
                </Select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <Label className="text-xs font-medium text-foreground-600">استان</Label>
                  <Input
                    required
                    placeholder="استان..."
                    value={form.province}
                    onChange={(e) => update('province', e.target.value)}
                    variant="primary"
                    className="rounded-xl"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-xs font-medium text-foreground-600">شهر</Label>
                  <Input
                    required
                    placeholder="شهر..."
                    value={form.city}
                    onChange={(e) => update('city', e.target.value)}
                    variant="primary"
                    className="rounded-xl"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <Label className="text-xs font-medium text-foreground-600">شرح آگهی</Label>
                <TextArea
                  required
                  placeholder="متن کامل و جزئیات آگهی..."
                  value={form.content}
                  onChange={(e) => update('content', e.target.value)}
                  minRows={5}
                  maxLength={8000}
                  variant="primary"
                  className="rounded-xl"
                />
              </div>

              <div className="flex flex-col gap-1">
                <Label className="text-xs font-medium text-foreground-600">شماره تماس</Label>
                <Input
                  required
                  placeholder="۰۹۱۲۳۴۵۶۷۸۹"
                  value={form.contact}
                  onChange={(e) => update('contact', e.target.value)}
                  maxLength={20}
                  variant="primary"
                  dir="ltr"
                  className="rounded-xl"
                />
              </div>

              <div className="flex justify-end mt-2">
                <Button
                  type="submit"
                  variant="primary"
                  isLoading={createMutation.isPending}
                  isDisabled={createMutation.isPending || !form.parkId}
                  className="rounded-xl font-bold px-8 shadow-md shadow-primary/20"
                >
                  ثبت برای بررسی
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default NewAdvertisementPage;
