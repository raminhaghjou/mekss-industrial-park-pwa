import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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
import { ArrowRight, Megaphone, RotateCw } from 'lucide-react';
import { advertisementApi } from '../../services/api/advertisement.api';
import { useNotification } from '../../providers/NotificationProvider';
import { getErrorMessage } from '../../utils/apiError';
import IranProvinceCityFields from '../../components/common/IranProvinceCityFields';
import { toPersistedLocation } from '../../utils/iranLocations';

const categories = [
  { value: 'EQUIPMENT', label: 'تجهیزات' },
  { value: 'SERVICES', label: 'خدمات' },
  { value: 'RAW_MATERIALS', label: 'مواد اولیه' },
  { value: 'JOB_LISTINGS', label: 'فرصت شغلی' },
  { value: 'REAL_ESTATE', label: 'املاک' },
  { value: 'OTHER', label: 'سایر' },
];

const emptyForm = {
  title: '', category: 'OTHER', province: '', city: '', content: '', contact: '', parkId: '',
};

const NewAdvertisementPage = () => {
  const { id: editId } = useParams();
  const isEdit = Boolean(editId);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showNotification } = useNotification();
  const [form, setForm] = React.useState(emptyForm);
  const [hydrated, setHydrated] = React.useState(!isEdit);

  const scopeQuery = useQuery({
    queryKey: ['advertisements', 'creation-scope'],
    queryFn: () => advertisementApi.getCreationScope().then((response) => response.data),
    enabled: !isEdit,
  });

  const detailQuery = useQuery({
    queryKey: ['advertisements', 'mine', editId],
    queryFn: () => advertisementApi.getMyAdvertisement(editId).then((response) => response.data),
    enabled: isEdit,
  });

  React.useEffect(() => {
    if (!isEdit && scopeQuery.data?.autoSelectedParkId) {
      setForm((current) => (current.parkId ? current : { ...current, parkId: scopeQuery.data.autoSelectedParkId }));
    }
  }, [isEdit, scopeQuery.data?.autoSelectedParkId]);

  React.useEffect(() => {
    if (!detailQuery.data || hydrated) return;
    const ad = detailQuery.data;
    if (ad.status !== 'PENDING') {
      showNotification('فقط آگهی‌های در انتظار بررسی قابل ویرایش هستند.', 'error');
      navigate('/advertisements', { replace: true });
      return;
    }
    const contact = ad.contactInfo?.phone || ad.contactInfo?.phoneNumber || '';
    setForm({
      title: ad.title || '',
      category: ad.category?.key || 'OTHER',
      province: ad.province || '',
      city: ad.city || '',
      content: ad.content || '',
      contact,
      parkId: ad.park?.id || ad.parkId || '',
    });
    setHydrated(true);
  }, [detailQuery.data, hydrated, navigate, showNotification, isEdit]);

  const saveMutation = useMutation({
    mutationFn: (payload) => (
      isEdit
        ? advertisementApi.updateMyAdvertisement(editId, payload)
        : advertisementApi.createAdvertisement(payload)
    ),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['advertisements'] }),
        queryClient.invalidateQueries({ queryKey: ['analytics', 'dashboard'] }),
      ]);
      showNotification(
        isEdit ? 'آگهی با موفقیت به‌روز شد.' : 'آگهی ثبت شد و تا تایید مدیریت در لیست شما قابل ویرایش است.',
        'success',
      );
      navigate('/advertisements');
    },
    onError: (error) => showNotification(getErrorMessage(error, isEdit ? 'ویرایش آگهی ناموفق بود.' : 'ثبت آگهی ناموفق بود.'), 'error'),
  });

  const update = (field, val) => setForm((current) => ({ ...current, [field]: val }));

  const handleSubmit = (event) => {
    event.preventDefault();
    const required = [form.title, form.content, form.contact, form.province, form.city];
    if (!isEdit) required.push(form.parkId);
    if (required.some((value) => !String(value || '').trim())) {
      showNotification('لطفاً همه فیلدهای الزامی را تکمیل کنید.', 'error');
      return;
    }
    const location = toPersistedLocation(form.province, form.city);
    const payload = {
      title: form.title,
      category: form.category,
      province: location.province,
      city: location.city,
      content: form.content,
      contactInfo: { phone: form.contact },
    };
    if (!isEdit) payload.parkId = form.parkId;
    saveMutation.mutate(payload);
  };

  const scope = scopeQuery.data;
  const unavailable = !isEdit && scope && !scope.canCreate;
  const loading = isEdit ? (detailQuery.isLoading || !hydrated) : scopeQuery.isLoading;
  const loadError = isEdit ? detailQuery.isError : scopeQuery.isError;
  const loadErrorObj = isEdit ? detailQuery.error : scopeQuery.error;

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
              <Megaphone className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">{isEdit ? 'ویرایش آگهی' : 'ثبت آگهی جدید'}</h1>
              <p className="text-xs text-foreground-500 mt-0.5">
                {isEdit
                  ? 'فقط تا قبل از تایید مدیریت می‌توانید این آگهی را ویرایش کنید.'
                  : 'ابتدا استان را انتخاب کنید، سپس شهر همان استان. پس از ثبت تا تایید قابل ویرایش است.'}
              </p>
            </div>
          </div>

          {loading && (
            <div className="flex min-h-[180px] items-center justify-center">
              <Spinner size="lg" />
            </div>
          )}

          {loadError && (
            <Alert status="danger" className="flex flex-wrap items-center justify-between gap-3">
              <AlertContent>
                <AlertTitle>خطا</AlertTitle>
                <AlertDescription>
                  {getErrorMessage(loadErrorObj, isEdit ? 'دریافت آگهی ناموفق بود.' : 'دریافت محدوده مجاز ثبت آگهی ناموفق بود.')}
                </AlertDescription>
              </AlertContent>
              <Button
                size="sm"
                variant="secondary"
                onPress={() => (isEdit ? detailQuery.refetch() : scopeQuery.refetch())}
                className="rounded-xl flex items-center gap-2"
              >
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

          {!loading && !loadError && !unavailable && (
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

              {!isEdit && (
                <div className="flex flex-col gap-1">
                  <Label className="text-xs font-medium text-foreground-600">شهرک صنعتی</Label>
                  <Select
                    value={form.parkId}
                    onChange={(val) => update('parkId', String(val || ''))}
                    variant="primary"
                    isDisabled={!scope?.requiresSelection}
                    isRequired
                    className="rounded-xl"
                    placeholder={scope?.requiresSelection ? 'یکی از محدوده‌های مجاز حساب را انتخاب کنید.' : 'شهرک مرتبط به‌صورت خودکار تعیین شده است.'}
                  >
                    <SelectTrigger>
                      <SelectValue />
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
              )}

              <IranProvinceCityFields
                province={form.province}
                city={form.city}
                onProvinceChange={(province) => update('province', province)}
                onCityChange={(city) => update('city', city)}
              />

              <div className="flex flex-col gap-1">
                <Label className="text-xs font-medium text-foreground-600">شرح آگهی</Label>
                <TextArea
                  required
                  placeholder="متن کامل و جزئیات آگهی..."
                  value={form.content}
                  onChange={(e) => update('content', e.target.value)}
                  rows={5}
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
                  isDisabled={saveMutation.isPending || (!isEdit && !form.parkId)}
                  className="rounded-xl font-bold px-8 shadow-md shadow-primary/20"
                >
                  {saveMutation.isPending ? <Spinner size="sm" /> : (isEdit ? 'ذخیره تغییرات' : 'ثبت برای بررسی')}
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
