import { Card, CardContent, CardHeader } from '@heroui/react';

export const AboutPage = () => {
  return (
    <div className="mx-auto max-w-2xl animate-fade-in">
      <h1 className="mb-6 text-2xl font-bold text-foreground">درباره سامانه</h1>
      
      <Card>
        <CardHeader className="p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 text-xl font-bold text-white">
              M
            </div>
            <div>
              <h2 className="text-lg font-semibold">MEKSS</h2>
              <p className="text-sm text-foreground-500">مدیریت یکپارچه شهرک صنعتی</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <div className="flex flex-col gap-4 text-foreground-600">
            <p>
              سامانه مدیریت یکپارچه شهرک‌های صنعتی (MEKSS) یک پلتفرم جامع برای مدیریت 
              واحدهای صنعتی، برگ‌های خروج، قبض‌ها، درخواست‌ها و اطلاعیه‌ها است.
            </p>
            <p>
              این سامانه با هدف ساده‌سازی فرآیندهای مدیریتی و افزایش بهره‌وری در 
              شهرک‌های صنعتی طراحی و پیاده‌سازی شده است.
            </p>
            <div className="mt-4 rounded-lg bg-primary-50 p-4 dark:bg-primary-950">
              <p className="text-sm text-primary-700 dark:text-primary-300">
                نسخه: 1.0.0
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AboutPage;
