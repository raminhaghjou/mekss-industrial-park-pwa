import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ExternalLink, Search, Store } from 'lucide-react';
import { Skeleton, Alert, AlertContent, AlertTitle, AlertDescription } from '@heroui/react';
import { PublicShell } from '../../components/public/PublicShell';
import { publicApi } from '../../services/api/public.api';
import { getErrorMessage } from '../../utils/apiError';
import { EmptyState } from '../../components/common/EmptyState';

export const ShopsPage = () => {
  const [q, setQ] = useState('');
  const { data = [], isLoading, isError, error } = useQuery({
    queryKey: ['public', 'shops'],
    queryFn: () => publicApi.getShops().then((res) => res.data),
  });

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return data;
    return data.filter((item) =>
      [item.name, item.activityType, item.park?.name, item.park?.city]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term)),
    );
  }, [data, q]);

  return (
    <PublicShell>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="mb-8 max-w-2xl">
          <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">فروشگاه‌های آنلاین واحدها</h1>
          <p className="mt-2 text-sm leading-7 text-slate-600">
            واحدهایی که فروشگاه اینترنتی فعال دارند در این فهرست نمایش داده می‌شوند.
          </p>
        </div>

        <label className="relative mb-6 block max-w-xl">
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="جستجوی فروشگاه..."
            className="h-12 w-full rounded-xl bg-white pe-10 ps-4 text-sm outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-[#0f4c81]"
          />
        </label>

        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-36 rounded-2xl" />)}
          </div>
        ) : isError ? (
          <Alert status="danger">
            <AlertContent>
              <AlertTitle>خطا</AlertTitle>
              <AlertDescription>{getErrorMessage(error, 'دریافت فروشگاه‌ها ناموفق بود.')}</AlertDescription>
            </AlertContent>
          </Alert>
        ) : filtered.length === 0 ? (
          <EmptyState icon={<Store className="h-6 w-6" />} title="فروشگاهی ثبت نشده" description="هنوز فروشگاه آنلاینی در دایرکتوری عمومی نیست." />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((shop) => (
              <a
                key={shop.id}
                href={shop.shopUrl}
                target="_blank"
                rel="noreferrer"
                className="flex flex-col rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/80 transition hover:-translate-y-0.5 hover:shadow-md hover:ring-[#0f4c81]/25"
              >
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl bg-[#0f4c81]/10 text-[#0f4c81]">
                    {shop.logo ? <img src={shop.logo} alt="" className="h-full w-full object-cover" /> : <Store className="h-5 w-5" />}
                  </div>
                  <div>
                    <h2 className="font-bold text-slate-900">{shop.name}</h2>
                    <p className="text-xs text-slate-500">{shop.activityType}</p>
                  </div>
                </div>
                <p className="mb-4 text-xs text-slate-500">
                  {[shop.park?.name, shop.park?.city].filter(Boolean).join(' · ')}
                </p>
                <span className="mt-auto inline-flex items-center gap-1.5 text-sm font-semibold text-[#0f4c81]">
                  بازدید از فروشگاه
                  <ExternalLink className="h-3.5 w-3.5" />
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
