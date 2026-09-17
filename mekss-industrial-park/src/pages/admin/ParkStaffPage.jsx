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
import { Edit2, Trash2, UserPlus, Users } from 'lucide-react';
import { parkStaffApi } from '../../services/api/parkStaff.api';
import { factoryApi } from '../../services/api/factory.api';
import { useNotification } from '../../providers/NotificationProvider';
import { getErrorMessage } from '../../utils/apiError';
import { EmptyState } from '../../components/common/EmptyState';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { ResponsiveTable } from '../../components/common/ResponsiveTable';
import { queryKeys } from '../../services/queryKeys';

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
    onSuccess: () => {
      showNotification('کارمند شهرک با موفقیت ثبت شد', 'success');
      setForm(emptyForm);
      invalidate();
    },
    onError: (err) => showNotification(getErrorMessage(err, 'ثبت کارمند ناموفق بود'), 'error'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => parkStaffApi.update(id, payload),
    onSuccess: () => {
      showNotification('اطلاعات کارمند به‌روز شد', 'success');
      setEditing(null);
      setForm(emptyForm);
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

  const canSubmit = useMemo(() => {
    const phoneOk = /^09\d{9}$/.test(form.phoneNumber);
    const nameOk = form.name.trim().length >= 2;
    if (editing) {
      return nameOk && phoneOk;
    }
    return nameOk && phoneOk && form.password.length >= 10;
  }, [form, editing]);

  const startEdit = (member) => {
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
  };

  const handleSubmit = () => {
    if (!canSubmit) {
      showNotification('نام، موبایل و رمز عبور معتبر الزامی است', 'error');
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
      parkId: form.parkId || undefined,
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
              <Label className="text-xs">نام و نام خانوادگی</Label>
              <Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} className="rounded-xl" />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs">موبایل (نام کاربری ورود)</Label>
              <Input
                dir="ltr"
                value={form.phoneNumber}
                onChange={(e) => setForm((p) => ({ ...p, phoneNumber: e.target.value.replace(/\D/g, '').slice(0, 11) }))}
                className="rounded-xl"
                placeholder="09xxxxxxxxx"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs">{editing ? 'رمز عبور جدید (اختیاری)' : 'رمز عبور اولیه'}</Label>
              <Input
                type="password"
                value={form.password}
                onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                className="rounded-xl"
                placeholder="حداقل ۱۰ کاراکتر حرف و عدد"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs">نام کاربری سیستمی (اختیاری)</Label>
              <Input
                dir="ltr"
                value={form.username}
                onChange={(e) => setForm((p) => ({ ...p, username: e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, '') }))}
                className="rounded-xl"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs">کد ملی (اختیاری)</Label>
              <Input
                dir="ltr"
                value={form.nationalId}
                onChange={(e) => setForm((p) => ({ ...p, nationalId: e.target.value.replace(/\D/g, '').slice(0, 10) }))}
                className="rounded-xl"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs">ایمیل (اختیاری)</Label>
              <Input
                dir="ltr"
                value={form.email}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                className="rounded-xl"
              />
            </div>
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

          <div className="flex justify-end">
            <Button
              variant="primary"
              className="font-bold"
              isDisabled={!canSubmit || saving}
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
                    <TableColumn isRowHeader>نام</TableColumn>
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
