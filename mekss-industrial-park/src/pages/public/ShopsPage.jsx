import { useDeferredValue, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ExternalLink, Search, Store } from 'lucide-react';
import { Skeleton, Alert, AlertContent, AlertTitle, AlertDescription } from '@heroui/react';
import { PublicShell } from '../../components/public/PublicShell';
import { publicApi } from '../../services/api/public.api';
import { getErrorMessage } from '../../utils/apiError';
import { EmptyState } from '../../components/common/EmptyState';
import { semanticFilter } from '../../utils/semanticSearch';

export const ShopsPage = () => {
  const [q, setQ] = useState('');
  const deferredQ = useDeferredValue(q);
  const { data = [], isLoading, isError, error } = useQuery({
    queryKey: ['public', 'shops'],
    queryFn: () => publicApi.getShops().then((res) => res.data),
  });

  const filtered = useMemo(
    () =>
      semanticFilter(data, deferredQ, (item) => [
        item.name,
        item.activityType,
        item.park?.name,
        item.park?.city,
        item.park?.province,
        item.shopUrl,
        item.description,
        'فروشگاه',
        'شاپ',
      ]),
    [data, deferredQ],
  );

  return (
    <PublicShell>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        <div className="mb-8 max-w-2xl animate-slide-up">
          <p className="mb-2 text-sm font-medium text-[var(--color-brand)]">فروشگاه واحدها</p>
          <h1 className="text-2xl font-bold text-[var(--color-ink)] sm:text-[2rem] sm:leading-[1.4]">
            فروشگاه‌های آنلاین
          </h1>
          <p className="mt-3 text-base leading-8 text-[var(--color-muted)]">
            واحدهایی که فروشگاه اینترنتی فعال دارند در این فهرست نمایش داده می‌شوند.
          </p>
        </div>

        <label className="relative mb-8 block max-w-xl animate-slide-up" style={{ animationDelay: '60ms' }}>
          <Search className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-muted)]" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="جستجوی مفهومی: نام، شهرک، فعالیت، شاپ..."
            className="h-12 w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] pe-11 ps-4 text-sm text-[var(--color-ink)] outline-none transition placeholder:text-[var(--color-muted)] focus:border-[var(--color-brand)] focus:ring-2 focus:ring-[var(--color-brand-soft)]"
          />
        </label>

        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-40 rounded-[var(--radius-md)]" />
            ))}
          </div>
        ) : isError ? (
          <Alert status="danger">
            <AlertContent>
              <AlertTitle>خطا</AlertTitle>
              <AlertDescription>{getErrorMessage(error, 'دریافت فروشگاه‌ها ناموفق بود.')}</AlertDescription>
            </AlertContent>
          </Alert>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Store className="h-6 w-6" />}
            title="فروشگاهی ثبت نشده"
            description="هنوز فروشگاه آنلاینی در دایرکتوری عمومی نیست."
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((shop, index) => (
              <a
                key={shop.id}
                href={shop.shopUrl}
                target="_blank"
                rel="noreferrer"
                className="group flex flex-col rounded-[var(--radius-md)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-card)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-elevated)] animate-slide-up"
                style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
              >
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-[var(--radius-md)] bg-[var(--color-brand-soft)] text-[var(--color-brand)]">
                    {shop.logo ? (
                      <img src={shop.logo} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <Store className="h-5 w-5" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <h2 className="truncate font-bold text-[var(--color-ink)] transition group-hover:text-[var(--color-brand)]">
                      {shop.name}
                    </h2>
                    <p className="mt-0.5 text-xs text-[var(--color-muted)]">
                      {shop.activityType || 'فروشگاه آنلاین'}
                    </p>
                  </div>
                </div>
                <p className="mb-4 text-xs leading-6 text-[var(--color-muted)]">
                  {[shop.park?.name, shop.park?.city].filter(Boolean).join(' · ') || 'شهرک ثبت نشده'}
                </p>
                <span className="mt-auto inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--color-brand)]">
                  بازدید از فروشگاه
                  <ExternalLink className="h-3.5 w-3.5 transition group-hover:translate-x-[-2px]" />
                </span>
              </a>
            ))}
          </div>
        )}
      </div>
    </PublicShell>
  );
};

export default ShopsPage;
