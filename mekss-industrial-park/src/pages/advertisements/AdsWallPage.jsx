import { useDeferredValue, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Search,
  Megaphone,
  Heart,
  MapPin,
  Sparkles,
} from 'lucide-react';
import {
  Button,
  Skeleton,
  Alert,
  AlertContent,
  AlertTitle,
  AlertDescription,
  Chip,
} from '@heroui/react';
import { PublicShell } from '../../components/public/PublicShell';
import { advertisementApi } from '../../services/api/advertisement.api';
import { publicApi } from '../../services/api/public.api';
import { useAuth } from '../../providers/AuthProvider';
import { useNotification } from '../../providers/NotificationProvider';
import { getErrorMessage } from '../../utils/apiError';
import { EmptyState } from '../../components/common/EmptyState';

const viewTabs = [
  { id: 'all', label: 'همه' },
  { id: 'fresh', label: 'تازه‌ترین' },
];

export const AdsWallPage = () => {
  const { user } = useAuth();
  const { showNotification } = useNotification();
  const queryClient = useQueryClient();
  const [view, setView] = useState('all');
  const [category, setCategory] = useState('');
  const [q, setQ] = useState('');
  const deferredQ = useDeferredValue(q);

  const { data: categories = [] } = useQuery({
    queryKey: ['advertisement-categories'],
    queryFn: () => advertisementApi.getCategories().then((res) => res.data),
  });

  const { data: featured = [] } = useQuery({
    queryKey: ['advertisements', 'featured-public'],
    queryFn: () => publicApi.getFeaturedAdvertisements().then((res) => res.data),
  });

  const { data: ads = [], isLoading, isError, error } = useQuery({
    queryKey: ['advertisements', 'public-wall', view, category, deferredQ],
    queryFn: () => advertisementApi.getPublicAdvertisements({
      view,
      category: category || undefined,
      search: deferredQ.trim() || undefined,
    }).then((res) => res.data),
  });

  const { data: favorites = [] } = useQuery({
    queryKey: ['advertisements', 'favorites'],
    queryFn: () => advertisementApi.getFavorites().then((res) => res.data),
    enabled: Boolean(user),
  });

  const favoriteIds = useMemo(() => new Set((favorites || []).map((item) => item.id)), [favorites]);

  const toggleFavorite = useMutation({
    mutationFn: ({ id, favorited }) => (
      favorited
        ? advertisementApi.removeFavorite(id)
        : advertisementApi.addFavorite(id)
    ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['advertisements', 'favorites'] });
    },
    onError: (err) => showNotification(getErrorMessage(err, 'به‌روزرسانی علاقه‌مندی ناموفق بود'), 'error'),
  });

  return (
    <PublicShell>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-2 text-sm font-medium text-[var(--color-brand)]">دیوار آگهی</p>
            <h1 className="text-2xl font-bold text-[var(--color-ink)] sm:text-[2rem]">آگهی‌های عمومی</h1>
            <p className="mt-2 text-sm leading-7 text-[var(--color-muted)]">
              جستجو و مرور آگهی‌های تاییدشده — جدا از «آگهی‌های من».
            </p>
          </div>
          {user ? (
            <Link
              to="/advertisements"
              className="inline-flex h-11 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--color-brand)] px-4 text-sm font-bold text-white"
            >
              آگهی‌های من
            </Link>
          ) : (
            <Link
              to="/login"
              className="inline-flex h-11 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--color-border)] px-4 text-sm font-medium"
            >
              ورود برای علاقه‌مندی
            </Link>
          )}
        </div>

        {featured.length > 0 && (
          <section className="mb-8">
            <div className="mb-3 flex items-center gap-2 text-[var(--color-brand)]">
              <Sparkles className="h-4 w-4" />
              <h2 className="text-sm font-bold">آگهی‌های ویژه</h2>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {featured.map((item) => (
                <article
                  key={item.id}
                  className="min-w-[260px] max-w-xs shrink-0 rounded-[var(--radius-md)] border border-[var(--color-brand)]/20 bg-white p-4 shadow-[var(--shadow-card)]"
                >
                  <p className="font-bold text-[var(--color-ink)]">{item.title}</p>
                  <p className="mt-1 line-clamp-2 text-xs text-[var(--color-muted)]">{item.content}</p>
                  <p className="mt-2 text-[11px] text-[var(--color-muted)]">
                    {[item.category?.label, item.city].filter(Boolean).join(' · ')}
                  </p>
                </article>
              ))}
            </div>
          </section>
        )}

        <div className="mb-4 flex flex-wrap gap-2">
          {viewTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setView(tab.id)}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${
                view === tab.id
                  ? 'bg-[var(--color-brand)] text-white'
                  : 'bg-[var(--color-surface-soft)] text-[var(--color-muted)]'
              }`}
            >
              {tab.label}
            </button>
          ))}
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="h-9 rounded-full border border-[var(--color-border)] bg-white px-3 text-xs"
          >
            <option value="">همه دسته‌ها</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.key}>{cat.label}</option>
            ))}
          </select>
        </div>

        <label className="relative mb-6 block">
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-muted)]" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="جستجو در عنوان و متن آگهی..."
            className="h-11 w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] pe-10 ps-3 text-sm"
          />
        </label>

        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-44 rounded-xl" />)}
          </div>
        ) : isError ? (
          <Alert status="danger">
            <AlertContent>
              <AlertTitle>خطا</AlertTitle>
              <AlertDescription>{getErrorMessage(error, 'دریافت آگهی‌ها ناموفق بود')}</AlertDescription>
            </AlertContent>
          </Alert>
        ) : ads.length === 0 ? (
          <EmptyState icon={<Megaphone className="h-6 w-6" />} title="آگهی‌ای یافت نشد" description="فیلتر یا عبارت جستجو را تغییر دهید." />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {ads.map((ad) => {
              const favorited = favoriteIds.has(ad.id);
              return (
                <article key={ad.id} className="flex flex-col rounded-[var(--radius-md)] bg-white p-4 shadow-[var(--shadow-card)]">
                  {ad.images?.[0] && (
                    <img src={ad.images[0]} alt="" className="mb-3 h-32 w-full rounded-lg object-cover" />
                  )}
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold text-[var(--color-ink)]">{ad.title}</h3>
                    {user && (
                      <Button
                        isIconOnly
                        size="sm"
                        variant="ghost"
                        aria-label={favorited ? 'حذف از علاقه‌مندی' : 'افزودن به علاقه‌مندی'}
                        onPress={() => toggleFavorite.mutate({ id: ad.id, favorited })}
                      >
                        <Heart className={`h-4 w-4 ${favorited ? 'fill-danger-500 text-danger-500' : ''}`} />
                      </Button>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {ad.category?.label && <Chip size="sm" variant="soft">{ad.category.label}</Chip>}
                    {ad.isFeatured && <Chip size="sm" color="warning" variant="soft">ویژه</Chip>}
                  </div>
                  <p className="mt-2 line-clamp-3 text-sm text-[var(--color-muted)]">{ad.content}</p>
                  <p className="mt-2 flex items-center gap-1 text-xs text-[var(--color-muted)]">
                    <MapPin className="h-3.5 w-3.5" />
                    {[ad.province, ad.city, ad.address].filter(Boolean).join(' · ')}
                  </p>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </PublicShell>
  );
};

export default AdsWallPage;
