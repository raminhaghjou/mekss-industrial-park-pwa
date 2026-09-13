import { useDeferredValue, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search, MapPin, Building2, ChevronLeft } from 'lucide-react';
import { Skeleton, Alert, AlertContent, AlertTitle, AlertDescription } from '@heroui/react';
import { PublicShell } from '../../components/public/PublicShell';
import { publicApi } from '../../services/api/public.api';
import { getErrorMessage } from '../../utils/apiError';
import { EmptyState } from '../../components/common/EmptyState';
import { semanticFilter } from '../../utils/semanticSearch';

export const FactoryDirectoryPage = () => {
  const [q, setQ] = useState('');
  const deferredQ = useDeferredValue(q);
  const { data = [], isLoading, isError, error } = useQuery({
    queryKey: ['public', 'factories'],
    queryFn: () => publicApi.getFactories().then((res) => res.data),
  });

  const filtered = useMemo(
    () =>
      semanticFilter(data, deferredQ, (item) => [
        item.name,
        item.activityType,
        item.parkName,
        item.city,
        item.province,
        item.ceoName,
        item.description,
        item.address,
        'واحد',
        'کارخانه',
      ]),
    [data, deferredQ],
  );

  return (
    <PublicShell>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        <div className="mb-8 max-w-2xl animate-slide-up">
          <p className="mb-2 text-sm font-medium text-[var(--color-brand)]">دایرکتوری عمومی</p>
          <h1 className="text-2xl font-bold text-[var(--color-ink)] sm:text-[2rem] sm:leading-[1.4]">
            واحدهای صنعتی شهرک
          </h1>
          <p className="mt-3 text-base leading-8 text-[var(--color-muted)]">
            فهرست عمومی واحدهای فعال؛ برای مشاهده جزئیات روی هر واحد کلیک کنید.
          </p>
        </div>

        <label className="relative mb-8 block max-w-xl animate-slide-up" style={{ animationDelay: '60ms' }}>
          <Search className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-muted)]" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="جستجوی مفهومی: نام، فعالیت، شهرک، مدیر..."
            className="h-12 w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] pe-11 ps-4 text-sm text-[var(--color-ink)] outline-none transition placeholder:text-[var(--color-muted)] focus:border-[var(--color-brand)] focus:ring-2 focus:ring-[var(--color-brand-soft)]"
          />
        </label>

        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-44 rounded-[var(--radius-md)]" />
            ))}
          </div>
        ) : isError ? (
          <Alert status="danger">
            <AlertContent>
              <AlertTitle>خطا</AlertTitle>
              <AlertDescription>{getErrorMessage(error, 'دریافت دایرکتوری ناموفق بود.')}</AlertDescription>
            </AlertContent>
          </Alert>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Building2 className="h-6 w-6" />}
            title="واحدی یافت نشد"
            description="با تغییر عبارت جستجو دوباره تلاش کنید."
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((factory, index) => (
              <Link
                key={factory.id}
                to={`/directory/${factory.id}`}
                className="group flex flex-col rounded-[var(--radius-md)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-card)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-elevated)] animate-slide-up"
                style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
              >
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-[var(--radius-md)] bg-[var(--color-brand-soft)] text-[var(--color-brand)]">
                    {factory.logo ? (
                      <img src={factory.logo} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <Building2 className="h-5 w-5" />
                    )}
                  </div>
                  <span className="rounded-[var(--radius-sm)] bg-[var(--color-brand-soft)] px-2.5 py-1 text-[11px] font-medium text-[var(--color-brand-soft-fg)]">
                    {factory.activityType || 'فعالیت نامشخص'}
                  </span>
                </div>
                <h2 className="text-base font-bold text-[var(--color-ink)] transition group-hover:text-[var(--color-brand)]">
                  {factory.name}
                </h2>
                <p className="mt-2 flex items-center gap-1.5 text-xs text-[var(--color-muted)]">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  {[factory.parkName, factory.city].filter(Boolean).join(' · ') || 'موقعیت ثبت نشده'}
                </p>
                {factory.description && (
                  <p className="mt-3 line-clamp-2 text-sm leading-6 text-[var(--color-muted)]">
                    {factory.description}
                  </p>
                )}
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[var(--color-brand)]">
                  مشاهده جزئیات
                  <ChevronLeft className="h-4 w-4 transition group-hover:-translate-x-0.5" />
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </PublicShell>
  );
};

export default FactoryDirectoryPage;
