import { useId, useState } from 'react';
import { Moon, Bell, Sun } from 'lucide-react';
import { Card, CardContent, CardHeader, Separator } from '@heroui/react';
import { useTheme } from '../../providers/ThemeProvider';

/** Visible RTL-friendly toggle — HeroUI Switch needs compound slots and renders empty alone. */
const ThemeToggle = ({ checked, onChange, label }) => {
  const id = useId();
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-8 w-14 shrink-0 items-center rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand)] focus-visible:ring-offset-2 ${
        checked
          ? 'border-[var(--color-brand)] bg-[var(--color-brand)]'
          : 'border-default-300 bg-default-200 dark:border-white/20 dark:bg-white/15'
      }`}
    >
      <span
        className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${
          checked ? 'start-0.5 translate-x-0' : 'start-[calc(100%-1.625rem)]'
        }`}
      />
    </button>
  );
};

export const SettingsPage = () => {
  const { isDark, setTheme } = useTheme();
  const [notificationsOn, setNotificationsOn] = useState(true);

  return (
    <div className="mx-auto max-w-2xl animate-fade-in">
      <h1 className="mb-6 text-2xl font-bold text-foreground">تنظیمات</h1>

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
              <ThemeToggle
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
              <ThemeToggle
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
