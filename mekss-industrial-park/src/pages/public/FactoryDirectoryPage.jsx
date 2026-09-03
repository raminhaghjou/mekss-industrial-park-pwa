import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search, MapPin, Building2 } from 'lucide-react';
import { Skeleton, Alert, AlertContent, AlertTitle, AlertDescription } from '@heroui/react';
import { PublicShell } from '../../components/public/PublicShell';
import { publicApi } from '../../services/api/public.api';
import { getErrorMessage } from '../../utils/apiError';
import { EmptyState } from '../../components/common/EmptyState';

export const FactoryDirectoryPage = () => {
  const [q, setQ] = useState('');
  const { data = [], isLoading, isError, error } = useQuery({
    queryKey: ['public', 'factories'],
    queryFn: () => publicApi.getFactories().then((res) => res.data),
  });

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return data;
    return data.filter((item) =>
      [item.name, item.activityType, item.parkName, item.city, item.province, item.ceoName]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term)),
    );
  }, [data, q]);

  return (
    <PublicShell>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="mb-8 max-w-2xl">
          <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">دایرکتوری واحدهای صنعتی</h1>
          <p className="mt-2 text-sm leading-7 text-slate-600">
            فهرست عمومی واحدهای فعال شهرک؛ برای مشاهده جزئیات روی هر واحد کلیک کنید.
          </p>
        </div>

        <label className="relative mb-6 block max-w-xl">
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="جستجو بر اساس نام، فعالیت یا شهرک..."
            className="h-12 w-full rounded-xl bg-white pe-10 ps-4 text-sm outline-none ring-1 ring-slate-200 transition focus:ring-2 focus:ring-[#0f4c81]"
          />
        </label>

        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-40 rounded-2xl" />
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
                className="group rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/80 transition hover:-translate-y-0.5 hover:shadow-md hover:ring-[#0f4c81]/30 animate-slide-up"
                style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
              >
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl bg-[#0f4c81]/10 text-[#0f4c81]">
                    {factory.logo ? (
                      <img src={factory.logo} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <Building2 className="h-5 w-5" />
                    )}
                  </div>
                  <span className="rounded-md bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-600">
                    {factory.activityType || 'فعالیت نامشخص'}
                  </span>
                </div>
                <h2 className="text-base font-bold text-slate-900 group-hover:text-[#0f4c81]">{factory.name}</h2>
                <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
                  <MapPin className="h-3.5 w-3.5" />
                  {[factory.parkName, factory.city].filter(Boolean).join(' · ')}
                </p>
                {factory.description && (
                  <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-600">{factory.description}</p>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </PublicShell>
  );
};

export default FactoryDirectoryPage;
