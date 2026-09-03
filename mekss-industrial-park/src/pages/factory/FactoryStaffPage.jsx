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
import { UserPlus, Users } from 'lucide-react';
import { factoryApi } from '../../services/api/factory.api';
import { useActiveFactory } from '../../providers/ActiveFactoryProvider';
import { useNotification } from '../../providers/NotificationProvider';
import { getErrorMessage } from '../../utils/apiError';
import { requestTypeLabels } from '../../constants/persianLabels';
import { EmptyState } from '../../components/common/EmptyState';
import { ResponsiveTable } from '../../components/common/ResponsiveTable';

const allRequestTypes = Object.keys(requestTypeLabels);

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

  const createMutation = useMutation({
    mutationFn: (payload) => factoryApi.createStaff(activeFactoryId, payload),
    onSuccess: () => {
      showNotification('کارمند با موفقیت اضافه شد', 'success');
      queryClient.invalidateQueries({ queryKey: ['factory-staff', activeFactoryId] });
      setForm({ name: '', phoneNumber: '', password: '', canApproveRequestTypes: [] });
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

  const togglePermission = (type) => {
    setForm((prev) => ({
      ...prev,
      canApproveRequestTypes: prev.canApproveRequestTypes.includes(type)
        ? prev.canApproveRequestTypes.filter((item) => item !== type)
        : [...prev.canApproveRequestTypes, type],
    }));
  };

  const canSubmit = useMemo(
    () => form.name.trim() && /^09\d{9}$/.test(form.phoneNumber) && form.password.length >= 10,
    [form],
  );

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
            <UserPlus className="h-5 w-5 text-[#0f4c81]" />
            <h2 className="font-semibold">دعوت / افزودن کارمند</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="flex flex-col gap-1">
              <Label className="text-xs">نام</Label>
              <Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} className="rounded-xl" />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs">موبایل</Label>
              <Input dir="ltr" value={form.phoneNumber} onChange={(e) => setForm((p) => ({ ...p, phoneNumber: e.target.value.replace(/\D/g, '').slice(0, 11) }))} className="rounded-xl" />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs">رمز عبور اولیه</Label>
              <Input type="password" value={form.password} onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))} className="rounded-xl" />
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-medium text-foreground-600">مجوز تایید انواع درخواست</p>
            <div className="flex flex-wrap gap-2">
              {allRequestTypes.map((type) => {
                const selected = form.canApproveRequestTypes.includes(type);
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => togglePermission(type)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ring-1 ${
                      selected
                        ? 'bg-[#0f4c81] text-white ring-[#0f4c81]'
                        : 'bg-default-50 text-foreground-600 ring-default-200 hover:ring-[#0f4c81]/40'
                    }`}
                  >
                    {requestTypeLabels[type]}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              variant="primary"
              className="font-bold"
              isDisabled={!canSubmit || createMutation.isPending || !activeFactoryId}
              onPress={() => createMutation.mutate(form)}
            >
              {createMutation.isPending ? <Spinner size="sm" /> : 'افزودن کارمند'}
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
                    <TableColumn isRowHeader>نام</TableColumn>
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
                          <Button
                            size="sm"
                            variant="tertiary"
                            isDisabled={updateMutation.isPending}
                            onPress={() => updateMutation.mutate({ userId: member.id, data: { isActive: !member.isActive } })}
                          >
                            {member.isActive ? 'غیرفعال‌سازی' : 'فعال‌سازی'}
                          </Button>
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
