import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  Input,
  Button,
  Label,
  Spinner,
  Chip,
} from '@heroui/react';
import { Tags, Plus, Trash2 } from 'lucide-react';
import { advertisementApi } from '../../services/api/advertisement.api';
import { useNotification } from '../../providers/NotificationProvider';
import { getErrorMessage } from '../../utils/apiError';

export const ManageAdCategoriesPage = () => {
  const { showNotification } = useNotification();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ key: '', label: '' });

  const { data = [], isLoading } = useQuery({
    queryKey: ['advertisement-categories', 'managed'],
    queryFn: () => advertisementApi.getManagedCategories().then((res) => res.data),
  });

  const createMutation = useMutation({
    mutationFn: () => advertisementApi.createCategory(form),
    onSuccess: () => {
      showNotification('دسته جدید اضافه شد', 'success');
      setForm({ key: '', label: '' });
      queryClient.invalidateQueries({ queryKey: ['advertisement-categories'] });
    },
    onError: (err) => showNotification(getErrorMessage(err, 'افزودن دسته ناموفق بود'), 'error'),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }) => advertisementApi.updateCategory(id, { isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['advertisement-categories'] }),
    onError: (err) => showNotification(getErrorMessage(err, 'به‌روزرسانی ناموفق بود'), 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => advertisementApi.deleteCategory(id),
    onSuccess: () => {
      showNotification('دسته حذف شد', 'success');
      queryClient.invalidateQueries({ queryKey: ['advertisement-categories'] });
    },
    onError: (err) => showNotification(getErrorMessage(err, 'حذف دسته ناموفق بود'), 'error'),
  });

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <Tags className="h-6 w-6 text-[var(--color-brand)]" />
        <div>
          <h1 className="text-xl font-bold">دسته‌بندی آگهی‌ها</h1>
          <p className="text-sm text-foreground-500">مدیریت دسته‌های دیوار آگهی (CRUD)</p>
        </div>
      </div>

      <Card className="rounded-2xl border border-default-200">
        <CardContent className="gap-3 p-5">
          <h2 className="font-semibold">افزودن دسته</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label className="text-xs">کلید (انگلیسی)</Label>
              <Input
                dir="ltr"
                value={form.key}
                onChange={(e) => setForm((p) => ({ ...p, key: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '') }))}
                placeholder="EQUIPMENT"
                className="rounded-xl"
              />
            </div>
            <div>
              <Label className="text-xs">برچسب فارسی</Label>
              <Input
                value={form.label}
                onChange={(e) => setForm((p) => ({ ...p, label: e.target.value }))}
                className="rounded-xl"
              />
            </div>
          </div>
          <Button
            variant="primary"
            className="self-start font-bold"
            isDisabled={!form.key || !form.label || createMutation.isPending}
            onPress={() => createMutation.mutate()}
          >
            {createMutation.isPending ? <Spinner size="sm" /> : <Plus className="h-4 w-4" />}
            افزودن
          </Button>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border border-default-200">
        <CardContent className="divide-y divide-default-100 p-0">
          {isLoading ? (
            <div className="p-6"><Spinner /></div>
          ) : data.map((cat) => (
            <div key={cat.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className="font-bold">{cat.label}</p>
                <p className="text-xs text-foreground-500" dir="ltr">{cat.key}</p>
              </div>
              <div className="flex items-center gap-2">
                <Chip size="sm" color={cat.isActive ? 'success' : 'default'} variant="soft">
                  {cat.isActive ? 'فعال' : 'غیرفعال'}
                </Chip>
                <Button
                  size="sm"
                  variant="secondary"
                  onPress={() => toggleMutation.mutate({ id: cat.id, isActive: !cat.isActive })}
                >
                  {cat.isActive ? 'غیرفعال' : 'فعال'}
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  isIconOnly
                  onPress={() => deleteMutation.mutate(cat.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};

export default ManageAdCategoriesPage;
