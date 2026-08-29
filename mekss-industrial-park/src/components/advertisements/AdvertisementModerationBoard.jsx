import React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Pagination,
  Paper,
  Select,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import {
  CheckCircleOutline as ApproveIcon,
  Refresh as RefreshIcon,
  VisibilityOutlined as ViewIcon,
} from '@mui/icons-material';
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
  REJECTED: { label: 'رد شده', color: 'error' },
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
  <Box>
    <Typography variant="caption" color="text.secondary">{label}</Typography>
    <Typography variant="body2" dir={ltr ? 'ltr' : 'rtl'} sx={{ mt: 0.25, overflowWrap: 'anywhere' }}>{children || '—'}</Typography>
  </Box>
);

/**
 * Shared server-scoped moderation surface. Backend scope is authoritative;
 * frontend filters only narrow the records already authorized by the API.
 */
export const AdvertisementModerationBoard = ({ showParkFilter = false }) => {
  const [tab, setTab] = React.useState(0);
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
  const view = tab === 0 ? 'PENDING' : 'HISTORY';

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

  const changeTab = (_, value) => {
    setTab(value);
    setPage(1);
    setStatus('');
  };

  const submitSearch = (event) => {
    event.preventDefault();
    setPage(1);
    setSearch(draftSearch.trim());
  };

  return (
    <Stack spacing={2.5}>
      {!online && (
        <Alert severity="warning">برای ثبت تصمیم باید دوباره به اینترنت متصل شوید. اطلاعات فعلی فقط برای مشاهده است.</Alert>
      )}

      <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
        <Tabs value={tab} onChange={changeTab} variant="fullWidth" aria-label="وضعیت بررسی آگهی‌ها">
          <Tab label="در انتظار تایید" />
          <Tab label="تاریخچه تصمیم‌ها" />
        </Tabs>
        <Box
          component="form"
          onSubmit={submitSearch}
          sx={{ p: 2, borderTop: 1, borderColor: 'divider', display: 'grid', gridTemplateColumns: { xs: '1fr', md: showParkFilter ? 'minmax(220px, 1fr) 190px 210px auto' : 'minmax(220px, 1fr) 190px auto' }, gap: 1.5, alignItems: 'center' }}
        >
          <TextField
            size="small"
            label="جست‌وجو در عنوان، متن یا شهر"
            value={draftSearch}
            onChange={(event) => setDraftSearch(event.target.value)}
            inputProps={{ maxLength: 200 }}
          />
          {view === 'HISTORY' && (
            <FormControl size="small">
              <InputLabel id="advertisement-status-filter">وضعیت</InputLabel>
              <Select
                labelId="advertisement-status-filter"
                label="وضعیت"
                value={status}
                onChange={(event) => { setStatus(event.target.value); setPage(1); }}
              >
                <MenuItem value="">همه تصمیم‌ها</MenuItem>
                <MenuItem value="APPROVED">تایید شده</MenuItem>
                <MenuItem value="REJECTED">رد شده</MenuItem>
                <MenuItem value="EXPIRED">منقضی شده</MenuItem>
              </Select>
            </FormControl>
          )}
          {showParkFilter && (
            <FormControl size="small">
              <InputLabel id="advertisement-park-filter">شهرک صنعتی</InputLabel>
              <Select
                labelId="advertisement-park-filter"
                label="شهرک صنعتی"
                value={parkId}
                onChange={(event) => { setParkId(event.target.value); setPage(1); }}
              >
                <MenuItem value="">همه شهرک‌ها</MenuItem>
                {(data.availableParks || []).map((park) => <MenuItem key={park.id} value={park.id}>{park.name}</MenuItem>)}
              </Select>
            </FormControl>
          )}
          <Button type="submit" variant="contained">اعمال جست‌وجو</Button>
        </Box>
      </Paper>

      {advertisementsQuery.isLoading && (
        <Box sx={{ display: 'grid', placeItems: 'center', minHeight: 220 }}><CircularProgress aria-label="در حال دریافت آگهی‌ها" /></Box>
      )}
      {advertisementsQuery.isError && (
        <Alert
          severity="error"
          action={<Button color="inherit" startIcon={<RefreshIcon />} onClick={() => advertisementsQuery.refetch()}>تلاش دوباره</Button>}
        >
          {moderationError(advertisementsQuery.error, 'دریافت آگهی‌ها ناموفق بود.')}
        </Alert>
      )}
      {!advertisementsQuery.isLoading && !advertisementsQuery.isError && ads.length === 0 && (
        <Paper variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h6">موردی پیدا نشد</Typography>
          <Typography color="text.secondary" sx={{ mt: 0.75 }}>فیلترها را تغییر دهید یا بعداً دوباره بررسی کنید.</Typography>
        </Paper>
      )}
      {!advertisementsQuery.isLoading && !advertisementsQuery.isError && ads.length > 0 && (
        <Grid container spacing={2}>
          {ads.map((ad) => {
            const meta = statusMeta[ad.status] || { label: ad.status, color: 'default' };
            return (
              <Grid item xs={12} md={6} xl={4} key={ad.id}>
                <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <CardContent sx={{ flex: 1 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="h6" sx={{ overflowWrap: 'anywhere' }}>{ad.title}</Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                          {ad.createdBy?.name} · {ad.park?.name || 'بدون شهرک مشخص'}
                        </Typography>
                      </Box>
                      <Chip size="small" label={meta.label} color={meta.color} />
                    </Stack>
                    <Stack direction="row" spacing={1} sx={{ mt: 1.5, flexWrap: 'wrap', gap: 0.5 }}>
                      <Chip size="small" variant="outlined" label={categoryLabels[advertisementCategoryKey(ad)] || advertisementCategoryKey(ad)} />
                      <Chip size="small" variant="outlined" label={`${ad.province}، ${ad.city}`} />
                    </Stack>
                    <Typography variant="body2" sx={{ mt: 1.5, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {ad.content}
                    </Typography>
                    {ad.status === 'REJECTED' && ad.rejectionReason && (
                      <Alert severity="error" icon={false} sx={{ mt: 1.5, py: 0.5 }}>دلیل رد: {ad.rejectionReason}</Alert>
                    )}
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
                      ثبت: {formatDate(ad.createdAt)}
                    </Typography>
                  </CardContent>
                  <CardActions sx={{ px: 2, pb: 2, pt: 0 }}>
                    <Button startIcon={<ViewIcon />} onClick={() => setDetailId(ad.id)}>جزئیات</Button>
                    {ad.status === 'PENDING' && (
                      <>
                        <Button
                          color="success"
                          startIcon={<ApproveIcon />}
                          onClick={() => setApproveTarget(ad)}
                          disabled={decisionPending || !online}
                        >
                          تایید
                        </Button>
                        <Button color="error" onClick={() => setRejectTarget(ad)} disabled={decisionPending || !online}>رد</Button>
                      </>
                    )}
                  </CardActions>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}

      {!advertisementsQuery.isError && data.total > data.pageSize && (
        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
          <Pagination page={page} count={pageCount} onChange={(_, value) => setPage(value)} color="primary" />
        </Box>
      )}

      <Dialog open={Boolean(detailId)} onClose={() => setDetailId(null)} maxWidth="md" fullWidth aria-labelledby="advertisement-detail-title">
        <DialogTitle id="advertisement-detail-title">جزئیات آگهی</DialogTitle>
        <DialogContent dividers>
          {detailQuery.isLoading && <Box sx={{ display: 'grid', placeItems: 'center', minHeight: 220 }}><CircularProgress /></Box>}
          {detailQuery.isError && (
            <Alert severity="error" action={<Button color="inherit" onClick={() => detailQuery.refetch()}>تلاش دوباره</Button>}>
              {moderationError(detailQuery.error, 'دریافت جزئیات آگهی ناموفق بود.')}
            </Alert>
          )}
          {detailQuery.data && (
            <Stack spacing={2.5}>
              <Box>
                <Typography variant="h5">{detailQuery.data.title}</Typography>
                <Typography color="text.secondary" sx={{ mt: 0.5 }}>{detailQuery.data.content}</Typography>
              </Box>
              {detailQuery.data.images?.length > 0 && (
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' }, gap: 1.5 }}>
                  {detailQuery.data.images.map((image, index) => (
                    <Box
                      component="img"
                      key={`${image}-${index}`}
                      src={image}
                      alt={`تصویر ${index + 1} آگهی ${detailQuery.data.title}`}
                      loading="lazy"
                      sx={{ width: '100%', height: 200, objectFit: 'cover', borderRadius: 2, border: 1, borderColor: 'divider' }}
                    />
                  ))}
                </Box>
              )}
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' }, gap: 2 }}>
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
              </Box>
            </Stack>
          )}
        </DialogContent>
        <DialogActions><Button onClick={() => setDetailId(null)}>بستن</Button></DialogActions>
      </Dialog>

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
        confirmColor="error"
        loading={decisionPending}
        disabled={!online}
        onConfirm={(reason) => {
          if (online && rejectTarget) rejectMutation.mutate({ id: rejectTarget.id, reason });
        }}
        onClose={() => { if (!decisionPending) setRejectTarget(null); }}
      />
    </Stack>
  );
};

export default AdvertisementModerationBoard;
