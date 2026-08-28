import React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Pagination,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import {
  Add as AddIcon,
  CheckCircleOutline as ApproveIcon,
  EditOutlined as EditIcon,
  Refresh as RefreshIcon,
  VisibilityOutlined as ViewIcon,
} from '@mui/icons-material';
import { factoryApi } from '../../services/api/factory.api';
import { useNotification } from '../../providers/NotificationProvider';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { getErrorMessage } from '../../utils/apiError';

const PAGE_SIZE = 12;
const statusMeta = {
  PENDING: { label: 'در انتظار تایید', color: 'warning' },
  ACTIVE: { label: 'فعال', color: 'success' },
  INACTIVE: { label: 'غیرفعال', color: 'default' },
  SUSPENDED: { label: 'معلق', color: 'error' },
};

const requiredCreateFields = [
  'name', 'licenseNumber', 'nationalId', 'activityType', 'address', 'phoneNumber', 'parkId', 'managerId',
];
const requiredProfileFields = ['name', 'licenseNumber', 'nationalId', 'activityType', 'address', 'phoneNumber'];
const optionalTextFields = ['phoneNumber2', 'landline', 'fax', 'email', 'website', 'description'];
const profileFields = [...requiredProfileFields, ...optionalTextFields, 'employees'];
const createFields = [...profileFields, 'parkId', 'managerId'];
/** @typedef {{ type: 'create' | 'update' | 'approve' | 'reject', id?: string, payload?: Record<string, any>, reason?: string }} FactoryOperation */
const emptyForm = {
  name: '',
  licenseNumber: '',
  nationalId: '',
  activityType: '',
  address: '',
  phoneNumber: '',
  phoneNumber2: '',
  landline: '',
  fax: '',
  email: '',
  website: '',
  description: '',
  employees: '',
  parkId: '',
  managerId: '',
};

const useOnlineStatus = () => {
  const [online, setOnline] = React.useState(() => typeof navigator === 'undefined' || navigator.onLine);
  React.useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);
  return online;
};

const factoryError = (error, fallback) => {
  const status = error?.response?.status;
  if (status === 409) return 'اطلاعات این واحد صنعتی هم‌زمان تغییر کرده است. داده‌های معتبر دوباره دریافت شد؛ لطفاً بررسی و دوباره تلاش کنید.';
  if (status === 404) return 'واحد صنعتی پیدا نشد یا دیگر در محدوده دسترسی شما نیست. فهرست دوباره دریافت شد.';
  if (status === 403) return 'اجازه انجام این عملیات برای واحد صنعتی یا شهرک انتخاب‌شده را ندارید.';
  return getErrorMessage(error, fallback);
};

const compactPayload = (form, fields) => fields.reduce((payload, field) => {
  const value = form[field];
  if (field === 'employees') {
    if (value !== '') payload.employees = Number(value);
  } else if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed) payload[field] = trimmed;
  }
  return payload;
}, {});

const profilePayload = (form) => ({
  ...requiredProfileFields.reduce((payload, field) => ({ ...payload, [field]: form[field].trim() }), {}),
  ...optionalTextFields.reduce((payload, field) => ({ ...payload, [field]: form[field].trim() || null }), {}),
  employees: form.employees === '' ? 0 : Number(form.employees),
});

const toForm = (factory) => profileFields.reduce((form, field) => ({
  ...form,
  [field]: factory?.[field] === null || factory?.[field] === undefined ? '' : String(factory[field]),
}), { ...emptyForm });

const DetailRow = ({ label, children, ltr = false }) => (
  <Box>
    <Typography variant="caption" color="text.secondary">{label}</Typography>
    <Typography variant="body2" dir={ltr ? 'ltr' : 'rtl'} sx={{ mt: 0.25, overflowWrap: 'anywhere' }}>{children || '—'}</Typography>
  </Box>
);

