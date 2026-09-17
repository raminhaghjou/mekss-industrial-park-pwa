import { useState } from 'react';
import { Moon, Bell, Sun } from 'lucide-react';
import { Card, CardContent, CardHeader, Separator } from '@heroui/react';
import { useTheme } from '../../providers/ThemeProvider';
import { useAuth } from '../../providers/AuthProvider';
import { SettingToggle } from '../../components/common/SettingToggle';
import { GatePassWalletSettingCard } from '../../components/settings/GatePassWalletSettingCard';

export const SettingsPage = () => {
  const { isDark, setTheme } = useTheme();
  const { user } = useAuth();
  const [notificationsOn, setNotificationsOn] = useState(true);

  return (
    <div className="mx-auto max-w-2xl animate-fade-in flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-foreground">تنظیمات</h1>

      {user?.role === 'SUPER_ADMIN' && <GatePassWalletSettingCard />}

      <Card className="border border-default-200 dark:border-white/10">
        <CardHeader className="p-6">
          <h2 className="text-lg font-semibold">تنظیمات عمومی</h2>
        </CardHeader>
        <Separator />
        <CardContent className="p-6">
          <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                {isDark ? (
                  <Moon className="h-5 w-5 shrink-0 text-primary" />
                ) : (
                  <Sun className="h-5 w-5 shrink-0 text-foreground-500" />
                )}
                <div className="min-w-0">
                  <p className="font-medium text-foreground">حالت تاریک</p>
                  <p className="text-sm text-foreground-500">
                    {isDark ? 'تم تاریک فعال است' : 'استفاده از تم تاریک برای محافظت از چشم'}
                  </p>
                </div>
              </div>
              <SettingToggle
                checked={isDark}
                label="تغییر حالت تاریک"
                onChange={(on) => setTheme(on ? 'dark' : 'light')}
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <Bell className="h-5 w-5 shrink-0 text-foreground-500" />
                <div className="min-w-0">
                  <p className="font-medium text-foreground">اعلان‌ها</p>
                  <p className="text-sm text-foreground-500">دریافت اعلان‌های push</p>
                </div>
              </div>
              <SettingToggle
                checked={notificationsOn}
                label="اعلان‌ها"
                onChange={setNotificationsOn}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SettingsPage;
