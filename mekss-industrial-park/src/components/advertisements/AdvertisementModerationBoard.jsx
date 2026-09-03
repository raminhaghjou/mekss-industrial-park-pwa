import React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  Chip,
  Button,
  Spinner,
  ModalBackdrop,
  ModalContainer,
  ModalDialog,
  ModalHeader,
  ModalHeading,
  ModalBody,
  ModalFooter,
  Input,
  Select,
  SelectTrigger,
  SelectValue,
  SelectIndicator,
  SelectPopover,
  ListBox,
  ListBoxItem,
  Label,
  Alert,
  AlertContent,
  AlertTitle,
  AlertDescription,
} from '@heroui/react';
import {
  RotateCw,
  Eye,
  Check,
  X,
  Search,
} from 'lucide-react';
import { advertisementApi } from '../../services/api/advertisement.api';
import { useNotification } from '../../providers/NotificationProvider';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { getErrorMessage } from '../../utils/apiError';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';

const categoryLabels = {
  EQUIPMENT: 'تجهیزات',
  SERVICES: 'خدمات',
  RAW_MATERIALS: 'مواد اولیه',
  JOB_LISTINGS: 'فرصت شغلی',
  REAL_ESTATE: 'املاک',
  OTHER: 'سایر',
};

const statusMeta = {
  PENDING: { label: 'در انتظار بررسی', color: 'warning' },
  APPROVED: { label: 'تایید شده', color: 'success' },
  REJECTED: { label: 'رد شده', color: 'danger' },
  EXPIRED: { label: 'منقضی شده', color: 'default' },
};

const advertisementCategoryKey = (advertisement) => advertisement.category?.key || advertisement.category;
const formatDate = (value) => value
  ? new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
  : '—';
const formatPrice = (value) => value === null || value === undefined
  ? 'توافقی'
  : `${new Intl.NumberFormat('fa-IR').format(Number(value))} ریال`;

const moderationError = (error, fallback) => {
  const status = error?.response?.status;
  if (status === 409) return 'این آگهی قبلاً بررسی شده است. فهرست را تازه کنید.';
  if (status === 403) return 'دسترسی شما به این آگهی یا شهرک آن مجاز نیست.';
  if (status === 404) return 'آگهی پیدا نشد یا دیگر در دسترس نیست.';
  return getErrorMessage(error, fallback);
};

const DetailRow = ({ label, children, ltr = false }) => (
  <div className="flex flex-col gap-0.5">
    <span className="text-xs text-foreground-500 font-medium">{label}</span>
    <span className={`text-sm font-semibold ${ltr ? 'text-left' : 'text-right'} break-words text-foreground`}>
      {children || '—'}
    </span>
  </div>
);

const FilterSelect = ({ label, value, onChange, children, placeholder }) => (
  <div className="flex flex-col gap-1">
    <Label className="text-xs font-medium text-foreground-600">{label}</Label>
    <Select
      value={value || null}
      onChange={(key) => onChange(key == null ? '' : String(key))}
      variant="primary"
      className="rounded-xl"
      placeholder={placeholder}
    >
      <SelectTrigger>
        <SelectValue />
        <SelectIndicator />
      </SelectTrigger>
      <SelectPopover>
        <ListBox>{children}</ListBox>
      </SelectPopover>
    </Select>
  </div>
);