const FactoryFormFields = ({ form, setForm, editing, parks, owners, disabled }) => {
  const setField = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' }, gap: 2, pt: 0.5 }}>
      <TextField required label="نام واحد صنعتی" value={form.name} onChange={setField('name')} disabled={disabled} inputProps={{ maxLength: 160 }} />
      <TextField required label="شماره مجوز" value={form.licenseNumber} onChange={setField('licenseNumber')} disabled={disabled} inputProps={{ maxLength: 80 }} />
      <TextField required label="شناسه ملی" value={form.nationalId} onChange={setField('nationalId')} disabled={disabled} inputProps={{ inputMode: 'numeric', maxLength: 11 }} />
      <TextField required label="نوع فعالیت" value={form.activityType} onChange={setField('activityType')} disabled={disabled} inputProps={{ maxLength: 120 }} />
      <TextField required label="تلفن همراه" value={form.phoneNumber} onChange={setField('phoneNumber')} disabled={disabled} inputProps={{ inputMode: 'tel', maxLength: 11 }} />
      <TextField label="تلفن همراه دوم" value={form.phoneNumber2} onChange={setField('phoneNumber2')} disabled={disabled} inputProps={{ inputMode: 'tel', maxLength: 11 }} />
      <TextField label="تلفن ثابت" value={form.landline} onChange={setField('landline')} disabled={disabled} inputProps={{ inputMode: 'tel', maxLength: 20 }} />
      <TextField label="نمابر" value={form.fax} onChange={setField('fax')} disabled={disabled} inputProps={{ inputMode: 'tel', maxLength: 20 }} />
      <TextField type="email" label="ایمیل" value={form.email} onChange={setField('email')} disabled={disabled} inputProps={{ maxLength: 254 }} />
      <TextField type="url" label="وب‌سایت" value={form.website} onChange={setField('website')} disabled={disabled} inputProps={{ maxLength: 300 }} />
      <TextField type="number" label="تعداد کارکنان" value={form.employees} onChange={setField('employees')} disabled={disabled} inputProps={{ min: 0, max: 1000000 }} />
      {!editing && (
        <FormControl required disabled={disabled}>
          <InputLabel id="factory-park-label">شهرک صنعتی</InputLabel>
          <Select labelId="factory-park-label" label="شهرک صنعتی" value={form.parkId} onChange={setField('parkId')}>
            {parks.map((park) => <MenuItem key={park.id} value={park.id}>{park.name}</MenuItem>)}
          </Select>
        </FormControl>
      )}
      {!editing && (
        <FormControl required disabled={disabled}>
          <InputLabel id="factory-owner-label">مالک / مدیر واحد</InputLabel>
          <Select labelId="factory-owner-label" label="مالک / مدیر واحد" value={form.managerId} onChange={setField('managerId')}>
            {owners.map((owner) => <MenuItem key={owner.id} value={owner.id}>{owner.name || owner.phoneNumber}</MenuItem>)}
          </Select>
        </FormControl>
      )}
      <TextField
        required
        multiline
        minRows={2}
        label="نشانی"
        value={form.address}
        onChange={setField('address')}
        disabled={disabled}
        inputProps={{ maxLength: 240 }}
        sx={{ gridColumn: '1 / -1' }}
      />
      <TextField
        multiline
        minRows={3}
        label="توضیحات"
        value={form.description}
        onChange={setField('description')}
        disabled={disabled}
        inputProps={{ maxLength: 2000 }}
        sx={{ gridColumn: '1 / -1' }}
      />
    </Box>
  );
};

