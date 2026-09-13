import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Building2, ExternalLink, Globe, MapPin, Phone } from 'lucide-react';
import { Skeleton, Alert, AlertContent, AlertTitle, AlertDescription, Spinner } from '@heroui/react';
import { PublicShell } from '../../components/public/PublicShell';
import { publicApi } from '../../services/api/public.api';
import { getErrorMessage } from '../../utils/apiError';

export const FactoryPublicDetailPage = () => {
  const { id } = useParams();
  const { data: factory, isLoading, isError, error } = useQuery({
    queryKey: ['public', 'factory', id],
    queryFn: () => publicApi.getFactory(id).then((res) => res.data),
    enabled: Boolean(id),
  });

  return (
    <PublicShell>
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
        <Link
          to="/directory"
          className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-[var(--color-brand)] transition hover:text-[var(--color-brand-hover)]"
        >
          <ArrowRight className="h-4 w-4" />
          بازگشت به دایرکتوری
        </Link>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-10 w-64 rounded-[var(--radius-sm)]" />
            <Skeleton className="h-48 w-full rounded-[var(--radius-lg)]" />
          </div>
        ) : isError ? (
          <Alert status="danger">
            <AlertContent>
              <AlertTitle>خطا</AlertTitle>
              <AlertDescription>{getErrorMessage(error, 'دریافت اطلاعات واحد ناموفق بود.')}</AlertDescription>
            </AlertContent>
          </Alert>
        ) : !factory ? (
          <div className="flex min-h-[200px] items-center justify-center"><Spinner /></div>
        ) : (
          <article className="animate-fade-in overflow-hidden rounded-[var(--radius-lg)] bg-[var(--color-surface)] shadow-[var(--shadow-card)]">
            <div className="bg-[var(--color-brand)] px-6 py-8 text-[var(--color-on-brand)] sm:px-8">
              <div className="flex items-start gap-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-[var(--radius-md)] bg-white/15">
                  {factory.logo ? (
                    <img src={factory.logo} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <Building2 className="h-7 w-7" />
                  )}
                </div>
                <div>
                  <h1 className="text-2xl font-bold sm:text-[2rem] sm:leading-[1.4]">{factory.name}</h1>
                  <p className="mt-2 text-sm text-white/85">{factory.activityType || 'فعالیت ثبت نشده'}</p>
                  <p className="mt-3 flex items-center gap-1.5 text-sm text-white/80">
                    <MapPin className="h-4 w-4 shrink-0" />
                    {[factory.park?.name, factory.park?.city, factory.park?.province].filter(Boolean).join(' · ') || 'موقعیت ثبت نشده'}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-6 px-6 py-7 sm:px-8">
              {factory.description && (
                <section>
                  <h2 className="mb-2 text-sm font-semibold text-[var(--color-ink)]">درباره واحد</h2>
                  <p className="text-sm leading-7 text-[var(--color-muted)]">{factory.description}</p>
                </section>
              )}

              <dl className="grid gap-4 sm:grid-cols-2">
                {factory.ceoName && (
                  <div className="rounded-[var(--radius-sm)] bg-[var(--color-surface-soft)] p-4">
                    <dt className="text-xs text-[var(--color-muted)]">مدیرعامل</dt>
                    <dd className="mt-1 text-sm font-medium text-[var(--color-ink)]">{factory.ceoName}</dd>
                  </div>
                )}
                {factory.address && (
                  <div className="rounded-[var(--radius-sm)] bg-[var(--color-surface-soft)] p-4">
                    <dt className="text-xs text-[var(--color-muted)]">آدرس</dt>
                    <dd className="mt-1 text-sm font-medium text-[var(--color-ink)]">{factory.address}</dd>
                  </div>
                )}
                {factory.phoneNumber && (
                  <div className="rounded-[var(--radius-sm)] bg-[var(--color-surface-soft)] p-4">
                    <dt className="text-xs text-[var(--color-muted)]">تلفن</dt>
                    <dd className="mt-1">
                      <a
                        dir="ltr"
                        href={`tel:${factory.phoneNumber}`}
                        className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--color-brand)]"
                      >
                        <Phone className="h-4 w-4" />
                        {factory.phoneNumber}
                      </a>
                    </dd>
                  </div>
                )}
              </dl>

              <div className="flex flex-wrap gap-3">
                {factory.website && (
                  <a
                    href={factory.website}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-11 items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 text-sm font-medium text-[var(--color-ink)] transition hover:bg-[var(--color-surface-soft)]"
                  >
                    <Globe className="h-4 w-4" />
                    وب‌سایت
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
                {factory.shopUrl && (
                  <a
                    href={factory.shopUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-11 items-center gap-2 rounded-[var(--radius-sm)] bg-[var(--color-brand)] px-4 text-sm font-bold text-[var(--color-on-brand)] transition hover:bg-[var(--color-brand-hover)]"
                  >
                    فروشگاه آنلاین
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>
            </div>
          </article>
        )}
      </div>
    </PublicShell>
  );
};

export default FactoryPublicDetailPage;
