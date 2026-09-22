import { Card, CardContent, CardHeader } from '@heroui/react';
import { Mail, Phone, Globe, MapPin } from 'lucide-react';
import { mekssContact } from '../constants/mekssContact';

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
              <h2 className="text-lg font-semibold">{mekssContact.brandName}</h2>
              <p className="text-sm text-foreground-500">{mekssContact.tagline}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 p-6 text-foreground-600">
          <p>
            سامانه مدیریت یکپارچه شهرک‌های صنعتی (MEKSS) یک پلتفرم جامع برای مدیریت
            واحدهای صنعتی، برگ‌های خروج، قبض‌ها، درخواست‌ها و اطلاعیه‌ها است.
          </p>
          <section className="rounded-xl border border-default-200 p-4">
            <h3 className="mb-3 text-sm font-bold text-foreground">راه‌های ارتباط با مکص</h3>
            <ul className="flex flex-col gap-2 text-sm">
              <li className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-primary" />
                <span dir="ltr">{mekssContact.phone}</span>
                <span className="text-foreground-400">|</span>
                <span dir="ltr">{mekssContact.mobile}</span>
              </li>
              <li className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-primary" />
                <a href={`mailto:${mekssContact.email}`} className="text-primary">{mekssContact.email}</a>
              </li>
              <li className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-primary" />
                <a href={mekssContact.website} target="_blank" rel="noreferrer" className="text-primary">{mekssContact.website}</a>
              </li>
              <li className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>{mekssContact.address}</span>
              </li>
            </ul>
          </section>
          <div className="mt-2 rounded-lg bg-primary-50 p-4 dark:bg-primary-950">
            <p className="text-sm text-primary-700 dark:text-primary-300">نسخه: 1.0.0</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AboutPage;