const ManageFactoriesPage = () => {
  const [page, setPage] = React.useState(1);
  const [draftSearch, setDraftSearch] = React.useState('');
  const [search, setSearch] = React.useState('');
  const [status, setStatus] = React.useState('');
  const [parkId, setParkId] = React.useState('');
  const [detailId, setDetailId] = React.useState(null);
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState(null);
  const [editLoadingId, setEditLoadingId] = React.useState(null);
  const [form, setForm] = React.useState(emptyForm);
  const [approveTarget, setApproveTarget] = React.useState(null);
  const [rejectTarget, setRejectTarget] = React.useState(null);
  const [mutationLocked, setMutationLocked] = React.useState(false);
  const mutationLockRef = React.useRef(false);
  const detail404Ref = React.useRef(null);
  const online = useOnlineStatus();
  const { showNotification } = useNotification();
  const queryClient = useQueryClient();

  const params = React.useMemo(() => ({
    page,
    pageSize: PAGE_SIZE,
    ...(search ? { search } : {}),
    ...(status ? { status } : {}),
    ...(parkId ? { parkId } : {}),
  }), [page, parkId, search, status]);

  const factoriesQuery = useQuery({
    queryKey: ['factories', 'managed', params],
    queryFn: () => factoryApi.getManagedFactories(params).then((response) => response.data),
  });
  const detailQuery = useQuery({
    queryKey: ['factories', 'managed', 'detail', detailId],
    queryFn: () => factoryApi.getManagedFactory(detailId).then((response) => response.data),
    enabled: Boolean(detailId),
  });
  const scopeQuery = useQuery({
    queryKey: ['factories', 'management-scope'],
    queryFn: () => factoryApi.getManagementScope().then((response) => response.data),
  });

  const reconcile = React.useCallback(async (id) => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['factories', 'managed'] }),
      id ? queryClient.invalidateQueries({ queryKey: ['factories', 'managed', 'detail', id] }) : Promise.resolve(),
      queryClient.invalidateQueries({ queryKey: ['analytics', 'dashboard'] }),
      queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
      queryClient.invalidateQueries({ queryKey: ['factories', 'management-scope'] }),
      queryClient.invalidateQueries({ queryKey: ['factories', 'managed'], exact: true }),
    ]);
  }, [queryClient]);

  React.useEffect(() => {
    if (!detailId) {
      detail404Ref.current = null;
      return;
    }
    if ((/** @type {any} */ (detailQuery.error))?.response?.status === 404 && detail404Ref.current !== detailId) {
      detail404Ref.current = detailId;
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ['factories', 'managed', params], exact: true }),
        queryClient.invalidateQueries({ queryKey: ['factories', 'managed'], exact: true }),
      ]);
    }
  }, [detailId, detailQuery.error, params, queryClient]);

  const closeForm = () => {
    if (mutationLockRef.current) return;
    setFormOpen(false);
    setEditing(null);
    setForm(emptyForm);
  };

  const mutation = useMutation({
    mutationFn: (/** @type {FactoryOperation} */ operation) => {
      if (operation.type === 'create') return factoryApi.createFactory(operation.payload);
      if (operation.type === 'update') return factoryApi.updateFactory(operation.id, operation.payload);
      if (operation.type === 'approve') return factoryApi.approveFactory(operation.id);
      return factoryApi.rejectFactory(operation.id, operation.reason);
    },
    onSuccess: async (response, /** @type {FactoryOperation} */ operation) => {
      const targetId = operation.id || response?.data?.id;
      await reconcile(targetId);
      if (operation.type === 'create' || operation.type === 'update') {
        setFormOpen(false);
        setEditing(null);
        setForm(emptyForm);
      }
      if (operation.type === 'approve') setApproveTarget(null);
      if (operation.type === 'reject') setRejectTarget(null);
      const messages = {
        create: 'واحد صنعتی ثبت و داده‌های مدیریتی به‌روزرسانی شد.',
        update: 'اطلاعات واحد صنعتی ذخیره و دوباره دریافت شد.',
        approve: 'تایید واحد صنعتی ثبت و فهرست به‌روزرسانی شد.',
        reject: 'رد واحد صنعتی ثبت و فهرست به‌روزرسانی شد.',
      };
      showNotification(messages[operation.type], 'success');
    },
    onError: async (/** @type {any} */ error, /** @type {FactoryOperation} */ operation) => {
      if ([404, 409].includes(error?.response?.status)) await reconcile(operation.id);
      const fallbacks = {
        create: 'ثبت واحد صنعتی ناموفق بود.',
        update: 'ویرایش واحد صنعتی ناموفق بود.',
        approve: 'تایید واحد صنعتی ناموفق بود.',
        reject: 'رد واحد صنعتی ناموفق بود.',
      };
      showNotification(factoryError(error, fallbacks[operation.type]), 'error');
    },
    onSettled: () => {
      mutationLockRef.current = false;
      setMutationLocked(false);
    },
  });

  const mutationPending = mutation.isPending || mutationLocked;
  const runMutation = (/** @type {FactoryOperation} */ operation) => {
    if (!online || mutationLockRef.current) return;
    mutationLockRef.current = true;
    setMutationLocked(true);
    mutation.mutate(operation);
  };

  const submitSearch = (event) => {
    event.preventDefault();
    setPage(1);
    setSearch(draftSearch.trim());
  };
  const startCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setFormOpen(true);
  };
  const startEdit = async (factory) => {
    if (editLoadingId) return;
    setEditLoadingId(factory.id);
    try {
      const authoritativeFactory = await queryClient.fetchQuery({
        queryKey: ['factories', 'managed', 'detail', factory.id],
        queryFn: () => factoryApi.getManagedFactory(factory.id).then((response) => response.data),
      });
      setEditing(authoritativeFactory);
      setForm(toForm(authoritativeFactory));
      setFormOpen(true);
    } catch (error) {
      if ([404, 409].includes((/** @type {any} */ (error))?.response?.status)) await reconcile(factory.id);
      showNotification(factoryError(error, 'دریافت اطلاعات قابل ویرایش واحد صنعتی ناموفق بود.'), 'error');
    } finally {
      setEditLoadingId(null);
    }
  };
  const submitForm = (event) => {
    event.preventDefault();
    if (!online || mutationLockRef.current) return;
    const missingRequired = requiredCreateFields
      .filter((field) => !editing || !['parkId', 'managerId'].includes(field))
      .some((field) => !String(form[field] || '').trim());
    if (missingRequired) {
      showNotification('لطفاً همه فیلدهای الزامی را تکمیل کنید.', 'error');
      return;
    }
    if (editing) runMutation({ type: 'update', id: editing.id, payload: profilePayload(form) });
    else runMutation({ type: 'create', payload: compactPayload(form, createFields) });
  };

  const data = factoriesQuery.data || { items: [], total: 0, page: 1, pageSize: PAGE_SIZE };
  const factories = Array.isArray(data) ? data : data.items || [];
  const total = Array.isArray(data) ? data.length : data.total || 0;
  const pageSize = Array.isArray(data) ? PAGE_SIZE : data.pageSize || PAGE_SIZE;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const scope = scopeQuery.data || { parks: [], owners: [] };
  const parks = scope.parks || [];
  const owners = scope.owners || [];

  return (
    <Stack spacing={2.5}>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2 }}>
        <Box>
          <Typography variant="h4">مدیریت واحدهای صنعتی</Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5 }}>ثبت، ویرایش پروفایل و بررسی درخواست‌ها در محدوده مدیریتی شما</Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={startCreate} disabled={!online || mutationPending || scopeQuery.isLoading}>
          ثبت واحد جدید
        </Button>
      </Box>

      {!online && <Alert severity="warning">اتصال اینترنت برقرار نیست. اطلاعات فعلی فقط برای مشاهده است و همه عملیات ثبت و تصمیم‌گیری غیرفعال شده‌اند.</Alert>}
      {scopeQuery.isError && (
        <Alert severity="error" action={<Button color="inherit" onClick={() => scopeQuery.refetch()}>تلاش دوباره</Button>}>
          {factoryError(scopeQuery.error, 'دریافت شهرک‌ها و مالکان مجاز ناموفق بود.')}
        </Alert>
      )}

      <Paper variant="outlined">
        <Box
          component="form"
          role="search"
          onSubmit={submitSearch}
          sx={{ p: 2, display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(240px, 1fr) 190px 220px auto' }, gap: 1.5, alignItems: 'center' }}
        >
          <TextField size="small" label="جست‌وجوی نام، مجوز یا شناسه ملی" value={draftSearch} onChange={(event) => setDraftSearch(event.target.value)} inputProps={{ maxLength: 200 }} />
          <FormControl size="small">
            <InputLabel id="factory-status-filter-label">وضعیت</InputLabel>
            <Select labelId="factory-status-filter-label" label="وضعیت" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>
              <MenuItem value="">همه وضعیت‌ها</MenuItem>
              {Object.entries(statusMeta).map(([value, meta]) => <MenuItem key={value} value={value}>{meta.label}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl size="small">
            <InputLabel id="factory-park-filter-label">شهرک صنعتی</InputLabel>
            <Select labelId="factory-park-filter-label" label="شهرک صنعتی" value={parkId} onChange={(event) => { setParkId(event.target.value); setPage(1); }}>
              <MenuItem value="">همه شهرک‌ها</MenuItem>
              {parks.map((park) => <MenuItem key={park.id} value={park.id}>{park.name}</MenuItem>)}
            </Select>
          </FormControl>
          <Button type="submit" variant="contained">اعمال جست‌وجو</Button>
        </Box>
      </Paper>

      {factoriesQuery.isLoading && <Box sx={{ display: 'grid', placeItems: 'center', minHeight: 240 }}><CircularProgress aria-label="در حال دریافت واحدهای صنعتی" /></Box>}
      {factoriesQuery.isError && (
        <Alert severity="error" action={<Button color="inherit" startIcon={<RefreshIcon />} onClick={() => factoriesQuery.refetch()}>تلاش دوباره</Button>}>
          {factoryError(factoriesQuery.error, 'دریافت فهرست واحدهای صنعتی ناموفق بود.')}
        </Alert>
      )}
      {!factoriesQuery.isLoading && !factoriesQuery.isError && factories.length === 0 && (
        <Paper variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h6">واحد صنعتی‌ای پیدا نشد</Typography>
          <Typography color="text.secondary" sx={{ mt: 0.75 }}>فیلترها را تغییر دهید یا یک واحد صنعتی جدید ثبت کنید.</Typography>
        </Paper>
      )}
      {!factoriesQuery.isLoading && !factoriesQuery.isError && factories.length > 0 && (
        <TableContainer component={Paper} variant="outlined">
          <Table aria-label="فهرست واحدهای صنعتی">
            <TableHead>
              <TableRow>
                <TableCell>واحد صنعتی</TableCell>
                <TableCell>مالک / مدیر</TableCell>
                <TableCell>شهرک</TableCell>
                <TableCell>وضعیت</TableCell>
                <TableCell align="center">عملیات</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {factories.map((factory) => {
                const meta = statusMeta[factory.status] || { label: factory.status, color: 'default' };
                return (
                  <TableRow key={factory.id} hover>
                    <TableCell>
                      <Typography variant="subtitle1">{factory.name}</Typography>
                      <Typography variant="caption" color="text.secondary">مجوز: {factory.licenseNumber || '—'}</Typography>
                    </TableCell>
                    <TableCell>{factory.manager?.name || factory.owner?.name || '—'}</TableCell>
                    <TableCell>{factory.park?.name || '—'}</TableCell>
                    <TableCell><Chip size="small" label={meta.label} color={meta.color} /></TableCell>
                    <TableCell align="center">
                      <Stack direction="row" justifyContent="center" flexWrap="wrap" gap={0.5}>
                        <Button size="small" startIcon={<ViewIcon />} onClick={() => setDetailId(factory.id)}>جزئیات</Button>
                        <Button size="small" startIcon={editLoadingId === factory.id ? <CircularProgress size={16} /> : <EditIcon />} onClick={() => startEdit(factory)} disabled={!online || mutationPending || Boolean(editLoadingId)}>{editLoadingId === factory.id ? 'در حال دریافت' : 'ویرایش'}</Button>
                        {factory.status === 'PENDING' && (
                          <>
                            <Button size="small" color="success" startIcon={<ApproveIcon />} onClick={() => setApproveTarget(factory)} disabled={!online || mutationPending}>تایید</Button>
                            <Button size="small" color="error" onClick={() => setRejectTarget(factory)} disabled={!online || mutationPending}>رد</Button>
                          </>
                        )}
                      </Stack>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {!factoriesQuery.isError && total > pageSize && (
        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
          <Pagination page={page} count={pageCount} onChange={(_, value) => setPage(value)} color="primary" />
        </Box>
      )}

      <Dialog open={Boolean(detailId)} onClose={() => setDetailId(null)} maxWidth="md" fullWidth aria-labelledby="factory-detail-title">
        <DialogTitle id="factory-detail-title">جزئیات واحد صنعتی</DialogTitle>
        <DialogContent dividers>
          {detailQuery.isLoading && <Box sx={{ display: 'grid', placeItems: 'center', minHeight: 220 }}><CircularProgress aria-label="در حال دریافت جزئیات واحد صنعتی" /></Box>}
          {detailQuery.isError && (
            <Alert severity="error" action={<Button color="inherit" onClick={() => detailQuery.refetch()}>تلاش دوباره</Button>}>
              {factoryError(detailQuery.error, 'دریافت جزئیات واحد صنعتی ناموفق بود.')}
            </Alert>
          )}
          {detailQuery.data && (
            <Stack spacing={2.5}>
              <Box>
                <Stack direction="row" alignItems="center" flexWrap="wrap" gap={1}>
                  <Typography variant="h5">{detailQuery.data.name}</Typography>
                  <Chip size="small" label={(statusMeta[detailQuery.data.status] || { label: detailQuery.data.status }).label} color={(statusMeta[detailQuery.data.status] || { color: 'default' }).color} />
                </Stack>
                <Typography color="text.secondary" sx={{ mt: 0.5 }}>{detailQuery.data.description || 'توضیحی ثبت نشده است.'}</Typography>
              </Box>
              {detailQuery.data.rejectionReason && <Alert severity="error" icon={false}>دلیل رد: {detailQuery.data.rejectionReason}</Alert>}
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' }, gap: 2 }}>
                <DetailRow label="شماره مجوز">{detailQuery.data.licenseNumber}</DetailRow>
                <DetailRow label="شناسه ملی">{detailQuery.data.nationalId}</DetailRow>
                <DetailRow label="نوع فعالیت">{detailQuery.data.activityType}</DetailRow>
                <DetailRow label="تعداد کارکنان">{detailQuery.data.employees === 0 ? '۰' : detailQuery.data.employees}</DetailRow>
                <DetailRow label="شهرک صنعتی">{detailQuery.data.park?.name}</DetailRow>
                <DetailRow label="مالک / مدیر">{detailQuery.data.manager?.name || detailQuery.data.owner?.name}</DetailRow>
                <DetailRow label="تلفن همراه" ltr>{detailQuery.data.phoneNumber}</DetailRow>
                <DetailRow label="تلفن همراه دوم" ltr>{detailQuery.data.phoneNumber2}</DetailRow>
                <DetailRow label="تلفن ثابت" ltr>{detailQuery.data.landline}</DetailRow>
                <DetailRow label="نمابر" ltr>{detailQuery.data.fax}</DetailRow>
                <DetailRow label="ایمیل" ltr>{detailQuery.data.email}</DetailRow>
                <DetailRow label="وب‌سایت" ltr>{detailQuery.data.website}</DetailRow>
                <Box sx={{ gridColumn: '1 / -1' }}><DetailRow label="نشانی">{detailQuery.data.address}</DetailRow></Box>
              </Box>
            </Stack>
          )}
        </DialogContent>
        <DialogActions><Button onClick={() => setDetailId(null)}>بستن</Button></DialogActions>
      </Dialog>

      <Dialog open={formOpen} onClose={closeForm} maxWidth="md" fullWidth aria-labelledby="factory-form-title">
        <DialogTitle id="factory-form-title">{editing ? `ویرایش پروفایل «${editing.name}»` : 'ثبت واحد صنعتی جدید'}</DialogTitle>
        <Box component="form" onSubmit={submitForm} noValidate>
          <DialogContent dividers>
            {!online && <Alert severity="warning" sx={{ mb: 2 }}>برای ثبت اطلاعات باید دوباره به اینترنت متصل شوید. ورودی‌های شما حفظ می‌شوند.</Alert>}
            {!editing && scopeQuery.isLoading && <Alert severity="info" sx={{ mb: 2 }}>در حال دریافت شهرک‌ها و مالکان مجاز…</Alert>}
            {!editing && !scopeQuery.isLoading && (parks.length === 0 || owners.length === 0) && (
              <Alert severity="warning" sx={{ mb: 2 }}>شهرک یا مالک مجازی برای ثبت واحد جدید در محدوده شما وجود ندارد.</Alert>
            )}
            <FactoryFormFields form={form} setForm={setForm} editing={Boolean(editing)} parks={parks} owners={owners} disabled={mutationPending} />
          </DialogContent>
          <DialogActions>
            <Button onClick={closeForm} disabled={mutationPending}>انصراف</Button>
            <Button type="submit" variant="contained" disabled={!online || mutationPending || (!editing && scopeQuery.isLoading)}>
              {mutationPending ? <CircularProgress size={22} /> : editing ? 'ذخیره تغییرات' : 'ثبت واحد صنعتی'}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      <ConfirmDialog
        open={Boolean(approveTarget)}
        title="تایید واحد صنعتی"
        description={approveTarget ? `درخواست واحد صنعتی «${approveTarget.name}» تایید شود؟ این تصمیم فقط برای همین واحد ثبت خواهد شد.` : ''}
        confirmLabel="تایید واحد صنعتی"
        loading={mutationPending}
        disabled={!online}
        onConfirm={() => { if (approveTarget) runMutation({ type: 'approve', id: approveTarget.id }); }}
        onClose={() => { if (!mutationPending) setApproveTarget(null); }}
      />
      <ConfirmDialog
        open={Boolean(rejectTarget)}
        title="رد واحد صنعتی"
        description={rejectTarget ? `دلیل رد درخواست «${rejectTarget.name}» را ثبت کنید. دلیل برای مالک قابل پیگیری خواهد بود.` : ''}
        requireReason
        reasonLabel="دلیل رد"
        confirmLabel="ثبت رد واحد صنعتی"
        confirmColor="error"
        loading={mutationPending}
        disabled={!online}
        onConfirm={(reason) => { if (rejectTarget) runMutation({ type: 'reject', id: rejectTarget.id, reason }); }}
        onClose={() => { if (!mutationPending) setRejectTarget(null); }}
      />
    </Stack>
  );
};

export default ManageFactoriesPage;
