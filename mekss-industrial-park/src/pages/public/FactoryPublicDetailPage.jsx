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
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
        <Link to="/directory" className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-[#0f4c81] hover:text-[#0c3d68]">
          <ArrowRight className="h-4 w-4" />
          بازگشت به دایرکتوری
        </Link>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-10 w-64 rounded-lg" />
            <Skeleton className="h-48 w-full rounded-2xl" />
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
          <article className="animate-fade-in overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200/80">
            <div className="bg-gradient-to-l from-[#0f4c81] to-[#163a5c] px-6 py-8 text-white sm:px-8">
              <div className="flex items-start gap-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white/15">
                  {factory.logo ? (
                    <img src={factory.logo} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <Building2 className="h-7 w-7" />
                  )}
                </div>
                <div>
                  <h1 className="text-2xl font-bold sm:text-3xl">{factory.name}</h1>
                  <p className="mt-2 text-sm text-white/80">{factory.activityType}</p>
                  <p className="mt-3 flex items-center gap-1.5 text-sm text-white/75">
                    <MapPin className="h-4 w-4" />
                    {[factory.park?.name, factory.park?.city, factory.park?.province].filter(Boolean).join(' · ')}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-6 px-6 py-7 sm:px-8">
              {factory.description && (
                <section>
                  <h2 className="mb-2 text-sm font-semibold text-slate-900">درباره واحد</h2>
                  <p className="text-sm leading-7 text-slate-600">{factory.description}</p>
                </section>
              )}

              <dl className="grid gap-4 sm:grid-cols-2">
                {factory.ceoName && (
                  <div>
                    <dt className="text-xs text-slate-500">مدیرعامل</dt>
                    <dd className="mt-1 text-sm font-medium text-slate-900">{factory.ceoName}</dd>
                  </div>
                )}
                {factory.address && (
                  <div>
                    <dt className="text-xs text-slate-500">آدرس</dt>
                    <dd className="mt-1 text-sm font-medium text-slate-900">{factory.address}</dd>
                  </div>
                )}
                {factory.phoneNumber && (
                  <div>
                    <dt className="text-xs text-slate-500">تلفن</dt>
                    <dd className="mt-1">
                      <a dir="ltr" href={`tel:${factory.phoneNumber}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-[#0f4c81]">
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
                    className="inline-flex h-11 items-center gap-2 rounded-xl bg-slate-100 px-4 text-sm font-medium text-slate-800 hover:bg-slate-200"
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
                    className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#0f4c81] px-4 text-sm font-bold text-white hover:bg-[#0c3d68]"
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
