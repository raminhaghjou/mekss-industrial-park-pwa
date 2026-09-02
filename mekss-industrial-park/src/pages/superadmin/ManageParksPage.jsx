import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, Button, Chip, Input, ModalBackdrop, ModalContainer, ModalDialog, ModalHeader, ModalBody, ModalFooter, Skeleton, Alert, AlertContent, AlertTitle, AlertDescription, Spinner } from '@heroui/react';
import { Plus, Pencil, Trash2, MapPin } from 'lucide-react';
import { parkApi } from '../../services/api/park.api';
import { useNotification } from '../../providers/NotificationProvider';
import { getErrorMessage } from '../../utils/apiError';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { EmptyState } from '../../components/common/EmptyState';

export const ManageParksPage = () => {
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [formData, setFormData] = useState({ code: '', name: '', province: '', city: '', address: '', phoneNumber: '' });
  const { showNotification } = useNotification();
  const queryClient = useQueryClient();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['parks'],
    queryFn: () => parkApi.getParks().then((res) => res.data),
  });

  const createMutation = useMutation({
    mutationFn: (data) => parkApi.createPark(data),
    onSuccess: () => {
      showNotification('شهرک صنعتی با موفقیت ایجاد شد', 'success');
      setFormOpen(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['parks'] });
    },
    onError: (err) => showNotification(getErrorMessage(err, 'ایجاد شهرک ناموفق بود'), 'error'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => parkApi.updatePark(id, data),
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

  const parks = data || [];

  const resetForm = () => {
    setFormData({ code: '', name: '', province: '', city: '', address: '', phoneNumber: '' });
    setEditTarget(null);
  };

  const startEdit = (park) => {
    setFormData({
      code: park.code || '',
      name: park.name || '',
      province: park.province || '',
      city: park.city || '',
      address: park.address || '',
      phoneNumber: park.phoneNumber || '',
    });
    setEditTarget(park.id);
    setFormOpen(true);
  };

  const handleSubmit = () => {
    if (editTarget) {
      updateMutation.mutate({ id: editTarget, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const saving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">مدیریت شهرک‌های صنعتی</h1>
        <Button variant="primary" onPress={() => { resetForm(); setFormOpen(true); }} className="flex items-center gap-2">
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
            <Table aria-label="شهرک‌های صنعتی">
              <TableHeader>
                <TableColumn>کد</TableColumn>
                <TableColumn>نام شهرک</TableColumn>
                <TableColumn>موقعیت</TableColumn>
                <TableColumn>وضعیت</TableColumn>
                <TableColumn>عملیات</TableColumn>
              </TableHeader>
              <TableBody>
                {parks.map((park) => (
                  <TableRow key={park.id}>
                    <TableCell>{park.code}</TableCell>
                    <TableCell>{park.name}</TableCell>
                    <TableCell>{park.province} - {park.city}</TableCell>
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
            </Table>
          )}
        </CardContent>
      </Card>

      {formOpen && (
        <ModalBackdrop isOpen={formOpen} onOpenChange={(open) => !open && setFormOpen(false)} variant="blur">
          <ModalContainer size="lg">
            <ModalDialog className="rounded-2xl border border-default-200 dark:border-white/10 p-6 bg-background">
              <ModalHeader className="text-lg font-bold">{editTarget ? 'ویرایش شهرک صنعتی' : 'افزودن شهرک صنعتی جدید'}</ModalHeader>
              <ModalBody>
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-foreground-600">کد شهرک</label>
                    <Input value={formData.code} onChange={(e) => setFormData({ ...formData, code: e.target.value })} variant="primary" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-foreground-600">نام شهرک</label>
                    <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} variant="primary" isRequired />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-foreground-600">استان</label>
                    <Input value={formData.province} onChange={(e) => setFormData({ ...formData, province: e.target.value })} variant="primary" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-foreground-600">شهر</label>
                    <Input value={formData.city} onChange={(e) => setFormData({ ...formData, city: e.target.value })} variant="primary" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-foreground-600">آدرس</label>
                    <Input value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} variant="primary" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-foreground-600">شماره تماس</label>
                    <Input value={formData.phoneNumber} onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })} variant="primary" dir="ltr" />
                  </div>
                </div>
              </ModalBody>
              <ModalFooter className="mt-4">
                <Button variant="tertiary" onPress={() => setFormOpen(false)} isDisabled={saving}>انصراف</Button>
                <Button variant="primary" onPress={handleSubmit} isLoading={saving} isDisabled={saving}>
                  {editTarget ? 'ذخیره تغییرات' : 'افزودن'}
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
