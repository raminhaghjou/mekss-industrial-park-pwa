import React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  Button,
  Chip,
  Spinner,
  ModalBackdrop,
  ModalContainer,
  ModalDialog,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Input,
  TextArea,
  Select,
  SelectTrigger,
  SelectValue,
  SelectIndicator,
  SelectPopover,
  ListBox,
  ListBoxItem,
  Label,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Pagination,
  Alert,
  AlertContent,
  AlertTitle,
  AlertDescription,
} from '@heroui/react';
import {
  Plus,
  Check,
  Edit2,
  RotateCw,
  Eye,
  Search,
  X,
} from 'lucide-react';
import { factoryApi } from '../../services/api/factory.api';
import { useNotification } from '../../providers/NotificationProvider';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { getErrorMessage } from '../../utils/apiError';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';

const PAGE_SIZE = 12;
const statusMeta = {
  PENDING: { label: 'در انتظار تایید', color: 'warning' },
  ACTIVE: { label: 'فعال', color: 'success' },
  INACTIVE: { label: 'غیرفعال', color: 'default' },
  SUSPENDED: { label: 'معلق', color: 'danger' },
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

const formatDate = (value) => value
  ? new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
  : '—';

const DetailRow = ({ label, children, ltr = false }) => (
  <div className="flex flex-col gap-0.5">
    <span className="text-xs text-foreground-500 font-medium">{label}</span>
    <span className={`text-sm font-semibold ${ltr ? 'text-left' : 'text-right'} break-words text-foreground`}>
      {children || '—'}
    </span>
  </div>
);

const FormSelect = ({ label, value, onChange, options, isDisabled, placeholder }) => (
  <div className="flex flex-col gap-1">
    <Label className="text-xs font-medium text-foreground-600">{label}</Label>
    <Select
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      variant="primary"
      isDisabled={isDisabled}
      className="rounded-xl"
    >
      <SelectTrigger>
        <SelectValue />
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

const FactoryFormFields = ({ form, setForm, editing, parks, owners, disabled }) => {
  const setField = (field, val) => setForm((current) => ({ ...current, [field]: val }));
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-foreground-600">نام واحد صنعتی</label>
        <Input value={form.name} onChange={(e) => setField('name', e.target.value)} isDisabled={disabled} maxLength={160} variant="primary" className="rounded-xl" />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-foreground-600">شماره مجوز</label>
        <Input value={form.licenseNumber} onChange={(e) => setField('licenseNumber', e.target.value)} isDisabled={disabled} maxLength={80} variant="primary" className="rounded-xl" />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-foreground-600">شناسه ملی</label>
        <Input value={form.nationalId} onChange={(e) => setField('nationalId', e.target.value)} isDisabled={disabled} maxLength={11} variant="primary" dir="ltr" className="rounded-xl" />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-foreground-600">نوع فعالیت</label>
        <Input value={form.activityType} onChange={(e) => setField('activityType', e.target.value)} isDisabled={disabled} maxLength={120} variant="primary" className="rounded-xl" />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-foreground-600">تلفن همراه</label>
        <Input value={form.phoneNumber} onChange={(e) => setField('phoneNumber', e.target.value)} isDisabled={disabled} maxLength={11} variant="primary" dir="ltr" className="rounded-xl" />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-foreground-600">تلفن همراه دوم</label>
        <Input value={form.phoneNumber2} onChange={(e) => setField('phoneNumber2', e.target.value)} isDisabled={disabled} maxLength={11} variant="primary" dir="ltr" className="rounded-xl" />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-foreground-600">تلفن ثابت</label>
        <Input value={form.landline} onChange={(e) => setField('landline', e.target.value)} isDisabled={disabled} maxLength={20} variant="primary" dir="ltr" className="rounded-xl" />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-foreground-600">نمابر</label>
        <Input value={form.fax} onChange={(e) => setField('fax', e.target.value)} isDisabled={disabled} maxLength={20} variant="primary" dir="ltr" className="rounded-xl" />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-foreground-600">ایمیل</label>
        <Input type="email" value={form.email} onChange={(e) => setField('email', e.target.value)} isDisabled={disabled} maxLength={254} variant="primary" dir="ltr" className="rounded-xl" />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-foreground-600">وب‌سایت</label>
        <Input type="url" value={form.website} onChange={(e) => setField('website', e.target.value)} isDisabled={disabled} maxLength={300} variant="primary" dir="ltr" className="rounded-xl" />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-foreground-600">تعداد کارکنان</label>
        <Input type="number" value={form.employees} onChange={(e) => setField('employees', e.target.value)} isDisabled={disabled} variant="primary" className="rounded-xl" />
      </div>
      {!editing && (
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-foreground-600">شهرک صنعتی</label>
          <select
            value={form.parkId}
            onChange={(e) => setField('parkId', e.target.value)}
            isDisabled={disabled}
            required
            className="w-full rounded-xl border border-default-300 bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none"
          >
            <option value="">انتخاب شهرک...</option>
            {parks.map((park) => <option key={park.id} value={park.id}>{park.name}</option>)}
          </select>
        </div>
      )}
      {!editing && (
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-foreground-600">مالک / مدیر واحد</label>
          <select
            value={form.managerId}
            onChange={(e) => setField('managerId', e.target.value)}
            isDisabled={disabled}
            required
            className="w-full rounded-xl border border-default-300 bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none"
          >
            <option value="">انتخاب مالک / مدیر...</option>
            {owners.map((owner) => <option key={owner.id} value={owner.id}>{owner.name || owner.phoneNumber}</option>)}
          </select>
        </div>
      )}
      <div className="sm:col-span-2 flex flex-col gap-1">
        <label className="text-xs font-medium text-foreground-600">نشانی</label>
        <TextArea
          required
          rows={2}
          value={form.address}
          onChange={(e) => setField('address', e.target.value)}
          isDisabled={disabled}
          maxLength={240}
          variant="primary"
          className="rounded-xl"
        />
      </div>
      <div className="sm:col-span-2 flex flex-col gap-1">
        <label className="text-xs font-medium text-foreground-600">توضیحات</label>
        <TextArea
          rows={3}
          value={form.description}
          onChange={(e) => setField('description', e.target.value)}
          isDisabled={disabled}
          maxLength={2000}
          variant="primary"
          className="rounded-xl"
        />
      </div>
    </div>
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
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">مدیریت واحدهای صنعتی</h1>
          <p className="text-sm text-foreground-500 mt-1">ثبت، ویرایش پروفایل و بررسی درخواست‌ها در محدوده مدیریتی شما</p>
        </div>
        <Button
          variant="primary"
          onPress={startCreate}
          disabled={!online || mutationPending || scopeQuery.isLoading}
          className="rounded-xl font-bold shadow-md shadow-primary/20 flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          ثبت واحد جدید
        </Button>
      </div>

      {!online && (
        <Alert status="warning">
          <AlertContent>
            <AlertTitle>حالت آفلاین</AlertTitle>
            <AlertDescription>اتصال اینترنت برقرار نیست. اطلاعات فعلی فقط برای مشاهده است و همه عملیات ثبت و تصمیم‌گیری غیرفعال شده‌اند.</AlertDescription>
          </AlertContent>
        </Alert>
      )}

      {scopeQuery.isError && (
        <Alert status="danger">
          <AlertContent>
            <AlertTitle>خطا</AlertTitle>
            <AlertDescription>{factoryError(scopeQuery.error, 'دریافت شهرک‌ها و مالکان مجاز ناموفق بود.')}</AlertDescription>
          </AlertContent>
        </Alert>
      )}

      <Card className="border border-default-200 shadow-sm rounded-2xl dark:border-white/10">
        <CardContent className="p-4">
          <form onSubmit={submitSearch} role="search" className="grid grid-cols-1 md:grid-cols-4 gap-3 items-center">
            <div className="relative flex items-center">
              <Search className="absolute right-3 h-4 w-4 text-default-400 pointer-events-none" />
              <Input
                size="md"
                placeholder="نام، مجوز یا شناسه ملی..."
                value={draftSearch}
                onChange={(e) => setDraftSearch(e.target.value)}
                maxLength={200}
                variant="primary"
                className="pr-9 rounded-xl"
              />
            </div>

            <select
              value={status}
              onChange={(e) => { setStatus(e.target.value); setPage(1); }}
              className="w-full rounded-xl border border-default-300 bg-background px-3 py-2 text-sm text-foreground focus:outline-none"
            >
              <option value="">همه وضعیت‌ها</option>
              {Object.entries(statusMeta).map(([val, meta]) => (
                <option key={val} value={val}>{meta.label}</option>
              ))}
            </select>

            <select
              value={parkId}
              onChange={(e) => { setParkId(e.target.value); setPage(1); }}
              className="w-full rounded-xl border border-default-300 bg-background px-3 py-2 text-sm text-foreground focus:outline-none"
            >
              <option value="">همه شهرک‌ها</option>
              {parks.map((park) => <option key={park.id} value={park.id}>{park.name}</option>)}
            </select>

            <Button type="submit" variant="primary" className="rounded-xl font-bold">
              اعمال جست‌وجو
            </Button>
          </form>
        </CardContent>
      </Card>

      {factoriesQuery.isLoading && (
        <div className="flex min-h-[240px] flex-col items-center justify-center gap-3">
          <Spinner size="lg" />
          <p className="text-sm text-foreground-500">در حال دریافت واحدهای صنعتی...</p>
        </div>
      )}

      {factoriesQuery.isError && (
        <Alert status="danger">
          <AlertContent>
            <AlertTitle>خطا</AlertTitle>
            <AlertDescription>{factoryError(factoriesQuery.error, 'دریافت فهرست واحدهای صنعتی ناموفق بود.')}</AlertDescription>
          </AlertContent>
        </Alert>
      )}

      {!factoriesQuery.isLoading && !factoriesQuery.isError && factories.length === 0 && (
        <Card className="p-8 text-center border border-default-200 rounded-2xl">
          <h3 className="text-lg font-bold text-foreground">واحد صنعتی‌ای پیدا نشد</h3>
          <p className="mt-2 text-sm text-foreground-500">فیلترها را تغییر دهید یا یک واحد صنعتی جدید ثبت کنید.</p>
        </Card>
      )}

      {!factoriesQuery.isLoading && !factoriesQuery.isError && factories.length > 0 && (
        <Card className="border border-default-200 shadow-sm rounded-2xl dark:border-white/10 overflow-hidden">
          <Table aria-label="فهرست واحدهای صنعتی" className="p-0 shadow-none">
            <TableHeader>
              <TableColumn className="text-right font-bold">واحد صنعتی</TableColumn>
              <TableColumn className="text-right font-bold">مالک / مدیر</TableColumn>
              <TableColumn className="text-right font-bold">شهرک</TableColumn>
              <TableColumn className="text-right font-bold">وضعیت</TableColumn>
              <TableColumn className="text-center font-bold">عملیات</TableColumn>
            </TableHeader>
            <TableBody>
              {factories.map((factory) => {
                const meta = statusMeta[factory.status] || { label: factory.status, color: 'default' };
                return (
                  <TableRow key={factory.id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-bold text-foreground">{factory.name}</span>
                        <span className="text-xs text-foreground-500">مجوز: {factory.licenseNumber || '—'}</span>
                      </div>
                    </TableCell>
                    <TableCell>{factory.manager?.name || factory.owner?.name || '—'}</TableCell>
                    <TableCell>{factory.park?.name || '—'}</TableCell>
                    <TableCell>
                      <Chip size="sm" color={meta.color} variant="soft" className="font-semibold">
                        {meta.label}
                      </Chip>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-1.5 flex-wrap">
                        <Button size="sm" variant="ghost" onPress={() => setDetailId(factory.id)} className="rounded-xl font-medium flex items-center gap-1">
                          <Eye className="h-4 w-4" />
                          جزئیات
                        </Button>
                        <Button
                          size="sm"
                          variant="tertiary"
                          onPress={() => startEdit(factory)}
                          disabled={!online || mutationPending || Boolean(editLoadingId)}
                          className="rounded-xl font-medium flex items-center gap-1"
                        >
                          {editLoadingId === factory.id ? <Spinner size="sm" /> : <Edit2 className="h-4 w-4" />}
                          {editLoadingId === factory.id ? 'در حال دریافت' : 'ویرایش'}
                        </Button>
                        {factory.status === 'PENDING' && (
                          <>
                            <Button
                              size="sm"
                              variant="primary"
                              onPress={() => setApproveTarget(factory)}
                              disabled={!online || mutationPending}
                              className="rounded-xl font-bold flex items-center gap-1"
                            >
                              <Check className="h-4 w-4" />
                              تایید
                            </Button>
                            <Button
                              size="sm"
                              variant="danger-soft"
                              onPress={() => setRejectTarget(factory)}
                              disabled={!online || mutationPending}
                              className="rounded-xl font-bold flex items-center gap-1"
                            >
                              <X className="h-4 w-4" />
                              رد
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      {!factoriesQuery.isError && total > pageSize && (
        <div className="flex justify-center mt-4">
          <Pagination page={page} total={pageCount} onChange={setPage} className="rounded-2xl" />
        </div>
      )}

      {Boolean(detailId) && (
        <ModalBackdrop isOpen={Boolean(detailId)} onOpenChange={(open) => !open && setDetailId(null)} variant="blur">
          <ModalContainer size="lg">
            <ModalDialog className="rounded-2xl border border-default-200 dark:border-white/10 p-6 bg-background">
              <ModalHeader className="text-lg font-bold">جزئیات واحد صنعتی</ModalHeader>
              <ModalBody className="gap-4 max-h-[75vh] overflow-y-auto">
                {detailQuery.isLoading && (
                  <div className="flex min-h-[200px] flex-col items-center justify-center gap-3">
                    <Spinner size="lg" />
                  </div>
                )}
                {detailQuery.isError && (
                  <Alert status="danger">
                    <AlertContent>
                      <AlertTitle>خطا</AlertTitle>
                      <AlertDescription>{factoryError(detailQuery.error, 'دریافت جزئیات واحد صنعتی ناموفق بود.')}</AlertDescription>
                    </AlertContent>
                  </Alert>
                )}
                {detailQuery.data && (
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h2 className="text-xl font-bold text-foreground">{detailQuery.data.name}</h2>
                      <Chip size="sm" color={(statusMeta[detailQuery.data.status] || { color: 'default' }).color} variant="soft" className="font-semibold">
                        {(statusMeta[detailQuery.data.status] || { label: detailQuery.data.status }).label}
                      </Chip>
                    </div>
                    <p className="text-sm text-foreground-600 leading-relaxed">{detailQuery.data.description || 'توضیحی ثبت نشده است.'}</p>
                    {detailQuery.data.rejectionReason && (
                      <Alert status="danger">
                        <AlertContent>
                          <AlertTitle>دلیل رد</AlertTitle>
                          <AlertDescription>{detailQuery.data.rejectionReason}</AlertDescription>
                        </AlertContent>
                      </Alert>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-default-50 dark:bg-default-100/30">
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
                      <div className="sm:col-span-2"><DetailRow label="نشانی">{detailQuery.data.address}</DetailRow></div>
                      {detailQuery.data.reviewedBy && <DetailRow label="بررسی‌کننده">{detailQuery.data.reviewedBy.name}</DetailRow>}
                      {detailQuery.data.reviewedAt && <DetailRow label="زمان بررسی">{formatDate(detailQuery.data.reviewedAt)}</DetailRow>}
                    </div>
                  </div>
                )}
              </ModalBody>
              <ModalFooter>
                <Button variant="tertiary" onPress={() => setDetailId(null)} className="rounded-xl font-medium">
                  بستن
                </Button>
              </ModalFooter>
            </ModalDialog>
          </ModalContainer>
        </ModalBackdrop>
      )}

      {formOpen && (
        <ModalBackdrop isOpen={formOpen} onOpenChange={(open) => !open && closeForm()} variant="blur">
          <ModalContainer size="lg">
            <ModalDialog className="rounded-2xl border border-default-200 dark:border-white/10 p-6 bg-background">
              <ModalHeader className="text-lg font-bold">
                {editing ? `ویرایش پروفایل «${editing.name}»` : 'ثبت واحد صنعتی جدید'}
              </ModalHeader>
              <form onSubmit={submitForm}>
                <ModalBody className="gap-4 max-h-[75vh] overflow-y-auto">
                  {!online && (
                    <Alert status="warning">
                      <AlertContent>
                        <AlertTitle>آفلاین</AlertTitle>
                        <AlertDescription>برای ثبت اطلاعات باید دوباره به اینترنت متصل شوید. ورودی‌های شما حفظ می‌شوند.</AlertDescription>
                      </AlertContent>
                    </Alert>
                  )}
                  {!editing && scopeQuery.isLoading && (
                    <Alert status="accent">
                      <AlertContent>
                        <AlertTitle>در حال دریافت</AlertTitle>
                        <AlertDescription>در حال دریافت شهرک‌ها و مالکان مجاز…</AlertDescription>
                      </AlertContent>
                    </Alert>
                  )}
                  {!editing && !scopeQuery.isLoading && (parks.length === 0 || owners.length === 0) && (
                    <Alert status="warning">
                      <AlertContent>
                        <AlertTitle>هشدار</AlertTitle>
                        <AlertDescription>شهرک یا مالک مجازی برای ثبت واحد جدید در محدوده شما وجود ندارد.</AlertDescription>
                      </AlertContent>
                    </Alert>
                  )}
                  <FactoryFormFields form={form} setForm={setForm} editing={Boolean(editing)} parks={parks} owners={owners} disabled={mutationPending} />
                </ModalBody>
                <ModalFooter className="mt-4">
                  <Button variant="tertiary" onPress={closeForm} disabled={mutationPending} className="rounded-xl font-medium">
                    انصراف
                  </Button>
                  <Button type="submit" variant="primary" disabled={!online || (!editing && scopeQuery.isLoading) || mutationPending} className="rounded-xl font-bold px-6">
                    {mutationPending ? <Spinner size="sm" /> : (editing ? 'ذخیره تغییرات' : 'ثبت واحد صنعتی')}
                  </Button>
                </ModalFooter>
              </form>
            </ModalDialog>
          </ModalContainer>
        </ModalBackdrop>
      )}

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
        confirmColor="danger"
        loading={mutationPending}
        disabled={!online}
        onConfirm={(reason) => { if (rejectTarget) runMutation({ type: 'reject', id: rejectTarget.id, reason }); }}
        onClose={() => { if (!mutationPending) setRejectTarget(null); }}
      />
    </div>
  );
};

export default ManageFactoriesPage;

