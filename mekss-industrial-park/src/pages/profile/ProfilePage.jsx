import { useState } from 'react';
import { useAuth } from '../../providers/AuthProvider';
import { useNotification } from '../../providers/NotificationProvider';
import { Card, CardBody, CardHeader, Input, Button, Avatar, Divider } from '@heroui/react';
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
    // API call would go here
    await new Promise(resolve => setTimeout(resolve, 1000));
    setLoading(false);
    showNotification('پروفایل با موفقیت به‌روزرسانی شد', 'success');
  };

  return (
    <div className="mx-auto max-w-2xl animate-fade-in">
      <h1 className="mb-6 text-2xl font-bold text-foreground">پروفایل</h1>
      
      <Card>
        <CardHeader className="flex items-center gap-4 p-6">
          <Avatar
            name={user?.name?.charAt(0) || 'U'}
            className="h-16 w-16 bg-gradient-to-br from-primary-500 to-primary-700 text-2xl text-white"
          />
          <div>
            <h2 className="text-lg font-semibold text-foreground">{user?.name}</h2>
            <p className="text-sm text-foreground-500">{user?.role}</p>
          </div>
        </CardHeader>
        
        <Divider />
        
        <CardBody className="p-6">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              type="text"
              label="نام و نام خانوادگی"
              value={formData.name}
              onValueChange={(value) => setFormData({ ...formData, name: value })}
              startContent={<User className="h-4 w-4 text-default-400" />}
              variant="bordered"
            />
            
            <Input
              type="tel"
              label="شماره تلفن"
              value={formData.phoneNumber}
              onValueChange={(value) => setFormData({ ...formData, phoneNumber: value })}
              startContent={<Phone className="h-4 w-4 text-default-400" />}
              variant="bordered"
              dir="ltr"
              isReadOnly
            />
            
            <Input
              type="email"
              label="ایمیل"
              value={formData.email}
              onValueChange={(value) => setFormData({ ...formData, email: value })}
              startContent={<Building2 className="h-4 w-4 text-default-400" />}
              variant="bordered"
              dir="ltr"
            />
            
            <Button
              type="submit"
              color="primary"
              size="lg"
              className="mt-4"
              startContent={<Save className="h-4 w-4" />}
              isLoading={loading}
            >
              ذخیره تغییرات
            </Button>
          </form>
        </CardBody>
      </Card>
    </div>
  );
};

export default ProfilePage;