const SearchFilters = ({
  view,
  draftSearch,
  setDraftSearch,
  status,
  setStatus,
  setPage,
  parkId,
  setParkId,
  showParkFilter,
  availableParks,
  onSubmit,
}) => (
  <form onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
    <div className="flex flex-col gap-1">
      <Label className="text-xs font-medium text-foreground-600">جست‌وجو</Label>
      <div className="relative flex items-center">
        <Search className="absolute right-3 h-4 w-4 text-default-400 pointer-events-none" />
        <Input
          placeholder="در عنوان، متن یا شهر..."
          value={draftSearch}
          onChange={(e) => setDraftSearch(e.target.value)}
          maxLength={200}
          variant="primary"
          className="pr-9 rounded-xl"
        />
      </div>
    </div>

    {view === 'HISTORY' && (
      <FilterSelect
        label="وضعیت"
        value={status}
        onChange={(val) => { setStatus(val || ''); setPage(1); }}
        placeholder="همه وضعیت‌ها"
      >
        <ListBoxItem id="APPROVED">تایید شده</ListBoxItem>
        <ListBoxItem id="REJECTED">رد شده</ListBoxItem>
        <ListBoxItem id="EXPIRED">منقضی شده</ListBoxItem>
      </FilterSelect>
    )}

    {showParkFilter && (
      <FilterSelect
        label="شهرک صنعتی"
        value={parkId}
        onChange={(val) => { setParkId(val || ''); setPage(1); }}
        placeholder="همه شهرک‌ها"
      >
        {(availableParks || []).map((park) => (
          <ListBoxItem key={park.id} id={park.id}>{park.name}</ListBoxItem>
        ))}
      </FilterSelect>
    )}

    <Button type="submit" className="rounded-xl font-bold" variant="primary">
      اعمال جست‌وجو
    </Button>
  </form>
);

