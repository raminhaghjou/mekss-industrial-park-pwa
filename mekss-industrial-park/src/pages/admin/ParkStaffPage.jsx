import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  Input,
  Button,
  Label,
  Chip,
  Skeleton,
  Alert,
  AlertContent,
  AlertTitle,
  AlertDescription,
  Spinner,
  Table,
  TableContent,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Select,
  SelectTrigger,
  SelectValue,
  SelectIndicator,
  SelectPopover,
  ListBox,
  ListBoxItem,
} from '@heroui/react';
import { Edit2, KeyRound, MessageSquareText, Trash2, UserPlus, Users } from 'lucide-react';
import { parkStaffApi } from '../../services/api/parkStaff.api';
import { factoryApi } from '../../services/api/factory.api';
import { useNotification } from '../../providers/NotificationProvider';
import { getErrorMessage } from '../../utils/apiError';
import { EmptyState } from '../../components/common/EmptyState';
import { PasswordInput } from '../../components/common/PasswordInput';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { ResponsiveTable } from '../../components/common/ResponsiveTable';
import { queryKeys } from '../../services/queryKeys';
import { digitsOnly } from '../../utils/digits';
import {
  STAFF_PASSWORD_HINT,
  generateStaffPassword,
  normalizeStaffPhone,
  validateStaffForm,
} from '../../utils/staffForm';

const emptyForm = {
  name: '',
  phoneNumber: '',
  username: '',
  nationalId: '',
  email: '',
  password: '',
  parkId: '',
  isActive: true,
};

