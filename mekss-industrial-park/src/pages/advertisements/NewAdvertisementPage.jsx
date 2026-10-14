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
import { Megaphone, RotateCw, X } from 'lucide-react';
import { advertisementApi } from '../../services/api/advertisement.api';
import { useNotification } from '../../providers/NotificationProvider';
import { getErrorMessage } from '../../utils/apiError';
import IranProvinceCityFields from '../../components/common/IranProvinceCityFields';
import { FileUploader } from '../../components/common/FileUploader';
import { toPersistedLocation } from '../../utils/iranLocations';
import { AuthenticatedImage } from '../../components/common/AuthenticatedImage';
import { advertisementImageIds } from '../../utils/advertisementImages';
import { toAsciiDigits } from '../../utils/digits';

const emptyForm = {
  title: '', category: '', province: '', city: '', address: '', content: '', contact: '', parkId: '', images: [],
};

const NewAdvertisementPage = () => {
  const { id: editId } = useParams();
  const isEdit = Boolean(editId);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showNotification } = useNotification();
  const [form, setForm] = React.useState(emptyForm);
  const [hydrated, setHydrated] = React.useState(!isEdit);

  const categoriesQuery = useQuery({
    queryKey: ['advertisement-categories'],
    queryFn: () => advertisementApi.getCategories().then((response) => response.data),
  });
  const categories = React.useMemo(
    () => (categoriesQuery.data || []).map((cat) => ({ value: cat.key, label: cat.label })),
    [categoriesQuery.data],
  );

  React.useEffect(() => {
    if (!categories.length) return;
    setForm((current) => (
      categories.some((option) => option.value === current.category)
        ? current
        : { ...current, category: categories[0].value }
    ));
  }, [categories]);

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
      category: ad.category?.key || '',
      province: ad.province || '',
      city: ad.city || '',
      content: ad.content || '',
      contact,
      address: ad.address || '',
      images: ad.images || [],
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
    const required = [form.title, form.category, form.content, form.contact, form.province, form.city];
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
      address: form.address.trim() || undefined,
      images: advertisementImageIds(form.images),
      contactInfo: { phone: toAsciiDigits(form.contact).trim() },
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
                  onChange={(val) => update('category', String(val || ''))}
                  placeholder={categoriesQuery.isLoading ? 'در حال دریافت دسته‌بندی‌ها...' : 'دسته‌بندی را انتخاب کنید'}
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
                          <ListBoxItem key={park.id} id={park.id}>{park.city ? `${park.name} — ${park.city}` : park.name}</ListBoxItem>
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
                <Label className="text-xs font-medium text-foreground-600">آدرس</Label>
                <Input
                  value={form.address}
                  onChange={(e) => update('address', e.target.value)}
                  placeholder="آدرس دقیق نمایش در آگهی..."
                  className="rounded-xl"
                  maxLength={240}
                />
              </div>

              <div className="flex flex-col gap-1">
                <Label className="text-xs font-medium text-foreground-600">تصاویر (حداکثر ۱۰)</Label>
                {(form.images || []).length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {form.images.map((image, index) => {
                      const imageId = typeof image === 'string' ? image : image?.id;
                      return (
                        <div key={`${imageId}-${index}`} className="relative h-20 w-20 overflow-hidden rounded-xl border border-default-200 bg-default-100 dark:border-white/10">
                          <AuthenticatedImage
                            fileId={imageId}
                            alt={`تصویر ${index + 1}`}
                            className="h-full w-full object-cover"
                            fallback={<div className="flex h-full w-full items-center justify-center text-[10px] text-foreground-500">تصویر {index + 1}</div>}
                          />
                          <button
                            type="button"
                            aria-label={`حذف تصویر ${index + 1}`}
                            onClick={() => update('images', form.images.filter((_, i) => i !== index))}
                            className="absolute top-1 left-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
                <FileUploader
                  domain="advertisement"
                  parkId={form.parkId || undefined}
                  label="افزودن تصویر"
                  preview={false}
                  disabled={(form.images?.length || 0) >= 10 || (!isEdit && !form.parkId)}
                  hint={!isEdit && !form.parkId ? 'ابتدا شهرک صنعتی را انتخاب کنید.' : undefined}
                  onUploaded={(file) => {
                    setForm((current) => (
                      (current.images?.length || 0) >= 10 ? current : { ...current, images: [...(current.images || []), file] }
                    ));
                  }}
                />
              </div>

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
