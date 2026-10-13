import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, Table, TableContent, TableHeader, TableColumn, TableBody, TableRow, TableCell, Button, Chip, Input, ModalBackdrop, ModalContainer, ModalDialog, ModalHeader, ModalBody, ModalFooter, Skeleton, Alert, AlertContent, AlertTitle, AlertDescription, Spinner } from '@heroui/react';
import { Plus, Pencil, Trash2, MapPin } from 'lucide-react';
import { parkApi } from '../../services/api/park.api';
import { useNotification } from '../../providers/NotificationProvider';
import { getErrorMessage } from '../../utils/apiError';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { EmptyState } from '../../components/common/EmptyState';
import IranProvinceCityFields from '../../components/common/IranProvinceCityFields';
import { toPersistedLocation } from '../../utils/iranLocations';
import { ResponsiveTable } from '../../components/common/ResponsiveTable';
import { digitsOnly } from '../../utils/digits';
import { validateParkForm } from '../../utils/parkForm';

const EMPTY_FORM = { name: '', province: '', city: '', address: '', phoneNumber: '', guardPhone: '' };

const FieldError = ({ message }) => (message ? <span className="text-[11px] font-medium text-danger">{message}</span> : null);

export const ManageParksPage = () => {
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [showErrors, setShowErrors] = useState(false);
  const { showNotification } = useNotification();
  const queryClient = useQueryClient();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['parks'],
    queryFn: () => parkApi.getParks().then((res) => res.data),
  });

  const createMutation = useMutation({
    mutationFn: (/** @type {typeof formData} */ payload) => parkApi.createPark(payload),
    onSuccess: () => {
      showNotification('شهرک صنعتی با موفقیت ایجاد شد', 'success');
      setFormOpen(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['parks'] });
    },
    onError: (err) => showNotification(getErrorMessage(err, 'ایجاد شهرک ناموفق بود'), 'error'),
  });

  const updateMutation = useMutation({
    mutationFn: (/** @type {{id: string, data: typeof formData}} */ { id, data }) => parkApi.updatePark(id, data),
    onSuccess: () => {
      showNotification('شهرک صنعتی با موفقیت ویرایش شد', 'success');
      setFormOpen(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['parks'] });
    },
    onError: (err) => showNotification(getErrorMessage(err, 'ویرایش شهرک ناموفق بود'), 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => parkApi.deletePark(id),
    onSuccess: () => {
      showNotification('شهرک صنعتی حذف شد', 'success');
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: ['parks'] });
    },
    onError: (err) => showNotification(getErrorMessage(err, 'حذف شهرک ناموفق بود'), 'error'),
  });

  const parks = Array.isArray(data) ? data : data?.items || [];

  const resetForm = () => {
    setFormData(EMPTY_FORM);
    setEditTarget(null);
    setShowErrors(false);
  };

  const startEdit = (park) => {
    setFormData({
      name: park.name || '',
      province: park.province || '',
      city: park.city || '',
      address: park.address || '',
      phoneNumber: digitsOnly(park.phoneNumber, 20),
      guardPhone: park.guardPhone && park.guardPhone !== park.phoneNumber ? digitsOnly(park.guardPhone, 20) : '',
    });
    setEditTarget(park.id);
    setShowErrors(false);
    setFormOpen(true);
  };

  const formErrors = validateParkForm(formData);
  const visibleErrors = showErrors ? formErrors : {};
  const setField = (field, value) => setFormData((current) => ({ ...current, [field]: value }));

  const handleSubmit = () => {
    if (Object.keys(formErrors).length > 0) {
      setShowErrors(true);
      showNotification(Object.values(formErrors)[0], 'error');
      return;
    }
    const location = toPersistedLocation(formData.province, formData.city);
    const payload = {
      name: formData.name.trim(),
      province: location.province,
      city: location.city,
      address: formData.address.trim(),
      phoneNumber: formData.phoneNumber,
      guardPhone: formData.guardPhone || formData.phoneNumber,
    };
    if (editTarget) {
      updateMutation.mutate({ id: editTarget, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const saving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div className="page-toolbar">
        <h1 className="text-xl font-bold text-foreground sm:text-2xl">مدیریت شهرک‌های صنعتی</h1>
        <Button variant="primary" onPress={() => { resetForm(); setFormOpen(true); }} className="flex w-full items-center justify-center gap-2 sm:w-auto">
          <Plus className="h-4 w-4" />
          افزودن شهرک جدید
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex flex-col gap-2 p-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 rounded-lg" />
              ))}
            </div>
          ) : isError ? (
            <Alert status="danger">
              <AlertContent>
                <AlertTitle>خطا در دریافت اطلاعات</AlertTitle>
                <AlertDescription>{getErrorMessage(error, 'دریافت لیست شهرک‌ها ناموفق بود.')}</AlertDescription>
              </AlertContent>
            </Alert>
          ) : parks.length === 0 ? (
            <EmptyState
              icon={<MapPin className="h-6 w-6" />}
              title="هنوز شهرک صنعتی ثبت نشده است"
              description="با دکمه «افزودن شهرک جدید» می‌توانید اولین شهرک صنعتی را ثبت کنید."
            />
          ) : (
            <ResponsiveTable>
            <Table>
              <TableContent aria-label="شهرک‌های صنعتی">
              <TableHeader>
                <TableColumn isRowHeader>نام شهرک</TableColumn>
                <TableColumn>موقعیت</TableColumn>
                <TableColumn>تلفن</TableColumn>
                <TableColumn>وضعیت</TableColumn>
                <TableColumn>عملیات</TableColumn>
              </TableHeader>
              <TableBody>
                {parks.map((park) => (
                  <TableRow key={park.id} id={park.id}>
                    <TableCell>{park.name}</TableCell>
                    <TableCell>{park.province} - {park.city}</TableCell>
                    <TableCell><span dir="ltr">{park.phoneNumber || '—'}</span></TableCell>
                    <TableCell>
                      <Chip color={park.status === 'ACTIVE' ? 'success' : 'default'} size="sm" variant="soft">
                        {park.status === 'ACTIVE' ? 'فعال' : 'غیرفعال'}
                      </Chip>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="tertiary" size="sm" isIconOnly onPress={() => startEdit(park)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="danger-soft" size="sm" isIconOnly onPress={() => setDeleteTarget(park.id)}>
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

      {formOpen && (
        <ModalBackdrop isOpen={formOpen} onOpenChange={(open) => !open && setFormOpen(false)} variant="blur">
          <ModalContainer size="lg">
            <ModalDialog className="max-h-[min(92dvh,44rem)] overflow-y-auto rounded-2xl border border-default-200 bg-background p-4 sm:p-6 dark:border-white/10">
              <ModalHeader className="text-lg font-bold">{editTarget ? 'ویرایش شهرک صنعتی' : 'افزودن شهرک صنعتی جدید'}</ModalHeader>
              <ModalBody>
                <form
                  noValidate
                  className="flex flex-col gap-4"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (!saving) handleSubmit();
                  }}
                >
                  <div className="flex flex-col gap-1">
                    <label htmlFor="park-name" className="text-xs font-medium text-foreground-600">نام شهرک<span className="ms-0.5 text-danger" aria-hidden="true">*</span></label>
                    <Input id="park-name" value={formData.name} onChange={(e) => setField('name', e.target.value)} variant="primary" maxLength={160} placeholder="مثلاً شهرک صنعتی شمس‌آباد" aria-invalid={visibleErrors.name ? true : undefined} />
                    <FieldError message={visibleErrors.name} />
                  </div>
                  <IranProvinceCityFields
                    province={formData.province}
                    city={formData.city}
                    provinceError={visibleErrors.province}
                    cityError={visibleErrors.city}
                    onProvinceChange={(province) => setField('province', province)}
                    onCityChange={(city) => setField('city', city)}
                  />
                  <div className="flex flex-col gap-1">
                    <label htmlFor="park-address" className="text-xs font-medium text-foreground-600">آدرس<span className="ms-0.5 text-danger" aria-hidden="true">*</span></label>
                    <Input id="park-address" value={formData.address} onChange={(e) => setField('address', e.target.value)} variant="primary" maxLength={240} placeholder="کیلومتر ...، جاده ..." aria-invalid={visibleErrors.address ? true : undefined} />
                    <FieldError message={visibleErrors.address} />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="flex flex-col gap-1">
                      <label htmlFor="park-phone" className="text-xs font-medium text-foreground-600">شماره تماس شهرک<span className="ms-0.5 text-danger" aria-hidden="true">*</span></label>
                      <Input id="park-phone" value={formData.phoneNumber} onChange={(e) => setField('phoneNumber', digitsOnly(e.target.value, 20))} variant="primary" dir="ltr" inputMode="tel" placeholder="02112345678" aria-invalid={visibleErrors.phoneNumber ? true : undefined} />
                      <FieldError message={visibleErrors.phoneNumber} />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label htmlFor="park-guard-phone" className="text-xs font-medium text-foreground-600">تلفن نگهبانی (اختیاری)</label>
                      <Input id="park-guard-phone" value={formData.guardPhone} onChange={(e) => setField('guardPhone', digitsOnly(e.target.value, 20))} variant="primary" dir="ltr" inputMode="tel" placeholder="همان شماره شهرک" aria-invalid={visibleErrors.guardPhone ? true : undefined} />
                      <FieldError message={visibleErrors.guardPhone} />
                    </div>
                  </div>
                  <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
                </form>
              </ModalBody>
              <ModalFooter className="mt-4">
                <Button variant="tertiary" onPress={() => setFormOpen(false)} isDisabled={saving}>انصراف</Button>
                <Button variant="primary" onPress={handleSubmit} isDisabled={saving}>
                  {saving ? <Spinner size="sm" /> : editTarget ? 'ذخیره تغییرات' : 'افزودن'}
                </Button>
              </ModalFooter>
            </ModalDialog>
          </ModalContainer>
        </ModalBackdrop>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="حذف شهرک صنعتی"
        description="آیا از حذف این شهرک صنعتی اطمینان دارید؟ این عمل قابل بازگشت نیست."
        confirmLabel="حذف"
        confirmColor="danger"
        loading={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
};

export default ManageParksPage;
