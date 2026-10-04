import React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  Button,
  Chip,
  Spinner,
  Input,
  Label,
  ModalBackdrop,
  ModalContainer,
  ModalDialog,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Alert,
  AlertContent,
  AlertTitle,
  AlertDescription,
} from '@heroui/react';
import { Edit2, Image as ImageIcon, Plus, Trash2, Upload } from 'lucide-react';
import { bannerApi, isAllowedBannerLink } from '../../services/api/banner.api';
import { filesApi } from '../../services/api/files.api';
import { parkApi } from '../../services/api/park.api';
import { useNotification } from '../../providers/NotificationProvider';
import { getErrorMessage } from '../../utils/apiError';
import { AuthenticatedImage } from '../../components/common/AuthenticatedImage';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import JalaliDatePicker from '../../components/common/JalaliDatePicker';
import { formatFaDateTime } from '../../utils/printHtml';
import { BANNER_IMAGE_SPECS, bannerImageWarning } from '../../utils/bannerImage';

const MAX_BANNER_BYTES = 3 * 1024 * 1024;
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const readImageSize = (file) => new Promise((resolve) => {
  const url = URL.createObjectURL(file);
  const image = new Image();
  image.onload = () => {
    resolve({ width: image.naturalWidth, height: image.naturalHeight });
    URL.revokeObjectURL(url);
  };
  image.onerror = () => {
    resolve({ width: 0, height: 0 });
    URL.revokeObjectURL(url);
  };
  image.src = url;
});

const emptyForm = {
  title: '',
  desktopImageId: '',
  mobileImageId: '',
  linkUrl: '',
  openInNewTab: true,
  isActive: true,
  sortOrder: '0',
  startsAt: '',
  endsAt: '',
  parkId: '',
};

const selectClass = 'h-11 w-full rounded-xl border border-default-200 bg-default-50 px-3 text-sm outline-none focus:ring-2 focus:ring-primary dark:border-white/10 dark:bg-white/5';

const bannerState = (banner, now = Date.now()) => {
  if (!banner.isActive) return { label: 'غیرفعال', color: 'default' };
  if (banner.startsAt && new Date(banner.startsAt).getTime() > now) return { label: 'زمان‌بندی‌شده', color: 'warning' };
  if (banner.endsAt && new Date(banner.endsAt).getTime() < now) return { label: 'منقضی', color: 'default' };
  return { label: 'در حال نمایش', color: 'success' };
};

const ImagePicker = ({ kind, fileId, onUploaded, onUploadingChange, disabled }) => {
  const spec = BANNER_IMAGE_SPECS[kind];
  const inputRef = React.useRef(/** @type {HTMLInputElement | null} */ (null));
  const [preview, setPreview] = React.useState('');
  const [warning, setWarning] = React.useState('');
  const [uploading, setUploading] = React.useState(false);
  const [error, setError] = React.useState('');

  React.useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  const pick = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setError('');
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError('فقط تصویر JPG، PNG یا WebP مجاز است.');
      return;
    }
    if (file.size > MAX_BANNER_BYTES) {
      setError('حجم تصویر بنر حداکثر ۳ مگابایت است.');
      return;
    }
    const { width, height } = await readImageSize(file);
    setWarning(bannerImageWarning(kind, width, height));
    setUploading(true);
    onUploadingChange?.(kind, true);
    try {
      const response = await filesApi.upload(file, { domain: 'banner' });
      const id = response?.data?.id;
      if (!id) throw new Error('شناسه فایل دریافت نشد');
      setPreview(URL.createObjectURL(file));
      onUploaded(id);
    } catch (uploadError) {
      setError(getErrorMessage(uploadError, 'بارگذاری تصویر ناموفق بود.'));
    } finally {
      setUploading(false);
      onUploadingChange?.(kind, false);
    }
  };

  const aspect = kind === 'desktop' ? 'aspect-[4/1]' : 'aspect-[2/1]';
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs font-medium text-foreground-600">{spec.label} <span className="text-danger">*</span></Label>
        <span className="text-[11px] text-foreground-500">{spec.hint}</span>
      </div>
      <div className={`relative w-full overflow-hidden rounded-xl border border-dashed border-default-300 bg-default-50 ${aspect}`}>
        {preview ? (
          <img src={preview} alt={`پیش‌نمایش ${spec.label}`} className="h-full w-full object-cover" />
        ) : fileId ? (
          <AuthenticatedImage fileId={fileId} alt={`پیش‌نمایش ${spec.label}`} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-default-400">
            <ImageIcon className="h-8 w-8" />
          </div>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(',')}
        className="hidden"
        onChange={pick}
        data-testid={`banner-${kind}-file`}
      />
      <Button
        type="button"
        size="sm"
        variant="secondary"
        className="self-start rounded-xl gap-1"
        isDisabled={disabled || uploading}
        onPress={() => inputRef.current?.click()}
      >
        {uploading ? <Spinner size="sm" /> : <Upload className="h-4 w-4" />}
        {fileId ? 'جایگزینی تصویر' : 'انتخاب تصویر'}
      </Button>
      {warning && <p className="text-xs text-warning-700">{warning}</p>}
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
};

