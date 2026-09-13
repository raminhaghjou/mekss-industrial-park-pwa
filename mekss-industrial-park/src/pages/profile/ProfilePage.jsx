import { useEffect, useState } from 'react';
import { useAuth } from '../../providers/AuthProvider';
import { useNotification } from '../../providers/NotificationProvider';
import { authApi } from '../../services/api/auth.api';
import { getErrorMessage } from '../../utils/apiError';
import { Card, CardContent, CardHeader, Input, Button, Avatar, Separator, Label, Spinner } from '@heroui/react';
import { User, Phone, Mail, Save, Camera } from 'lucide-react';
import { FileUploader } from '../../components/common/FileUploader';
import { AuthenticatedImage } from '../../components/common/AuthenticatedImage';

export const ProfilePage = () => {
  const { user, refreshProfile } = useAuth();
  const { showNotification } = useNotification();
  const [loading, setLoading] = useState(false);
  const [avatarFile, setAvatarFile] = useState(null);
  const [formData, setFormData] = useState({
    name: user?.name || '',
    phoneNumber: user?.phoneNumber || '',
    email: user?.email || '',
  });

  useEffect(() => {
    setFormData({
      name: user?.name || '',
      phoneNumber: user?.phoneNumber || '',
      email: user?.email || '',
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
        ...(avatarFile?.id ? { avatar: avatarFile.id } : {}),
      });
      await refreshProfile();
      showNotification('پروفایل با موفقیت به‌روزرسانی شد', 'success');
    } catch (error) {
      showNotification(getErrorMessage(error, 'به‌روزرسانی پروفایل ناموفق بود'), 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl animate-fade-in">
      <h1 className="mb-6 text-2xl font-bold text-foreground">پروفایل</h1>

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
    </div>
  );
};

export default ProfilePage;
