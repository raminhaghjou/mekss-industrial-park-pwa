import { Switch, Card, CardBody, CardHeader, Divider } from '@heroui/react';
import { Moon, Bell } from 'lucide-react';

export const SettingsPage = () => {
  return (
    <div className="mx-auto max-w-2xl animate-fade-in">
      <h1 className="mb-6 text-2xl font-bold text-foreground">تنظیمات</h1>
      
      <Card>
        <CardHeader className="p-6">
          <h2 className="text-lg font-semibold">تنظیمات عمومی</h2>
        </CardHeader>
        <Divider />
        <CardBody className="p-6">
          <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Moon className="h-5 w-5 text-foreground-500" />
                <div>
                  <p className="font-medium text-foreground">حالت تاریک</p>
                  <p className="text-sm text-foreground-500">استفاده از تم تاریک برای محافظت از چشم</p>
                </div>
              </div>
              <Switch defaultSelected={false} />
            </div>
            
            <Divider />
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Bell className="h-5 w-5 text-foreground-500" />
                <div>
                  <p className="font-medium text-foreground">اعلان‌ها</p>
                  <p className="text-sm text-foreground-500">دریافت اعلان‌های push</p>
                </div>
              </div>
              <Switch defaultSelected />
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
};

export default SettingsPage;
