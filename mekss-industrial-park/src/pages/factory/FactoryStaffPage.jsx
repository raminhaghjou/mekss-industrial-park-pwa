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
} from '@heroui/react';
import { KeyRound, MessageSquareText, UserPlus, Users } from 'lucide-react';
import { factoryApi } from '../../services/api/factory.api';
import { useActiveFactory } from '../../providers/ActiveFactoryProvider';
import { useNotification } from '../../providers/NotificationProvider';
import { getErrorMessage } from '../../utils/apiError';
import { requestTypeLabels } from '../../constants/persianLabels';
import { EmptyState } from '../../components/common/EmptyState';
import { PasswordInput } from '../../components/common/PasswordInput';
import { ResponsiveTable } from '../../components/common/ResponsiveTable';
import { StaffAccessLevelPicker } from '../../components/staff/StaffAccessLevelPicker';
import {
  STAFF_PASSWORD_HINT,
  generateStaffPassword,
  normalizeStaffPhone,
  validateStaffForm,
} from '../../utils/staffForm';

export const FactoryStaffPage = () => {
  const { activeFactoryId, activeFactory, factories, isLoading: loadingFactories } = useActiveFactory();
  const { showNotification } = useNotification();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    name: '',
    phoneNumber: '',
    password: '',
    canApproveRequestTypes: [],
  });

  const { data: staff = [], isLoading, isError, error } = useQuery({
    queryKey: ['factory-staff', activeFactoryId],
    queryFn: () => factoryApi.getStaff(activeFactoryId).then((res) => res.data),
    enabled: Boolean(activeFactoryId),
  });

  const [showErrors, setShowErrors] = useState(false);

  const createMutation = useMutation({
    mutationFn: (payload) => factoryApi.createStaff(activeFactoryId, payload),
    onSuccess: (_, payload) => {
      showNotification(`کارمند ثبت شد و نام کاربری به ${payload.phoneNumber} پیامک شد؛ رمز عبور را خودتان به او اعلام کنید.`, 'success');
      queryClient.invalidateQueries({ queryKey: ['factory-staff', activeFactoryId] });
      setForm({ name: '', phoneNumber: '', password: '', canApproveRequestTypes: [] });
      setShowErrors(false);
    },
    onError: (err) => showNotification(getErrorMessage(err, 'افزودن کارمند ناموفق بود'), 'error'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ userId, data }) => factoryApi.updateStaff(activeFactoryId, userId, data),
    onSuccess: () => {
      showNotification('وضعیت کارمند به‌روز شد', 'success');
      queryClient.invalidateQueries({ queryKey: ['factory-staff', activeFactoryId] });
    },
    onError: (err) => showNotification(getErrorMessage(err, 'به‌روزرسانی کارمند ناموفق بود'), 'error'),
  });

  const [permissionEditId, setPermissionEditId] = useState(null);
  const [permissionDraft, setPermissionDraft] = useState([]);

  const errors = useMemo(() => validateStaffForm(form), [form]);
  const visibleErrors = showErrors ? errors : {};

  const submit = () => {
    if (Object.keys(errors).length) {
      setShowErrors(true);
      showNotification(Object.values(errors)[0], 'error');
      return;
    }
    createMutation.mutate({ ...form, name: form.name.trim() });
  };

  if (!loadingFactories && factories.length === 0) {
    return (
      <EmptyState
        icon={<Users className="h-6 w-6" />}
        title="واحد صنعتی فعالی ندارید"
        description="ابتدا یک واحد صنعتی ثبت کنید تا بتوانید پرسنل اضافه کنید."
      />
    );
  }

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div className="page-toolbar">
        <div>
          <h1 className="text-xl font-bold sm:text-2xl">مدیریت پرسنل</h1>
          <p className="mt-1 text-sm text-foreground-500">
            {activeFactory ? `واحد فعال: ${activeFactory.name}` : 'در حال بارگذاری واحد...'}
          </p>
        </div>
      </div>

      <Card className="rounded-2xl border border-default-200">
        <CardContent className="gap-4 p-5">
          <div className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-[var(--color-brand)]" />
            <h2 className="font-semibold">دعوت / افزودن کارمند</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor="factory-staff-name" className="text-xs">نام و نام خانوادگی</Label>
              <Input
                id="factory-staff-name"
                value={form.name}
                placeholder="مثلاً علی رضایی"
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                className="rounded-xl"
              />
              {visibleErrors.name ? <p className="text-[11px] text-danger-600">{visibleErrors.name}</p> : null}
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="factory-staff-phone" className="text-xs">موبایل (نام کاربری)</Label>
              <Input
                id="factory-staff-phone"
                dir="ltr"
                inputMode="numeric"
                placeholder="09123456789"
                value={form.phoneNumber}
                onChange={(e) => setForm((p) => ({ ...p, phoneNumber: normalizeStaffPhone(e.target.value) }))}
                className="rounded-xl"
              />
              {visibleErrors.phoneNumber ? <p className="text-[11px] text-danger-600">{visibleErrors.phoneNumber}</p> : null}
            </div>
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="factory-staff-password" className="text-xs">رمز عبور اولیه</Label>
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
                id="factory-staff-password"
                value={form.password}
                onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                className="rounded-xl"
              />
              <p className={`text-[11px] ${visibleErrors.password ? 'text-danger-600' : 'text-foreground-500'}`}>
                {visibleErrors.password || STAFF_PASSWORD_HINT}
              </p>
            </div>
          </div>
          <p className="flex items-center gap-1.5 rounded-xl bg-default-50 px-3 py-2 text-[11px] text-foreground-500 dark:bg-white/5">
            <MessageSquareText className="h-3.5 w-3.5 shrink-0" />
            پس از ثبت، نام کاربری برای کارمند پیامک می‌شود (رمز عبور پیامک نمی‌شود؛ آن را خودتان اعلام کنید یا کارمند از «فراموشی رمز عبور» رمز موقت بگیرد) و در اولین ورود باید رمز خود را تغییر دهد.
          </p>

          <StaffAccessLevelPicker
            value={form.canApproveRequestTypes}
            onChange={(types) => setForm((prev) => ({ ...prev, canApproveRequestTypes: types }))}
          />

          <div className="flex justify-end">
            <Button
              variant="primary"
              className="font-bold"
              isDisabled={createMutation.isPending || !activeFactoryId}
              onPress={submit}
            >
              {createMutation.isPending ? <Spinner size="sm" /> : 'ثبت کارمند'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border border-default-200">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-4">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}</div>
          ) : isError ? (
            <Alert status="danger"><AlertContent><AlertTitle>خطا</AlertTitle><AlertDescription>{getErrorMessage(error, 'دریافت پرسنل ناموفق بود')}</AlertDescription></AlertContent></Alert>
          ) : staff.length === 0 ? (
            <EmptyState icon={<Users className="h-6 w-6" />} title="پرسنلی ثبت نشده" description="اولین کارمند واحد را از فرم بالا اضافه کنید." />
          ) : (
            <ResponsiveTable>
              <Table>
                <TableContent aria-label="پرسنل واحد">
                  <TableHeader>
                    <TableColumn isRowHeader>نام و نام خانوادگی</TableColumn>
                    <TableColumn>موبایل</TableColumn>
                    <TableColumn>مجوزها</TableColumn>
                    <TableColumn>وضعیت</TableColumn>
                    <TableColumn>عملیات</TableColumn>
                  </TableHeader>
                  <TableBody>
                    {staff.map((member) => (
                      <TableRow key={member.id} id={member.id}>
                        <TableCell>{member.name}</TableCell>
                        <TableCell dir="ltr">{member.phoneNumber}</TableCell>
                        <TableCell>
                          <div className="flex max-w-xs flex-wrap gap-1">
                            {(member.canApproveRequestTypes || []).slice(0, 3).map((type) => (
                              <Chip key={type} size="sm" variant="soft">{requestTypeLabels[type] || type}</Chip>
                            ))}
                            {(member.canApproveRequestTypes || []).length > 3 && (
                              <Chip size="sm" variant="soft">+{member.canApproveRequestTypes.length - 3}</Chip>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Chip size="sm" color={member.isActive ? 'success' : 'default'} variant="soft">
                            {member.isActive ? 'فعال' : 'غیرفعال'}
                          </Chip>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              variant="tertiary"
                              onPress={() => {
                                if (permissionEditId === member.id) {
                                  setPermissionEditId(null);
                                  return;
                                }
                                setPermissionEditId(member.id);
                                setPermissionDraft(member.canApproveRequestTypes || []);
                              }}
                            >
                              سطح دسترسی
                            </Button>
                            <Button
                              size="sm"
                              variant="tertiary"
                              isDisabled={updateMutation.isPending}
                              onPress={() => updateMutation.mutate({ userId: member.id, data: { isActive: !member.isActive } })}
                            >
                              {member.isActive ? 'غیرفعال‌سازی' : 'فعال‌سازی'}
                            </Button>
                          </div>
                          {permissionEditId === member.id && (
                            <div className="mt-3 rounded-xl border border-default-200 p-3">
                              <StaffAccessLevelPicker
                                value={permissionDraft}
                                onChange={setPermissionDraft}
                              />
                              <Button
                                size="sm"
                                variant="primary"
                                className="mt-2 font-bold"
                                isDisabled={updateMutation.isPending}
                                onPress={() => {
                                  updateMutation.mutate(
                                    { userId: member.id, data: { canApproveRequestTypes: permissionDraft } },
                                    { onSuccess: () => setPermissionEditId(null) },
                                  );
                                }}
                              >
                                ذخیره سطح دسترسی
                              </Button>
                            </div>
                          )}
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
    </div>
  );
};

export default FactoryStaffPage;