export const AdvertisementModerationBoard = ({ showParkFilter = false }) => {
  const [tab, setTab] = React.useState('PENDING');
  const [page, setPage] = React.useState(1);
  const [draftSearch, setDraftSearch] = React.useState('');
  const [search, setSearch] = React.useState('');
  const [status, setStatus] = React.useState('');
  const [parkId, setParkId] = React.useState('');
  const [detailId, setDetailId] = React.useState(null);
  const [approveTarget, setApproveTarget] = React.useState(null);
  const [rejectTarget, setRejectTarget] = React.useState(null);
  const online = useOnlineStatus();
  const { showNotification } = useNotification();
  const queryClient = useQueryClient();
  const view = tab;

  const params = React.useMemo(() => ({
    view,
    page,
    pageSize: 12,
    ...(search ? { search } : {}),
    ...(view === 'HISTORY' && status ? { status } : {}),
    ...(showParkFilter && parkId ? { parkId } : {}),
  }), [page, parkId, search, showParkFilter, status, view]);

  const advertisementsQuery = useQuery({
    queryKey: ['advertisements', 'managed', params],
    queryFn: () => advertisementApi.getManagedAdvertisements(params).then((response) => response.data),
  });

  const detailQuery = useQuery({
    queryKey: ['advertisements', 'managed', 'detail', detailId],
    queryFn: () => advertisementApi.getManagedAdvertisement(detailId).then((response) => response.data),
    enabled: Boolean(detailId),
  });

  const reconcile = async (id) => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['advertisements', 'managed'] }),
      queryClient.invalidateQueries({ queryKey: ['analytics', 'dashboard'] }),
      id ? queryClient.invalidateQueries({ queryKey: ['advertisements', 'managed', 'detail', id] }) : Promise.resolve(),
    ]);
  };

  const moderationFailure = async (error, id, fallback) => {
    if ([404, 409].includes(error?.response?.status)) await reconcile(id);
    showNotification(moderationError(error, fallback), 'error');
  };

  const approveMutation = useMutation({
    mutationFn: (id) => advertisementApi.approveAdvertisement(id),
    onSuccess: async (_, id) => {
      await reconcile(id);
      setApproveTarget(null);
      showNotification('تایید آگهی ثبت و فهرست به‌روزرسانی شد.', 'success');
    },
    onError: (error, id) => moderationFailure(error, id, 'تایید آگهی ناموفق بود.'),
  });

  const rejectMutation = useMutation({
    mutationFn: (/** @type {{id: string, reason: string}} */ { id, reason }) => advertisementApi.rejectAdvertisement(id, reason),
    onSuccess: async (_, variables) => {
      await reconcile(variables.id);
      setRejectTarget(null);
      showNotification('رد آگهی ثبت و فهرست به‌روزرسانی شد.', 'success');
    },
    onError: (error, variables) => moderationFailure(error, variables.id, 'رد آگهی ناموفق بود.'),
  });

  const decisionPending = approveMutation.isPending || rejectMutation.isPending;
  const data = advertisementsQuery.data || { items: [], total: 0, page: 1, pageSize: 12, availableParks: [] };
  const ads = data.items || [];
  const pageCount = Math.max(1, Math.ceil((data.total || 0) / (data.pageSize || 12)));

  const changeTab = (key) => {
    setTab(String(key));
    setPage(1);
    setStatus('');
  };

  const submitSearch = (event) => {
    event.preventDefault();
    setPage(1);
    setSearch(draftSearch.trim());
  };

  const filterProps = {
    draftSearch,
    setDraftSearch,
    status,
    setStatus,
    setPage,
    parkId,
    setParkId,
    showParkFilter,
    availableParks: data.availableParks,
    onSubmit: submitSearch,
  };

  return (
    <div className="flex flex-col gap-6">
      {!online && (
        <Alert status="warning">
          <AlertContent>
            <AlertTitle>حالت آفلاین</AlertTitle>
            <AlertDescription>برای ثبت تصمیم باید دوباره به اینترنت متصل شوید. اطلاعات فعلی فقط برای مشاهده است.</AlertDescription>
          </AlertContent>
        </Alert>
      )}

      <Card className="border border-default-200 shadow-sm rounded-2xl dark:border-white/10">
        <CardContent className="p-4 flex flex-col gap-4">
          <div className="flex gap-2 rounded-xl bg-default-100 p-1 dark:bg-default-50/10">
            <Button
              variant={tab === 'PENDING' ? 'primary' : 'ghost'}
              className="flex-1 rounded-lg font-medium"
              onPress={() => changeTab('PENDING')}
            >
              در انتظار تایید
            </Button>
            <Button
              variant={tab === 'HISTORY' ? 'primary' : 'ghost'}
              className="flex-1 rounded-lg font-medium"
              onPress={() => changeTab('HISTORY')}
            >
              تاریخچه تصمیم‌ها
            </Button>
          </div>
          <SearchFilters view={view} {...filterProps} />
        </CardContent>
      </Card>

      {advertisementsQuery.isLoading && (
        <div className="flex min-h-[220px] items-center justify-center">
          <Spinner size="lg" />
        </div>
      )}

      {advertisementsQuery.isError && (
        <Alert status="danger" className="flex flex-wrap items-center justify-between gap-3">
          <AlertContent>
            <AlertTitle>خطا در دریافت اطلاعات</AlertTitle>
            <AlertDescription>{moderationError(advertisementsQuery.error, 'دریافت آگهی‌ها ناموفق بود.')}</AlertDescription>
          </AlertContent>
          <Button size="sm" variant="secondary" onPress={() => advertisementsQuery.refetch()} className="rounded-xl flex items-center gap-2">
            <RotateCw className="h-4 w-4" />
            تلاش دوباره
          </Button>
        </Alert>
      )}

      {!advertisementsQuery.isLoading && !advertisementsQuery.isError && ads.length === 0 && (
        <Card className="p-8 text-center border border-default-200 rounded-2xl">
          <h3 className="text-lg font-bold text-foreground">موردی پیدا نشد</h3>
          <p className="mt-2 text-sm text-foreground-500">فیلترها را تغییر دهید یا بعداً دوباره بررسی کنید.</p>
        </Card>
      )}

      {!advertisementsQuery.isLoading && !advertisementsQuery.isError && ads.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {ads.map((ad) => {
            const meta = statusMeta[ad.status] || { label: ad.status, color: 'default' };
            return (
              <Card key={ad.id} className="flex flex-col border border-default-200 hover:border-primary-400 transition-all rounded-2xl dark:border-white/10">
                <CardHeader className="flex items-start justify-between gap-2 p-4 pb-2">
                  <div className="flex flex-col min-w-0">
                    <h3 className="text-base font-bold text-foreground truncate">{ad.title}</h3>
                    <span className="text-xs text-foreground-500 mt-0.5">
                      {ad.createdBy?.name} · {ad.park?.name || 'بدون شهرک مشخص'}
                    </span>
                  </div>
                  <Chip size="sm" color={meta.color} variant="soft" className="font-semibold">
                    {meta.label}
                  </Chip>
                </CardHeader>
                <CardContent className="px-4 py-2 flex-1">
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    <Chip size="sm" variant="primary" className="text-xs">
                      {categoryLabels[advertisementCategoryKey(ad)] || advertisementCategoryKey(ad)}
                    </Chip>
                    <Chip size="sm" variant="primary" className="text-xs">
                      {`${ad.province}، ${ad.city}`}
                    </Chip>
                  </div>
                  <p className="text-xs text-foreground-600 line-clamp-3 leading-relaxed">
                    {ad.content}
                  </p>
                  {ad.status === 'REJECTED' && ad.rejectionReason && (
                    <div className="mt-3 p-2 rounded-xl bg-danger-50 text-danger-700 dark:bg-danger-950/40 text-xs">
                      دلیل رد: {ad.rejectionReason}
                    </div>
                  )}
                  <span className="block mt-3 text-[11px] text-foreground-400">
                    ثبت: {formatDate(ad.createdAt)}
                  </span>
                </CardContent>
                <CardFooter className="p-4 pt-2 flex items-center justify-between border-t border-default-100 dark:border-white/5">
                  <Button size="sm" variant="ghost" onPress={() => setDetailId(ad.id)} className="rounded-xl font-medium flex items-center gap-2">
                    <Eye className="h-4 w-4" />
                    جزئیات
                  </Button>
                  {ad.status === 'PENDING' && (
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="primary"
                        onPress={() => setApproveTarget(ad)}
                        isDisabled={decisionPending || !online}
                        className="rounded-xl text-white font-bold flex items-center gap-2"
                      >
                        <Check className="h-4 w-4" />
                        تایید
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onPress={() => setRejectTarget(ad)}
                        isDisabled={decisionPending || !online}
                        className="rounded-xl font-bold flex items-center gap-2"
                      >
                        <X className="h-4 w-4" />
                        رد
                      </Button>
                    </div>
                  )}
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}

      {!advertisementsQuery.isError && data.total > data.pageSize && (
        <div className="flex justify-center mt-4">
          <div className="flex items-center gap-3">
            <Button size="sm" variant="ghost" isDisabled={page <= 1} onPress={() => setPage((p) => p - 1)}>قبلی</Button>
            <span className="text-sm text-foreground-500">{page} / {pageCount}</span>
            <Button size="sm" variant="ghost" isDisabled={page >= pageCount} onPress={() => setPage((p) => p + 1)}>بعدی</Button>
          </div>
        </div>
      )}

      {Boolean(detailId) && (
        <ModalBackdrop isOpen={Boolean(detailId)} onOpenChange={(open) => !open && setDetailId(null)} variant="blur">
          <ModalContainer size="lg">
            <ModalDialog aria-label="جزئیات آگهی" className="rounded-2xl border border-default-200 dark:border-white/10 p-6 bg-background">
              <ModalHeader className="text-lg font-bold">
                <ModalHeading>جزئیات آگهی</ModalHeading>
              </ModalHeader>
              <ModalBody className="gap-4 max-h-[75vh] overflow-y-auto">
                {detailQuery.isLoading && (
                  <div className="flex min-h-[200px] items-center justify-center">
                    <Spinner size="lg" />
                  </div>
                )}
                {detailQuery.isError && (
                  <Alert status="danger">
                    <AlertContent>
                      <AlertTitle>خطا</AlertTitle>
                      <AlertDescription>{moderationError(detailQuery.error, 'دریافت جزئیات آگهی ناموفق بود.')}</AlertDescription>
                    </AlertContent>
                  </Alert>
                )}
                {detailQuery.data && (
                  <div className="flex flex-col gap-4">
                    <div>
                      <h2 className="text-xl font-bold text-foreground">{detailQuery.data.title}</h2>
                      <p className="mt-2 text-sm text-foreground-600 leading-relaxed whitespace-pre-line">{detailQuery.data.content}</p>
                    </div>
                    {detailQuery.data.images?.length > 0 && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {detailQuery.data.images.map((image, index) => (
                          <img
                            key={`${image}-${index}`}
                            src={image}
                            alt={`تصویر ${index + 1} آگهی ${detailQuery.data.title}`}
                            loading="lazy"
                            className="w-full h-48 object-cover rounded-xl border border-default-200"
                          />
                        ))}
                      </div>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-default-50 dark:bg-default-100/30">
                      <DetailRow label="شهرک صنعتی">{detailQuery.data.park?.name || 'بدون شهرک مشخص'}</DetailRow>
                      <DetailRow label="ثبت‌کننده">{detailQuery.data.createdBy?.name}</DetailRow>
                      <DetailRow label="موقعیت">{`${detailQuery.data.province}، ${detailQuery.data.city}`}</DetailRow>
                      <DetailRow label="نشانی">{detailQuery.data.address}</DetailRow>
                      <DetailRow label="قیمت">{formatPrice(detailQuery.data.price)}</DetailRow>
                      <DetailRow label="تاریخ ثبت">{formatDate(detailQuery.data.createdAt)}</DetailRow>
                      <DetailRow label="تلفن تماس" ltr>{detailQuery.data.contactInfo?.phone || detailQuery.data.contactInfo?.phoneNumber}</DetailRow>
                      <DetailRow label="ایمیل تماس" ltr>{detailQuery.data.contactInfo?.email}</DetailRow>
                      <DetailRow label="بررسی‌کننده">{detailQuery.data.moderatedBy?.name}</DetailRow>
                      <DetailRow label="زمان بررسی">{formatDate(detailQuery.data.moderatedAt)}</DetailRow>
                    </div>
                  </div>
                )}
              </ModalBody>
              <ModalFooter>
                <Button variant="secondary" onPress={() => setDetailId(null)} className="rounded-xl font-medium">
                  بستن
                </Button>
              </ModalFooter>
            </ModalDialog>
          </ModalContainer>
        </ModalBackdrop>
      )}

      <ConfirmDialog
        open={Boolean(approveTarget)}
        title="تایید آگهی"
        description={approveTarget ? `آگهی «${approveTarget.title}» برای نمایش عمومی تایید شود؟ این تصمیم قابل تکرار نیست.` : ''}
        confirmLabel="تایید و انتشار"
        loading={decisionPending}
        disabled={!online}
        onConfirm={() => {
          if (online && approveTarget) approveMutation.mutate(approveTarget.id);
        }}
        onClose={() => { if (!decisionPending) setApproveTarget(null); }}
      />
      <ConfirmDialog
        open={Boolean(rejectTarget)}
        title="رد آگهی"
        description={rejectTarget ? `دلیل رد آگهی «${rejectTarget.title}» را ثبت کنید. این تصمیم در تاریخچه باقی می‌ماند.` : ''}
        requireReason
        reasonLabel="دلیل رد"
        confirmLabel="ثبت رد آگهی"
        confirmColor="danger"
        loading={decisionPending}
        disabled={!online}
        onConfirm={(reason) => {
          if (online && rejectTarget) rejectMutation.mutate({ id: rejectTarget.id, reason });
        }}
        onClose={() => { if (!decisionPending) setRejectTarget(null); }}
      />
    </div>
  );
};

export default AdvertisementModerationBoard;
