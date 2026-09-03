import React from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
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
  Table, TableContent,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Alert,
  AlertContent,
  AlertTitle,
  AlertDescription,
  Select,
  SelectTrigger,
  SelectValue,
  SelectIndicator,
  SelectPopover,
  ListBox,
  ListBoxItem,
  Label,
} from '@heroui/react';
import {
  Plus,
  Edit2,
  Lock,
  Ban,
  CheckCircle,
  Trash2,
  Search,
} from 'lucide-react';
import { userApi } from '../../services/api/user.api';
import { useNotification } from '../../providers/NotificationProvider';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { getErrorMessage } from '../../utils/apiError';

const roleLabels = {
  SUPER_ADMIN: 'ادمین کل',
  PARK_MANAGER: 'مدیر شهرک',
  FACTORY_OWNER: 'مالک واحد صنعتی',
  SECURITY_GUARD: 'نگهبان',
  GOVERNMENT_OFFICIAL: 'نماینده دولت',
  EMPLOYEE: 'کارمند',
};
const roles = Object.keys(roleLabels);
const emptyForm = { phoneNumber: '', name: '', password: '', email: '', role: 'EMPLOYEE' };

const ManageUsersPage = () => {
  const { showNotification } = useNotification();
  const queryClient = useQueryClient();
  const [search, setSearch] = React.useState('');
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState(null);
  const [form, setForm] = React.useState(emptyForm);
  const [deleteTarget, setDeleteTarget] = React.useState(null);
  const [resetTarget, setResetTarget] = React.useState(null);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['users', 'managed', search],
    queryFn: () => userApi.getUsers({ search: search || undefined }).then((res) => res.data),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['users', 'managed'] });
  const closeForm = () => { setFormOpen(false); setEditing(null); setForm(emptyForm); };

  const createMutation = useMutation({
    mutationFn: (/** @type {typeof emptyForm} */ payload) => userApi.createUser(payload),
    onSuccess: () => { showNotification('کاربر با موفقیت ایجاد شد.', 'success'); closeForm(); invalidate(); },
    onError: (err) => showNotification(getErrorMessage(err, 'ایجاد کاربر ناموفق بود.'), 'error'),
  });

  const updateMutation = useMutation({
    mutationFn: (/** @type {{id: string, payload: any}} */ { id, payload }) => userApi.updateUser(id, payload),
    onSuccess: () => { showNotification('کاربر با موفقیت ویرایش شد.', 'success'); closeForm(); invalidate(); },
    onError: (err) => showNotification(getErrorMessage(err, 'ویرایش کاربر ناموفق بود.'), 'error'),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: (/** @type {{id: string, isActive: boolean}} */ { id, isActive }) => (isActive ? userApi.activateUser(id) : userApi.deactivateUser(id)),
    onSuccess: (_data, { isActive }) => { showNotification(isActive ? 'کاربر فعال شد.' : 'کاربر غیرفعال شد.', 'success'); invalidate(); },
    onError: (err) => showNotification(getErrorMessage(err, 'تغییر وضعیت کاربر ناموفق بود.'), 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: (/** @type {string} */ id) => userApi.deleteUser(id),
    onSuccess: () => { showNotification('کاربر حذف شد.', 'success'); setDeleteTarget(null); invalidate(); },
    onError: (err) => showNotification(getErrorMessage(err, 'حذف کاربر ناموفق بود.'), 'error'),
  });

  const resetPasswordMutation = useMutation({
    mutationFn: (/** @type {{id: string, newPassword: string}} */ { id, newPassword }) => userApi.resetPassword(id, newPassword),
    onSuccess: () => { showNotification('رمز عبور کاربر بازنشانی شد.', 'success'); setResetTarget(null); },
    onError: (err) => showNotification(getErrorMessage(err, 'بازنشانی رمز عبور ناموفق بود.'), 'error'),
  });

  const startCreate = () => { setEditing(null); setForm(emptyForm); setFormOpen(true); };
  const startEdit = (user) => { setEditing(user); setForm({ phoneNumber: user.phoneNumber, name: user.name, password: '', email: user.email || '', role: user.role }); setFormOpen(true); };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editing) {
      const payload = /** @type {any} */ ({ ...form });
      delete payload.phoneNumber;
      delete payload.password;
      updateMutation.mutate({ id: editing.id, payload });
    } else {
      if (!form.phoneNumber || !form.name || !form.password) { showNotification('لطفا فیلدهای الزامی را پر کنید.', 'error'); return; }
      createMutation.mutate(form);
    }
  };

  const users = data?.items || [];
  const saving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">مدیریت کاربران سامانه</h1>
          <p className="text-sm text-foreground-500 mt-1">مدیریت حساب‌ها، سطح دسترسی، فعال‌سازی و بازنشانی رمز عبور</p>
        </div>
        <Button
          variant="primary"
          onPress={startCreate}
          className="rounded-xl font-bold shadow-md shadow-primary/20 flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          افزودن کاربر جدید
        </Button>
      </div>

      <Card className="border border-default-200 shadow-sm rounded-2xl dark:border-white/10">
        <CardContent className="p-4">
          <div className="relative flex items-center">
            <Search className="absolute right-3 h-4 w-4 text-default-400 pointer-events-none" />
            <Input
              placeholder="جست‌وجوی کاربر بر اساس نام، تلفن یا ایمیل..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              variant="primary"
              className="pr-9 rounded-xl"
            />
          </div>
        </CardContent>
      </Card>

      {isLoading && (
        <div className="flex min-h-[220px] flex-col items-center justify-center gap-3">
          <Spinner size="lg" />
          <p className="text-sm text-foreground-500">در حال دریافت لیست کاربران...</p>
        </div>
      )}

      {isError && (
        <Alert status="danger">
          <AlertContent>
            <AlertTitle>خطا</AlertTitle>
            <AlertDescription>{getErrorMessage(error, 'دریافت لیست کاربران ناموفق بود.')}</AlertDescription>
          </AlertContent>
        </Alert>
      )}

      {!isLoading && !isError && (
        <Card className="border border-default-200 shadow-sm rounded-2xl dark:border-white/10 overflow-hidden">
          <Table>
              <TableContent aria-label="جدول مدیریت کاربران" className="p-0 shadow-none">
              <TableHeader>
              <TableColumn className="text-right font-bold" isRowHeader>نام کاربر</TableColumn>
              <TableColumn className="text-right font-bold">تلفن</TableColumn>
              <TableColumn className="text-right font-bold">نقش</TableColumn>
              <TableColumn className="text-right font-bold">وضعیت</TableColumn>
              <TableColumn className="text-center font-bold">عملیات</TableColumn>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id} id={user.id}>
                  <TableCell className="font-bold text-foreground">{user.name}</TableCell>
                  <TableCell className="font-mono text-sm" dir="ltr">{user.phoneNumber}</TableCell>
                  <TableCell>
                    <Chip size="sm" variant="secondary" className="font-medium">
                      {roleLabels[user.role] || user.role}
                    </Chip>
                  </TableCell>
                  <TableCell>
                    <Chip size="sm" color={user.isActive ? 'success' : 'default'} variant="soft" className="font-semibold">
                      {user.isActive ? 'فعال' : 'غیرفعال'}
                    </Chip>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center gap-1">
                      <Button isIconOnly size="sm" variant="ghost" onPress={() => startEdit(user)} aria-label="ویرایش">
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button isIconOnly size="sm" variant="ghost" onPress={() => setResetTarget(user.id)} aria-label="بازنشانی رمز عبور">
                        <Lock className="h-4 w-4" />
                      </Button>
                      {user.isActive ? (
                        <Button isIconOnly size="sm" variant="danger-soft" onPress={() => toggleActiveMutation.mutate({ id: user.id, isActive: false })} aria-label="غیرفعال کردن">
                          <Ban className="h-4 w-4" />
                        </Button>
                      ) : (
                        <Button isIconOnly size="sm" variant="ghost" onPress={() => toggleActiveMutation.mutate({ id: user.id, isActive: true })} aria-label="فعال کردن">
                          <CheckCircle className="h-4 w-4 text-success" />
                        </Button>
                      )}
                      <Button isIconOnly size="sm" variant="danger" onPress={() => setDeleteTarget(user.id)} aria-label="حذف">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
              </TableContent>
            </Table>
        </Card>
      )}

      {formOpen && (
        <ModalBackdrop isOpen={formOpen} onOpenChange={(open) => !open && closeForm()} variant="blur">
          <ModalContainer size="lg">
            <ModalDialog className="rounded-2xl border border-default-200 dark:border-white/10 p-6 bg-background">
              <ModalHeader className="text-lg font-bold">
                {editing ? 'ویرایش کاربر' : 'افزودن کاربر جدید'}
              </ModalHeader>
              <form onSubmit={handleSubmit}>
                <ModalBody className="gap-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-medium text-foreground-600">شماره تلفن</label>
                      <Input
                        required
                        disabled={Boolean(editing)}
                        placeholder="۰۹۱۲۳۴۵۶۷۸۹"
                        value={form.phoneNumber}
                        onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })}
                        variant="primary"
                        dir="ltr"
                        className="rounded-xl"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-medium text-foreground-600">نام و نام خانوادگی</label>
                      <Input
                        required
                        placeholder="نام کامل"
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        variant="primary"
                        className="rounded-xl"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <Label className="text-xs font-medium text-foreground-600">نقش کاربر</Label>
                      <Select
                        value={form.role}
                        onChange={(val) => setForm({ ...form, role: String(val || 'EMPLOYEE') })}
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
                            {roles.map((role) => (
                              <ListBoxItem key={role} id={role}>{roleLabels[role]}</ListBoxItem>
                            ))}
                          </ListBox>
                        </SelectPopover>
                      </Select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-medium text-foreground-600">ایمیل (اختیاری)</label>
                      <Input
                        type="email"
                        placeholder="email@example.com"
                        value={form.email}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                        variant="primary"
                        dir="ltr"
                        className="rounded-xl"
                      />
                    </div>
                  </div>

                  {!editing && (
                    <div className="flex flex-col gap-1 mt-2">
                      <label className="text-xs font-medium text-foreground-600">رمز عبور</label>
                      <Input
                        type="password"
                        required
                        placeholder="رمز عبور کاربر"
                        value={form.password}
                        onChange={(e) => setForm({ ...form, password: e.target.value })}
                        variant="primary"
                        dir="ltr"
                        className="rounded-xl"
                      />
                    </div>
                  )}
                </ModalBody>
                <ModalFooter className="mt-4">
                  <Button variant="tertiary" onPress={closeForm} isDisabled={saving} className="rounded-xl font-medium">
                    انصراف
                  </Button>
                  <Button type="submit" variant="primary" isDisabled={saving} className="rounded-xl font-bold px-6">
                    {saving ? <Spinner size="sm" /> : editing ? 'ذخیره تغییرات' : 'ایجاد کاربر'}
                  </Button>
                </ModalFooter>
              </form>
            </ModalDialog>
          </ModalContainer>
        </ModalBackdrop>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="حذف کاربر"
        description="این عملیات فقط زمانی موفق است که کاربر واحد صنعتی یا شهرک وابسته نداشته باشد. حذف آخرین ادمین کل فعال مجاز نیست."
        confirmLabel="حذف"
        confirmColor="danger"
        loading={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
      />

      <ConfirmDialog
        open={Boolean(resetTarget)}
        title="بازنشانی رمز عبور"
        description="رمز عبور جدید کاربر را وارد کنید. کاربر پس از ورود موظف به تغییر آن خواهد بود."
        requireReason
        reasonLabel="رمز عبور جدید"
        confirmLabel="بازنشانی"
        loading={resetPasswordMutation.isPending}
        onConfirm={(newPassword) => resetPasswordMutation.mutate({ id: resetTarget, newPassword })}
        onClose={() => setResetTarget(null)}
      />
    </div>
  );
};

export default ManageUsersPage;

