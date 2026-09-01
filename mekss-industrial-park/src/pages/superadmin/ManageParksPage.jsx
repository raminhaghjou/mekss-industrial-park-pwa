import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardBody, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, Button, Chip, Input, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Skeleton, Alert } from '@heroui/react';
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

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">مدیریت شهرک‌های صنعتی</h1>
        <Button color="primary" startContent={<Plus className="h-4 w-4" />} onClick={() => { resetForm(); setFormOpen(true); }}>
          افزودن شهرک جدید
        </Button>
      </div>

      <Card>
        <CardBody className="p-0">
          {isLoading ? (
            <div className="flex flex-col gap-2 p-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 rounded-lg" />
              ))}
            </div>
          ) : isError ? (
            <Alert color="danger" title="خطا در دریافت اطلاعات">
              {getErrorMessage(error, 'دریافت لیست شهرک‌ها ناموفق بود.')}
            </Alert>
          ) : parks.length === 0 ? (
            <EmptyState
              icon={<MapPin className="h-6 w-6" />}
              title="هنوز شهرک صنعتی ثبت نشده است"
              description="با دکمه «افزودن شهرک جدید» می‌توانید اولین شهرک صنعتی را ثبت کنید."
            />
          ) : (
            <Table removeWrapper aria-label="شهرک‌های صنعتی">
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
                      <Chip color={park.status === 'ACTIVE' ? 'success' : 'default'} size="sm" variant="flat">
                        {park.status === 'ACTIVE' ? 'فعال' : 'غیرفعال'}
                      </Chip>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="flat" size="sm" isIconOnly onClick={() => startEdit(park)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button color="danger" variant="flat" size="sm" isIconOnly onClick={() => setDeleteTarget(park.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardBody>
      </Card>

      <Modal isOpen={formOpen} onClose={() => setFormOpen(false)} size="2xl">
        <ModalContent>
          <ModalHeader>{editTarget ? 'ویرایش شهرک صنعتی' : 'افزودن شهرک صنعتی جدید'}</ModalHeader>
          <ModalBody>
            <div className="flex flex-col gap-4">
              <Input label="کد شهرک" value={formData.code} onValueChange={(v) => setFormData({ ...formData, code: v })} variant="bordered" />
              <Input label="نام شهرک" value={formData.name} onValueChange={(v) => setFormData({ ...formData, name: v })} variant="bordered" isRequired />
              <Input label="استان" value={formData.province} onValueChange={(v) => setFormData({ ...formData, province: v })} variant="bordered" />
              <Input label="شهر" value={formData.city} onValueChange={(v) => setFormData({ ...formData, city: v })} variant="bordered" />
              <Input label="آدرس" value={formData.address} onValueChange={(v) => setFormData({ ...formData, address: v })} variant="bordered" />
              <Input label="شماره تماس" value={formData.phoneNumber} onValueChange={(v) => setFormData({ ...formData, phoneNumber: v })} variant="bordered" dir="ltr" />
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onClick={() => setFormOpen(false)}>انصراف</Button>
            <Button color="primary" onClick={handleSubmit} isLoading={createMutation.isPending || updateMutation.isPending}>
              {editTarget ? 'ذخیره تغییرات' : 'افزودن'}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

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
