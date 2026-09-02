import React from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  Input,
  TextArea,
  Checkbox,
  Button,
  Chip,
  Spinner,
  Alert,
  AlertContent,
  AlertTitle,
  AlertDescription,
} from '@heroui/react';
import { Plus, Edit2, Trash2, Bell, Pin, Globe, Building2 } from 'lucide-react';
import { announcementApi } from '../../services/api/announcement.api';
import { parkApi } from '../../services/api/park.api';
import { useAuth } from '../../providers/AuthProvider';
import { useNotification } from '../../providers/NotificationProvider';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { EmptyState } from '../../components/common/EmptyState';
import { getErrorMessage } from '../../utils/apiError';
import { queryKeys } from '../../services/queryKeys';

const emptyForm = { title: '', content: '', isGlobal: false, isPinned: false, priority: '0', parkId: '', expiresAt: '' };

const toDateInputValue = (value) => (value ? new Date(value).toISOString().slice(0, 10) : '');

const ManageAnnouncementsPage = () => {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const { showNotification } = useNotification();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = React.useState(false);
  const [editing, setEditing] = React.useState(null);
  const [form, setForm] = React.useState(emptyForm);
  const [deleteTarget, setDeleteTarget] = React.useState(null);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: queryKeys.announcements.managed(),
    queryFn: () => announcementApi.getManagedAnnouncements().then((res) => res.data),
  });

  const { data: parksData } = useQuery({
    queryKey: queryKeys.parks.all(),
    queryFn: () => parkApi.getParks().then((res) => res.data),
    enabled: isSuperAdmin && showForm,
  });
  const parks = Array.isArray(parksData) ? parksData : parksData?.items || [];

  const invalidate = () => queryClient.invalidateQueries({ queryKey: queryKeys.announcements.managed() });

  const resetForm = () => { setForm(emptyForm); setEditing(null); setShowForm(false); };

  const createMutation = useMutation({
    mutationFn: (/** @type {object} */ payload) => announcementApi.createAnnouncement(payload),
    onSuccess: () => { showNotification('اطلاعیه با موفقیت ثبت شد.', 'success'); resetForm(); invalidate(); },
    onError: (err) => showNotification(getErrorMessage(err, 'ثبت اطلاعیه ناموفق بود.'), 'error'),
  });

  const updateMutation = useMutation({
    mutationFn: (/** @type {{id: string, payload: object}} */ { id, payload }) => announcementApi.updateAnnouncement(id, payload),
    onSuccess: () => { showNotification('اطلاعیه با موفقیت ویرایش شد.', 'success'); resetForm(); invalidate(); },
    onError: (err) => showNotification(getErrorMessage(err, 'ویرایش اطلاعیه ناموفق بود.'), 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: (/** @type {string} */ id) => announcementApi.deleteAnnouncement(id),
    onSuccess: () => { showNotification('اطلاعیه حذف شد.', 'success'); setDeleteTarget(null); invalidate(); },
    onError: (err) => showNotification(getErrorMessage(err, 'حذف اطلاعیه ناموفق بود.'), 'error'),
  });

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!form.title.trim() || !form.content.trim()) {
      showNotification('عنوان و متن اطلاعیه الزامی است.', 'error');
      return;
    }
    const basePayload = {
      title: form.title,
      content: form.content,
      isGlobal: form.isGlobal,
      isPinned: form.isPinned,
      priority: Number(form.priority) || 0,
      expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : undefined,
    };
    if (editing) {
      updateMutation.mutate({ id: editing.id, payload: basePayload });
    } else {
      createMutation.mutate({ ...basePayload, parkId: form.isGlobal ? undefined : form.parkId || undefined });
    }
  };

  const startEdit = (announcement) => {
    setEditing(announcement);
    setForm({
      title: announcement.title,
      content: announcement.content,
      isGlobal: Boolean(announcement.isGlobal),
      isPinned: Boolean(announcement.isPinned),
      priority: String(announcement.priority ?? 0),
      parkId: announcement.parkId || '',
      expiresAt: toDateInputValue(announcement.expiresAt),
    });
    setShowForm(true);
  };

  const announcements = data || [];
  const saving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-100 dark:bg-primary-900/40 text-primary-600">
            <Bell className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">مدیریت اطلاعیه‌ها</h1>
            <p className="text-sm text-foreground-500">انتشار، تنظیم و ویرایش اطلاعیه‌های شهرک صنعتی</p>
          </div>
        </div>
        <Button
          variant="primary"
          onPress={() => { if (showForm) { resetForm(); } else { setShowForm(true); } }}
          className="rounded-xl font-bold flex items-center gap-2"
        >
          {!showForm && <Plus className="h-4 w-4" />}
          {showForm ? 'بستن فرم' : 'ثبت اطلاعیه جدید'}
        </Button>
      </div>

      {showForm && (
        <Card className="border border-default-200 shadow-sm rounded-2xl p-2 dark:border-white/10">
          <CardContent className="p-6">
            <h2 className="text-lg font-bold text-foreground mb-4">
              {editing ? 'ویرایش اطلاعیه' : 'فرم ثبت اطلاعیه جدید'}
            </h2>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-foreground-600">عنوان اطلاعیه</label>
                <Input
                  placeholder="عنوان اطلاع‌رسانی را وارد کنید..."
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  variant="primary"
                  isRequired
                  className="rounded-xl"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-foreground-600">متن اطلاعیه</label>
                <TextArea
                  placeholder="متن کامل اطلاعیه..."
                  value={form.content}
                  onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                  variant="primary"
                  minRows={4}
                  isRequired
                  className="rounded-xl"
                />
              </div>

              <div className="flex flex-wrap gap-6 py-1">
                <label className="flex items-center gap-2 cursor-pointer text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={form.isGlobal}
                    onChange={(e) => setForm((f) => ({ ...f, isGlobal: e.target.checked, parkId: e.target.checked ? '' : f.parkId }))}
                    className="h-4 w-4 rounded border-default-300 text-primary focus:ring-primary"
                  />
                  نمایش سراسری (همه شهرک‌ها)
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={form.isPinned}
                    onChange={(e) => setForm((f) => ({ ...f, isPinned: e.target.checked }))}
                    className="h-4 w-4 rounded border-default-300 text-primary focus:ring-primary"
                  />
                  سنجاق‌شده (نمایش در ابتدای فهرست)
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-foreground-600">اولویت</label>
                  <Input
                    type="number"
                    value={form.priority}
                    onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
                    variant="primary"
                    className="rounded-xl"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-foreground-600">تاریخ انقضا (اختیاری)</label>
                  <Input
                    type="date"
                    value={form.expiresAt}
                    onChange={(e) => setForm((f) => ({ ...f, expiresAt: e.target.value }))}
                    variant="primary"
                    className="rounded-xl"
                  />
                </div>

                {!editing && isSuperAdmin && !form.isGlobal && (
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-foreground-600">شهرک صنعتی هدف</label>
                    <select
                      value={form.parkId}
                      onChange={(e) => setForm((f) => ({ ...f, parkId: e.target.value }))}
                      className="w-full rounded-xl border border-default-300 bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none"
                    >
                      <option value="">انتخاب شهرک...</option>
                      {parks.map((park) => (
                        <option key={park.id} value={park.id}>{park.name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 justify-end mt-2">
                <Button variant="tertiary" onPress={resetForm} disabled={saving} className="rounded-xl font-medium">
                  انصراف
                </Button>
                <Button type="submit" variant="primary" disabled={saving} className="rounded-xl font-bold">
                  {saving ? <Spinner size="sm" /> : (editing ? 'ذخیره تغییرات' : 'ثبت اطلاعیه')}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {isLoading && (
        <div className="flex min-h-[200px] flex-col items-center justify-center gap-3">
          <Spinner size="lg" />
          <p className="text-sm text-foreground-500">در حال دریافت اطلاعیه‌ها...</p>
        </div>
      )}

      {isError && (
        <Alert status="danger">
          <AlertContent>
            <AlertTitle>خطا</AlertTitle>
            <AlertDescription>{getErrorMessage(error, 'دریافت اطلاعیه‌ها ناموفق بود.')}</AlertDescription>
          </AlertContent>
        </Alert>
      )}

      {!isLoading && !isError && (
        <Card className="border border-default-200 shadow-sm rounded-2xl dark:border-white/10">
          <CardContent className="p-0 divide-y divide-default-100 dark:divide-white/5">
            {announcements.length === 0 ? (
              <div className="p-8">
                <EmptyState
                  icon={<Bell className="h-8 w-8 text-default-400" />}
                  title="هنوز اطلاعیه‌ای ثبت نشده است"
                  description="با دکمه «ثبت اطلاعیه جدید» می‌توانید اولین اطلاعیه را برای کاربران منتشر کنید."
                />
              </div>
            ) : (
              announcements.map((ann) => (
                <div key={ann.id} className="flex items-center justify-between p-4 hover:bg-default-50 transition-colors">
                  <div className="flex flex-col gap-1 min-w-0 pr-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-foreground text-base">{ann.title}</span>
                      {ann.isPinned && (
                        <Chip size="sm" color="warning" variant="soft" className="font-semibold flex items-center gap-1">
                          <Pin className="h-3 w-3" />
                          سنجاق‌شده
                        </Chip>
                      )}
                      {ann.isGlobal ? (
                        <Chip size="sm" color="accent" variant="soft" className="font-semibold flex items-center gap-1">
                          <Globe className="h-3 w-3" />
                          سراسری
                        </Chip>
                      ) : (
                        <Chip size="sm" color="default" variant="soft" className="font-semibold flex items-center gap-1">
                          <Building2 className="h-3 w-3" />
                          شهرک‌محور
                        </Chip>
                      )}
                    </div>
                    <span className="text-xs text-foreground-400">
                      ثبت: {new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium' }).format(new Date(ann.createdAt))}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button isIconOnly variant="ghost" size="sm" onPress={() => startEdit(ann)} className="rounded-xl" aria-label="ویرایش">
                      <Edit2 className="h-4 w-4 text-default-600" />
                    </Button>
                    <Button isIconOnly variant="danger-soft" size="sm" onPress={() => setDeleteTarget(ann.id)} className="rounded-xl" aria-label="حذف">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="حذف اطلاعیه"
        description="این اطلاعیه برای همیشه حذف خواهد شد. آیا اطمینان دارید؟"
        confirmLabel="حذف"
        confirmColor="danger"
        loading={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
};

export default ManageAnnouncementsPage;