export const ParkStaffPage = () => {
  const { showNotification } = useNotification();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [showErrors, setShowErrors] = useState(false);

  const { data: scope } = useQuery({
    queryKey: queryKeys.factories.managementScope(),
    queryFn: () => factoryApi.getManagementScope().then((res) => res.data),
  });
  const parks = scope?.parks || [];

  const { data: staff = [], isLoading, isError, error } = useQuery({
    queryKey: ['park-staff'],
    queryFn: () => parkStaffApi.list().then((res) => res.data || []),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['park-staff'] });

  const createMutation = useMutation({
    mutationFn: (payload) => parkStaffApi.create(payload),
    onSuccess: (_, payload) => {
      showNotification(`کارمند شهرک ثبت شد و نام کاربری به ${payload.phoneNumber} پیامک شد؛ رمز عبور را خودتان به او اعلام کنید.`, 'success');
      setForm(emptyForm);
      setShowErrors(false);
      invalidate();
    },
    onError: (err) => showNotification(getErrorMessage(err, 'ثبت کارمند ناموفق بود'), 'error'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => parkStaffApi.update(id, payload),
    onSuccess: (_, { payload }) => {
      showNotification(
        payload.password ? 'اطلاعات کارمند به‌روز شد و بازنشانی رمز به او پیامک شد؛ رمز جدید را خودتان به او اعلام کنید.' : 'اطلاعات کارمند به‌روز شد',
        'success',
      );
      setEditing(null);
      setForm(emptyForm);
      setShowErrors(false);
      invalidate();
    },
    onError: (err) => showNotification(getErrorMessage(err, 'ویرایش کارمند ناموفق بود'), 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => parkStaffApi.remove(id),
    onSuccess: (res) => {
      const deactivated = res?.data?.deactivated;
      showNotification(
        deactivated ? 'کارمند به‌خاطر وابستگی‌های سیستمی فقط غیرفعال شد' : 'کارمند حذف شد',
        'success',
      );
      setDeleteTarget(null);
      invalidate();
    },
    onError: (err) => showNotification(getErrorMessage(err, 'حذف کارمند ناموفق بود'), 'error'),
  });

  const effectiveParkId = form.parkId || (parks.length === 1 ? parks[0].id : '');

  const errors = useMemo(() => {
    const next = validateStaffForm(form, { requirePassword: !editing });
    if (!editing && parks.length > 1 && !form.parkId) next.parkId = 'شهرک محل خدمت کارمند را انتخاب کنید.';
    return next;
  }, [form, editing, parks.length]);
  const visibleErrors = showErrors ? errors : {};
  const fieldError = (field) => (visibleErrors[field] ? <p className="text-[11px] text-danger-600">{visibleErrors[field]}</p> : null);

  const startEdit = (member) => {
    setShowErrors(false);
    setEditing(member);
    setForm({
      name: member.name || '',
      phoneNumber: member.phoneNumber || '',
      username: member.username || '',
      nationalId: member.nationalId || '',
      email: member.email || '',
      password: '',
      parkId: member.employeeOfParkId || '',
      isActive: Boolean(member.isActive),
    });
  };

  const resetForm = () => {
    setEditing(null);
    setForm(emptyForm);
    setShowErrors(false);
  };

  const handleSubmit = () => {
    if (Object.keys(errors).length) {
      setShowErrors(true);
      showNotification(Object.values(errors)[0], 'error');
      return;
    }
    if (editing) {
      const payload = {
        name: form.name.trim(),
        phoneNumber: form.phoneNumber,
        username: form.username.trim() || null,
        nationalId: form.nationalId.trim() || null,
        email: form.email.trim() || null,
        isActive: form.isActive,
      };
      if (form.password.trim()) payload.password = form.password;
      updateMutation.mutate({ id: editing.id, payload });
      return;
    }
    createMutation.mutate({
      name: form.name.trim(),
      phoneNumber: form.phoneNumber,
      password: form.password,
      username: form.username.trim() || undefined,
      nationalId: form.nationalId.trim() || undefined,
      email: form.email.trim() || undefined,
      parkId: effectiveParkId || undefined,
    });
  };

  const saving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div className="page-toolbar">
        <div>
          <h1 className="text-xl font-bold sm:text-2xl">پرسنل مدیریت شهرک</h1>
          <p className="mt-1 text-sm text-foreground-500">
            ثبت کارمند، ساخت حساب کاربری (موبایل و رمز) و ویرایش یا حذف پرسنل دفتر شهرک
          </p>
        </div>
      </div>

      <Card className="rounded-2xl border border-default-200">
        <CardContent className="gap-4 p-5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-[var(--color-brand)]" />
              <h2 className="font-semibold">{editing ? 'ویرایش کارمند' : 'ثبت کارمند جدید'}</h2>
            </div>
            {editing && (
              <Button size="sm" variant="tertiary" onPress={resetForm}>انصراف از ویرایش</Button>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor="park-staff-name" className="text-xs">نام و نام خانوادگی</Label>
              <Input
                id="park-staff-name"
                value={form.name}
                placeholder="مثلاً علی رضایی"
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                className="rounded-xl"
              />
              {fieldError('name')}
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="park-staff-phone" className="text-xs">موبایل (نام کاربری ورود)</Label>
              <Input
                id="park-staff-phone"
                dir="ltr"
                inputMode="numeric"
                value={form.phoneNumber}
                onChange={(e) => setForm((p) => ({ ...p, phoneNumber: normalizeStaffPhone(e.target.value) }))}
                className="rounded-xl"
                placeholder="09xxxxxxxxx"
              />
              {fieldError('phoneNumber')}
            </div>
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="park-staff-password" className="text-xs">{editing ? 'رمز عبور جدید (اختیاری)' : 'رمز عبور اولیه'}</Label>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--color-brand)] hover:underline"
                  onClick={() => setForm((p) => ({ ...p, password: generateStaffPassword() }))}
                >
                  <KeyRound className="h-3 w-3" />
                  تولید رمز
                </button>
              </div>
              <PasswordInput
                id="park-staff-password"
                value={form.password}
                onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                className="rounded-xl"
              />
              <p className={`text-[11px] ${visibleErrors.password ? 'text-danger-600' : 'text-foreground-500'}`}>
                {visibleErrors.password || STAFF_PASSWORD_HINT}
              </p>
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="park-staff-username" className="text-xs">نام کاربری سیستمی (اختیاری)</Label>
              <Input
                id="park-staff-username"
                dir="ltr"
                value={form.username}
                onChange={(e) => setForm((p) => ({ ...p, username: e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, '') }))}
                className="rounded-xl"
              />
              {fieldError('username')}
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="park-staff-national-id" className="text-xs">کد ملی (اختیاری)</Label>
              <Input
                id="park-staff-national-id"
                dir="ltr"
                inputMode="numeric"
                value={form.nationalId}
                onChange={(e) => setForm((p) => ({ ...p, nationalId: digitsOnly(e.target.value, 10) }))}
                className="rounded-xl"
              />
              {fieldError('nationalId')}
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="park-staff-email" className="text-xs">ایمیل (اختیاری)</Label>
              <Input
                id="park-staff-email"
                dir="ltr"
                value={form.email}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                className="rounded-xl"
              />
              {fieldError('email')}
            </div>
            {!editing && parks.length === 1 && (
              <div className="flex flex-col gap-1">
                <Label className="text-xs">شهرک صنعتی</Label>
                <div className="flex h-10 items-center rounded-xl border border-default-200 bg-default-50 px-3 text-sm font-medium dark:border-white/10 dark:bg-white/5">
                  {parks[0].name}
                </div>
              </div>
            )}
            {!editing && parks.length > 1 && (
              <div className="flex flex-col gap-1">
                <Label className="text-xs">شهرک صنعتی</Label>
                <Select
                  value={form.parkId}
                  onChange={(value) => setForm((p) => ({ ...p, parkId: String(value || '') }))}
                  placeholder="انتخاب شهرک..."
                  className="rounded-xl"
                >
                  <SelectTrigger>
                    <SelectValue />
                    <SelectIndicator />
                  </SelectTrigger>
                  <SelectPopover>
                    <ListBox>
                      {parks.map((park) => (
                        <ListBoxItem key={park.id} id={park.id}>{park.name}</ListBoxItem>
                      ))}
                    </ListBox>
                  </SelectPopover>
                </Select>
                {fieldError('parkId')}
              </div>
            )}
            {editing && (
              <label className="flex items-center gap-2 self-end pb-2 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))}
                  className="h-4 w-4 rounded border-default-300"
                />
                حساب فعال باشد
              </label>
            )}
          </div>

          {!editing && (
            <p className="flex items-center gap-1.5 rounded-xl bg-default-50 px-3 py-2 text-[11px] text-foreground-500 dark:bg-white/5">
              <MessageSquareText className="h-3.5 w-3.5 shrink-0" />
              پس از ثبت، نام کاربری برای کارمند پیامک می‌شود (رمز عبور پیامک نمی‌شود؛ آن را خودتان اعلام کنید یا کارمند از «فراموشی رمز عبور» رمز موقت بگیرد) و در اولین ورود باید رمز خود را تغییر دهد.
            </p>
          )}

          <div className="flex justify-end">
            <Button
              variant="primary"
              className="font-bold"
              isDisabled={saving}
              onPress={handleSubmit}
            >
              {saving ? <Spinner size="sm" /> : (editing ? 'ذخیره تغییرات' : 'ثبت کارمند')}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border border-default-200">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-4">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}</div>
          ) : isError ? (
            <Alert status="danger">
              <AlertContent>
                <AlertTitle>خطا</AlertTitle>
                <AlertDescription>{getErrorMessage(error, 'دریافت پرسنل ناموفق بود')}</AlertDescription>
              </AlertContent>
            </Alert>
          ) : staff.length === 0 ? (
            <EmptyState
              icon={<Users className="h-6 w-6" />}
              title="پرسنلی ثبت نشده"
              description="اولین کارمند دفتر شهرک را از فرم بالا اضافه کنید."
            />
          ) : (
            <ResponsiveTable>
              <Table>
                <TableContent aria-label="پرسنل شهرک">
                  <TableHeader>
                    <TableColumn isRowHeader>نام و نام خانوادگی</TableColumn>
                    <TableColumn>موبایل</TableColumn>
                    <TableColumn>نام کاربری</TableColumn>
                    <TableColumn>شهرک</TableColumn>
                    <TableColumn>وضعیت</TableColumn>
                    <TableColumn>عملیات</TableColumn>
                  </TableHeader>
                  <TableBody>
                    {staff.map((member) => (
                      <TableRow key={member.id} id={member.id}>
                        <TableCell>{member.name}</TableCell>
                        <TableCell dir="ltr">{member.phoneNumber}</TableCell>
                        <TableCell dir="ltr">{member.username || '—'}</TableCell>
                        <TableCell>{member.employeeOfPark?.name || '—'}</TableCell>
                        <TableCell>
                          <Chip size="sm" color={member.isActive ? 'success' : 'default'} variant="soft">
                            {member.isActive ? 'فعال' : 'غیرفعال'}
                          </Chip>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button isIconOnly size="sm" variant="ghost" aria-label="ویرایش" onPress={() => startEdit(member)}>
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button isIconOnly size="sm" variant="danger-soft" aria-label="حذف" onPress={() => setDeleteTarget(member)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </TableContent>
              </Table>
            </ResponsiveTable>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="حذف کارمند"
        description={`کارمند «${deleteTarget?.name || ''}» حذف می‌شود. در صورت وجود وابستگی سیستمی، حساب فقط غیرفعال خواهد شد.`}
        confirmLabel="حذف"
        confirmColor="danger"
        loading={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate(deleteTarget.id)}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
};

export default ParkStaffPage;