const ManageBannersPage = () => {
  const queryClient = useQueryClient();
  const { showNotification } = useNotification();
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState(/** @type {any} */ (null));
  const [form, setForm] = React.useState(emptyForm);
  const [deleteTarget, setDeleteTarget] = React.useState(/** @type {any} */ (null));
  const [uploadingKinds, setUploadingKinds] = React.useState(/** @type {string[]} */ ([]));
  const imageUploading = uploadingKinds.length > 0;
  const setKindUploading = React.useCallback((kind, busy) => {
    setUploadingKinds((current) => (busy ? [...new Set([...current, kind])] : current.filter((item) => item !== kind)));
  }, []);

  const bannersQuery = useQuery({
    queryKey: ['banners', 'managed'],
    queryFn: () => bannerApi.getManaged().then((response) => response.data),
  });
  const parksQuery = useQuery({
    queryKey: ['parks', 'all'],
    queryFn: () => parkApi.getParks().then((response) => response.data),
  });
  const parks = Array.isArray(parksQuery.data) ? parksQuery.data : parksQuery.data?.items || [];
  const banners = Array.isArray(bannersQuery.data) ? bannersQuery.data : [];

  const refresh = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: ['banners', 'managed'] }),
    queryClient.invalidateQueries({ queryKey: ['banners', 'active'] }),
  ]);

  const saveMutation = useMutation({
    mutationFn: (/** @type {{ id?: string, payload: Record<string, unknown> }} */ input) => (
      input.id ? bannerApi.update(input.id, input.payload) : bannerApi.create(input.payload)
    ),
    onSuccess: async (_response, input) => {
      await refresh();
      showNotification(input.id ? 'بنر ویرایش شد.' : 'بنر جدید ثبت شد.', 'success');
      setFormOpen(false);
      setEditing(null);
      setForm(emptyForm);
    },
    onError: (error) => showNotification(getErrorMessage(error, 'ذخیره بنر ناموفق بود.'), 'error'),
  });

  const toggleMutation = useMutation({
    mutationFn: (/** @type {{ id: string, isActive: boolean }} */ input) => bannerApi.update(input.id, { isActive: input.isActive }),
    onSuccess: async (_response, input) => {
      await refresh();
      showNotification(input.isActive ? 'بنر فعال شد.' : 'بنر غیرفعال شد.', 'success');
    },
    onError: (error) => showNotification(getErrorMessage(error, 'تغییر وضعیت بنر ناموفق بود.'), 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: (/** @type {string} */ id) => bannerApi.remove(id),
    onSuccess: async () => {
      await refresh();
      showNotification('بنر حذف شد.', 'success');
      setDeleteTarget(null);
    },
    onError: (error) => showNotification(getErrorMessage(error, 'حذف بنر ناموفق بود.'), 'error'),
  });

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm, sortOrder: String(banners.length) });
    setFormOpen(true);
  };

  const openEdit = (banner) => {
    setEditing(banner);
    setForm({
      title: banner.title || '',
      desktopImageId: banner.desktopImageId || '',
      mobileImageId: banner.mobileImageId || '',
      linkUrl: banner.linkUrl || '',
      openInNewTab: banner.openInNewTab !== false,
      isActive: banner.isActive !== false,
      sortOrder: String(banner.sortOrder ?? 0),
      startsAt: banner.startsAt || '',
      endsAt: banner.endsAt || '',
      parkId: banner.parkId || '',
    });
    setFormOpen(true);
  };

  const closeForm = () => {
    if (saveMutation.isPending) return;
    setFormOpen(false);
    setEditing(null);
    setForm(emptyForm);
  };

  const set = (patch) => setForm((current) => ({ ...current, ...patch }));

  const submit = (event) => {
    event.preventDefault();
    if (imageUploading) {
      showNotification('تا پایان بارگذاری تصویر صبر کنید.', 'error');
      return;
    }
    const title = form.title.trim();
    if (title.length < 2) {
      showNotification('عنوان بنر را وارد کنید (حداقل ۲ نویسه).', 'error');
      return;
    }
    if (!form.desktopImageId || !form.mobileImageId) {
      showNotification('تصویر دسکتاپ و تصویر موبایل هر دو الزامی است.', 'error');
      return;
    }
    const linkUrl = form.linkUrl.trim();
    if (!isAllowedBannerLink(linkUrl)) {
      showNotification('لینک باید با https:// یا / (مسیر داخلی سامانه) شروع شود.', 'error');
      return;
    }
    const sortOrder = Number(form.sortOrder || 0);
    if (!Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 10000) {
      showNotification('ترتیب نمایش باید عددی بین ۰ تا ۱۰۰۰۰ باشد.', 'error');
      return;
    }
    if (form.startsAt && form.endsAt && new Date(form.endsAt).getTime() <= new Date(form.startsAt).getTime()) {
      showNotification('تاریخ پایان نمایش باید بعد از تاریخ شروع باشد.', 'error');
      return;
    }
    saveMutation.mutate({
      id: editing?.id,
      payload: {
        title,
        desktopImageId: form.desktopImageId,
        mobileImageId: form.mobileImageId,
        linkUrl: linkUrl || null,
        openInNewTab: form.openInNewTab,
        isActive: form.isActive,
        sortOrder,
        startsAt: form.startsAt || null,
        endsAt: form.endsAt || null,
        parkId: form.parkId || null,
      },
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="page-toolbar">
        <div>
          <h1 className="text-xl font-bold text-foreground sm:text-2xl">بنرهای داشبورد</h1>
          <p className="mt-1 text-sm text-foreground-500">
            بنرهای فعال هر ۶٫۵ ثانیه در بالای داشبورد کاربران می‌چرخند. برای هر بنر یک تصویر دسکتاپ و یک تصویر موبایل لازم است.
          </p>
        </div>
        <Button variant="primary" className="rounded-xl font-bold gap-1" onPress={openCreate}>
          <Plus className="h-4 w-4" />
          بنر جدید
        </Button>
      </div>

      {bannersQuery.isLoading && (
        <div className="flex min-h-[200px] items-center justify-center"><Spinner size="lg" /></div>
      )}
      {bannersQuery.isError && (
        <Alert status="danger">
          <AlertContent>
            <AlertTitle>خطا</AlertTitle>
            <AlertDescription>{getErrorMessage(bannersQuery.error, 'دریافت فهرست بنرها ناموفق بود.')}</AlertDescription>
          </AlertContent>
        </Alert>
      )}
      {!bannersQuery.isLoading && !bannersQuery.isError && banners.length === 0 && (
        <Card className="border border-default-200 rounded-2xl p-8 text-center dark:border-white/10">
          <p className="font-bold text-foreground">هنوز بنری ثبت نشده است</p>
          <p className="mt-2 text-sm text-foreground-500">تا زمانی که بنر فعالی وجود نداشته باشد، بخش بنر در داشبورد نمایش داده نمی‌شود.</p>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {banners.map((banner) => {
          const state = bannerState(banner);
          return (
            <Card key={banner.id} className="overflow-hidden border border-default-200 rounded-2xl shadow-sm dark:border-white/10" data-testid="banner-card">
              <div className="aspect-[4/1] w-full bg-default-100">
                <AuthenticatedImage
                  fileId={banner.desktopImageId}
                  alt={banner.title}
                  className="h-full w-full object-cover"
                  fallback={<div className="flex h-full items-center justify-center text-default-400"><ImageIcon className="h-6 w-6" /></div>}
                />
              </div>
              <CardContent className="flex flex-col gap-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-bold text-foreground">{banner.title}</p>
                  <Chip size="sm" variant="soft" color={/** @type {any} */ (state.color)}>{state.label}</Chip>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-foreground-500">
                  <span>محدوده: {banner.park?.name || 'همه شهرک‌ها'}</span>
                  <span>ترتیب: {Number(banner.sortOrder || 0).toLocaleString('fa-IR')}</span>
                  <span>کلیک: {Number(banner.clickCount || 0).toLocaleString('fa-IR')}</span>
                  {banner.startsAt && <span>از {formatFaDateTime(banner.startsAt)}</span>}
                  {banner.endsAt && <span>تا {formatFaDateTime(banner.endsAt)}</span>}
                </div>
                {banner.linkUrl && <p className="truncate text-xs text-primary" dir="ltr">{banner.linkUrl}</p>}
                <div className="mt-1 flex flex-wrap gap-2">
                  <Button size="sm" variant="tertiary" className="rounded-xl gap-1" onPress={() => openEdit(banner)}>
                    <Edit2 className="h-4 w-4" />
                    ویرایش
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="rounded-xl"
                    isDisabled={toggleMutation.isPending}
                    onPress={() => toggleMutation.mutate({ id: banner.id, isActive: !banner.isActive })}
                  >
                    {banner.isActive ? 'غیرفعال‌سازی' : 'فعال‌سازی'}
                  </Button>
                  <Button size="sm" variant="danger-soft" className="rounded-xl gap-1" onPress={() => setDeleteTarget(banner)}>
                    <Trash2 className="h-4 w-4" />
                    حذف
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {formOpen && (
        <ModalBackdrop isOpen={formOpen} onOpenChange={(open) => { if (!open) closeForm(); }} variant="blur">
          <ModalContainer size="lg">
            <ModalDialog className="rounded-2xl border border-default-200 bg-background p-6 dark:border-white/10">
              <form onSubmit={submit} className="flex flex-col gap-4">
                <ModalHeader className="text-lg font-bold">{editing ? 'ویرایش بنر' : 'بنر جدید'}</ModalHeader>
                <ModalBody className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto">
                  <div className="flex flex-col gap-1">
                    <Label className="text-xs font-medium text-foreground-600">عنوان بنر (متن جایگزین تصویر) <span className="text-danger">*</span></Label>
                    <Input value={form.title} maxLength={120} onChange={(e) => set({ title: e.target.value })} variant="primary" className="rounded-xl" />
                  </div>
                  <ImagePicker kind="desktop" fileId={form.desktopImageId} disabled={saveMutation.isPending} onUploadingChange={setKindUploading} onUploaded={(id) => set({ desktopImageId: id })} />
                  <ImagePicker kind="mobile" fileId={form.mobileImageId} disabled={saveMutation.isPending} onUploadingChange={setKindUploading} onUploaded={(id) => set({ mobileImageId: id })} />
                  <div className="flex flex-col gap-1">
                    <Label className="text-xs font-medium text-foreground-600">لینک (اختیاری)</Label>
                    <Input
                      value={form.linkUrl}
                      maxLength={500}
                      dir="ltr"
                      placeholder="https://example.com یا /ads"
                      onChange={(e) => set({ linkUrl: e.target.value })}
                      variant="primary"
                      className="rounded-xl"
                    />
                    <span className="text-[11px] text-foreground-500">لینک خارجی باید با https:// شروع شود؛ مسیر داخلی با / (مثلاً /announcements).</span>
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={form.openInNewTab} onChange={(e) => set({ openInNewTab: e.target.checked })} />
                    لینک خارجی در زبانهٔ جدید باز شود
                  </label>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="flex flex-col gap-1">
                      <Label className="text-xs font-medium text-foreground-600">محدوده نمایش</Label>
                      <select aria-label="محدوده نمایش" value={form.parkId} onChange={(e) => set({ parkId: e.target.value })} className={selectClass}>
                        <option value="">همه شهرک‌ها</option>
                        {parks.map((park) => <option key={park.id} value={park.id}>{park.name}</option>)}
                      </select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <Label className="text-xs font-medium text-foreground-600">ترتیب نمایش</Label>
                      <Input value={form.sortOrder} inputMode="numeric" dir="ltr" onChange={(e) => set({ sortOrder: e.target.value.replace(/[^\d]/g, '') })} variant="primary" className="rounded-xl" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="flex flex-col gap-1">
                      <JalaliDatePicker label="شروع نمایش (اختیاری)" value={form.startsAt} onChange={(value) => set({ startsAt: value })} includeTime />
                      {form.startsAt && <button type="button" className="self-start text-xs text-primary" onClick={() => set({ startsAt: '' })}>حذف تاریخ شروع</button>}
                    </div>
                    <div className="flex flex-col gap-1">
                      <JalaliDatePicker label="پایان نمایش (اختیاری)" value={form.endsAt} onChange={(value) => set({ endsAt: value })} includeTime />
                      {form.endsAt && <button type="button" className="self-start text-xs text-primary" onClick={() => set({ endsAt: '' })}>حذف تاریخ پایان</button>}
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={form.isActive} onChange={(e) => set({ isActive: e.target.checked })} />
                    بنر فعال باشد
                  </label>
                </ModalBody>
                <ModalFooter className="flex justify-end gap-2">
                  <Button type="button" variant="tertiary" className="rounded-xl" onPress={closeForm} isDisabled={saveMutation.isPending}>انصراف</Button>
                  <Button type="submit" variant="primary" className="rounded-xl font-bold" isDisabled={saveMutation.isPending || imageUploading}>
                    {saveMutation.isPending ? <Spinner size="sm" /> : 'ذخیره بنر'}
                  </Button>
                </ModalFooter>
              </form>
            </ModalDialog>
          </ModalContainer>
        </ModalBackdrop>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="حذف بنر"
        description={deleteTarget ? `بنر «${deleteTarget.title}» حذف شود؟ این کار قابل بازگشت نیست.` : ''}
        confirmLabel="حذف بنر"
        confirmColor="danger"
        loading={deleteMutation.isPending}
        onConfirm={() => { if (deleteTarget) deleteMutation.mutate(deleteTarget.id); }}
        onClose={() => { if (!deleteMutation.isPending) setDeleteTarget(null); }}
      />
    </div>
  );
};

export default ManageBannersPage;
