import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../providers/AuthProvider';
import { useNotification } from '../../providers/NotificationProvider';
import { authApi } from '../../services/api/auth.api';
import { getErrorMessage } from '../../utils/apiError';
import { Card, CardContent, CardHeader, Input, Button, Avatar, Separator, Label, Spinner } from '@heroui/react';
import { User, Phone, Mail, Save, Camera, Lock, AtSign } from 'lucide-react';
import { FileUploader } from '../../components/common/FileUploader';
import { AuthenticatedImage } from '../../components/common/AuthenticatedImage';

export const ProfilePage = () => {
  const { user, refreshProfile } = useAuth();
  const { showNotification } = useNotification();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [avatarFile, setAvatarFile] = useState(null);
  const forceChangePassword = searchParams.get('changePassword') === '1' || user?.mustChangePassword;
  const [formData, setFormData] = useState({
    name: user?.name || '',
    phoneNumber: user?.phoneNumber || '',
    email: user?.email || '',
    username: user?.username || '',
    messagingRestricted: Boolean(user?.messagingRestricted),
  });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  useEffect(() => {
    setFormData({
      name: user?.name || '',
      phoneNumber: user?.phoneNumber || '',
      email: user?.email || '',
      username: user?.username || '',
      messagingRestricted: Boolean(user?.messagingRestricted),
    });
    setAvatarFile(user?.avatar ? { id: user.avatar } : null);
  }, [user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await authApi.updateProfile({
        name: formData.name.trim(),
        email: formData.email.trim() || undefined,
        username: formData.username.trim().toLowerCase() || undefined,
        ...(avatarFile?.id ? { avatar: avatarFile.id } : {}),
        ...(user?.role === 'PARK_MANAGER' ? { messagingRestricted: formData.messagingRestricted } : {}),
      });
      await refreshProfile();
      showNotification('پروفایل با موفقیت به‌روزرسانی شد', 'success');
    } catch (error) {
      showNotification(getErrorMessage(error, 'به‌روزرسانی پروفایل ناموفق بود'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      showNotification('تکرار رمز عبور مطابقت ندارد', 'error');
      return;
    }
    if (passwordForm.newPassword.length < 6) {
      showNotification('رمز عبور باید حداقل ۶ کاراکتر باشد', 'error');
      return;
    }
    setPasswordLoading(true);
    try {
      await authApi.changePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      await refreshProfile();
      if (searchParams.get('changePassword')) {
        searchParams.delete('changePassword');
        setSearchParams(searchParams, { replace: true });
      }
      showNotification('رمز عبور با موفقیت تغییر کرد', 'success');
    } catch (error) {
      showNotification(getErrorMessage(error, 'تغییر رمز عبور ناموفق بود'), 'error');
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl animate-fade-in space-y-6">
      <h1 className="text-2xl font-bold text-foreground">پروفایل</h1>

      {forceChangePassword && (
        <div className="rounded-xl border border-warning-300 bg-warning-50 px-4 py-3 text-sm text-warning-800 dark:border-warning-500/40 dark:bg-warning-500/10 dark:text-warning-200">
          به دلایل امنیتی باید رمز عبور خود را تغییر دهید.
        </div>
      )}

      <Card className="border border-default-200 dark:border-white/10">
        <CardHeader className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center">
          <div className="relative">
            <Avatar size="lg" className="h-20 w-20 overflow-hidden bg-gradient-to-br from-primary-500 to-primary-700 text-2xl text-white">
              {avatarFile?.id || user?.avatar ? (
                <AuthenticatedImage
                  fileId={avatarFile?.id || user?.avatar}
                  alt={user?.name || 'avatar'}
                  className="h-full w-full object-cover"
                  fallback={<Avatar.Fallback>{user?.name?.charAt(0) || 'U'}</Avatar.Fallback>}
                />
              ) : (
                <Avatar.Fallback>{user?.name?.charAt(0) || 'U'}</Avatar.Fallback>
              )}
            </Avatar>
            <span className="absolute -bottom-1 -left-1 flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-brand)] text-white shadow">
              <Camera className="h-4 w-4" />
            </span>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">{user?.name}</h2>
            <p className="text-sm text-foreground-500">{user?.role}</p>
          </div>
        </CardHeader>

        <Separator />

        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div className="rounded-2xl border border-dashed border-default-300 bg-default-50/60 p-4 dark:border-white/15 dark:bg-white/5">
              <p className="mb-3 text-sm font-medium text-foreground">عکس پروفایل</p>
              <FileUploader
                domain="avatar"
                label="انتخاب / آپلود عکس"
                hint="JPG، PNG یا WebP — حداکثر ۲ مگابایت"
                value={avatarFile}
                onUploaded={(file) => setAvatarFile(file)}
                onCleared={() => setAvatarFile(null)}
              />
            </div>

            <div className="flex flex-col gap-1">
              <Label className="text-xs font-medium text-foreground-600">نام و نام خانوادگی</Label>
              <div className="relative flex items-center">
                <User className="pointer-events-none absolute right-3 h-4 w-4 text-default-400" />
                <Input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  variant="primary"
                  className="rounded-xl pr-9"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <Label className="text-xs font-medium text-foreground-600">نام کاربری</Label>
              <div className="relative flex items-center">
                <AtSign className="pointer-events-none absolute right-3 h-4 w-4 text-default-400" />
                <Input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({
                    ...formData,
                    username: e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ''),
                  })}
                  variant="primary"
                  dir="ltr"
                  className="rounded-xl pr-9"
                  placeholder="username"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <Label className="text-xs font-medium text-foreground-600">شماره تلفن</Label>
              <div className="relative flex items-center">
                <Phone className="pointer-events-none absolute right-3 h-4 w-4 text-default-400" />
                <Input
                  type="tel"
                  value={formData.phoneNumber}
                  variant="primary"
                  dir="ltr"
                  readOnly
                  className="rounded-xl pr-9"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <Label className="text-xs font-medium text-foreground-600">ایمیل</Label>
              <div className="relative flex items-center">
                <Mail className="pointer-events-none absolute right-3 h-4 w-4 text-default-400" />
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  variant="primary"
                  dir="ltr"
                  className="rounded-xl pr-9"
                />
              </div>
            </div>

            {user?.role === 'PARK_MANAGER' && (
              <button
                type="button"
                onClick={() => setFormData((prev) => ({ ...prev, messagingRestricted: !prev.messagingRestricted }))}
                className="flex w-full items-center justify-between rounded-xl bg-default-50 px-4 py-3 text-start"
              >
                <div>
                  <p className="text-sm font-medium">محدود کردن پیام واحدها</p>
                  <p className="text-xs text-foreground-500">در صورت فعال بودن، مدیران واحد نمی‌توانند پیام مستقیم بفرستند (مدیر شهرک همچنان می‌تواند).</p>
                </div>
                <span className={`relative h-6 w-11 shrink-0 rounded-full transition ${formData.messagingRestricted ? 'bg-warning-500' : 'bg-default-300'}`}>
                  <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${formData.messagingRestricted ? '-translate-x-0.5 start-0' : 'translate-x-0.5 end-0'}`} />
                </span>
              </button>
            )}

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="mt-2 flex items-center gap-2"
              isDisabled={loading}
            >
              {loading ? <Spinner size="sm" /> : <Save className="h-4 w-4" />}
              ذخیره تغییرات
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="border border-default-200 dark:border-white/10" id="change-password">
        <CardHeader className="p-6">
          <div className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-foreground-500" />
            <h2 className="text-lg font-semibold text-foreground">تغییر رمز عبور</h2>
          </div>
        </CardHeader>
        <Separator />
        <CardContent className="p-6">
          <form onSubmit={handleChangePassword} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <Label className="text-xs font-medium text-foreground-600">رمز عبور فعلی</Label>
              <Input
                type="password"
                required
                value={passwordForm.currentPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                variant="primary"
                dir="ltr"
                className="rounded-xl"
                autoFocus={forceChangePassword}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs font-medium text-foreground-600">رمز عبور جدید</Label>
              <Input
                type="password"
                required
                minLength={6}
                value={passwordForm.newPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                variant="primary"
                dir="ltr"
                className="rounded-xl"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs font-medium text-foreground-600">تکرار رمز عبور جدید</Label>
              <Input
                type="password"
                required
                minLength={6}
                value={passwordForm.confirmPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                variant="primary"
                dir="ltr"
                className="rounded-xl"
              />
            </div>
            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="mt-2 flex items-center gap-2"
              isDisabled={passwordLoading}
            >
              {passwordLoading ? <Spinner size="sm" /> : <Lock className="h-4 w-4" />}
              تغییر رمز عبور
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProfilePage;
