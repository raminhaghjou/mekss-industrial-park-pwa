import { useState } from 'react';
import { useAuth } from '../../providers/AuthProvider';
import { useNotification } from '../../providers/NotificationProvider';
import { Card, CardContent, CardHeader, Input, Button, Avatar, Separator, Label, Spinner } from '@heroui/react';
import { User, Phone, Building2, Save } from 'lucide-react';

export const ProfilePage = () => {
  const { user } = useAuth();
  const { showNotification } = useNotification();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: user?.name || '',
    phoneNumber: user?.phoneNumber || '',
    email: user?.email || '',
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setLoading(false);
    showNotification('پروفایل با موفقیت به‌روزرسانی شد', 'success');
  };

  return (
    <div className="mx-auto max-w-2xl animate-fade-in">
      <h1 className="mb-6 text-2xl font-bold text-foreground">پروفایل</h1>

      <Card>
        <CardHeader className="flex items-center gap-4 p-6">
          <Avatar size="lg" className="h-16 w-16 bg-gradient-to-br from-primary-500 to-primary-700 text-2xl text-white">
            <Avatar.Fallback>{user?.name?.charAt(0) || 'U'}</Avatar.Fallback>
          </Avatar>
          <div>
            <h2 className="text-lg font-semibold text-foreground">{user?.name}</h2>
            <p className="text-sm text-foreground-500">{user?.role}</p>
          </div>
        </CardHeader>

        <Separator />

        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <Label className="text-xs font-medium text-foreground-600">نام و نام خانوادگی</Label>
              <div className="relative flex items-center">
                <User className="absolute right-3 h-4 w-4 text-default-400 pointer-events-none" />
                <Input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  variant="primary"
                  className="pr-9 rounded-xl"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <Label className="text-xs font-medium text-foreground-600">شماره تلفن</Label>
              <div className="relative flex items-center">
                <Phone className="absolute right-3 h-4 w-4 text-default-400 pointer-events-none" />
                <Input
                  type="tel"
                  value={formData.phoneNumber}
                  onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                  variant="primary"
                  dir="ltr"
                  readOnly
                  className="pr-9 rounded-xl"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <Label className="text-xs font-medium text-foreground-600">ایمیل</Label>
              <div className="relative flex items-center">
                <Building2 className="absolute right-3 h-4 w-4 text-default-400 pointer-events-none" />
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  variant="primary"
                  dir="ltr"
                  className="pr-9 rounded-xl"
                />
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="mt-4 flex items-center gap-2"
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
