import { ChevronLeft } from 'lucide-react';
import { toneForService } from '../../constants/appServices';

const formatCount = (count) => Number(count).toLocaleString('fa-IR');

/**
 * Large shortcut cards for the two or three tasks a role does most.
 * @param {{ services: object[], badges?: Record<string, number>, onOpen: (service: object) => void }} props
 */
export const FeaturedServices = ({ services, badges = {}, onOpen }) => {
  if (services.length === 0) return null;
  const columns = services.length >= 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2';

  return (
    <section aria-label="پرکاربردها" className={`grid grid-cols-2 gap-3 ${columns}`}>
      {services.map((service, index) => {
        const Icon = service.icon;
        const tone = toneForService(service);
        const count = service.badgeKey ? Number(badges[service.badgeKey] || 0) : 0;
        const wide = services.length === 3 && index === 0;
        return (
          <button
            key={service.id}
            type="button"
            onClick={() => onOpen(service)}
            data-testid={`featured-${service.id}`}
            className={`group relative isolate flex min-h-[7.5rem] flex-col justify-between overflow-hidden rounded-3xl bg-gradient-to-br p-4 text-start text-white shadow-[0_14px_30px_-18px_rgba(15,23,42,0.65)] outline-none transition duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_20px_36px_-18px_rgba(15,23,42,0.7)] focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-brand)] active:scale-[0.98] motion-reduce:transform-none motion-reduce:transition-none ${tone.solid} ${wide ? 'col-span-2 sm:col-span-1' : ''}`}
          >
            <Icon
              className="pointer-events-none absolute -bottom-5 -start-4 -z-10 h-28 w-28 text-white/15 transition duration-300 ease-out group-hover:scale-110 motion-reduce:transform-none"
              strokeWidth={1.5}
              aria-hidden="true"
            />
            <div className="flex items-start justify-between gap-2">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/20 ring-1 ring-white/25 backdrop-blur-sm">
                <Icon className="h-6 w-6" strokeWidth={2} aria-hidden="true" />
              </span>
              {count > 0 && (
                <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-slate-900 tabular-nums">
                  {formatCount(count)} مورد
                </span>
              )}
            </div>
            <div className="mt-3 flex items-end justify-between gap-2">
              <div className="min-w-0">
                <p className="text-base font-bold leading-6">{service.title}</p>
                <p className="mt-0.5 line-clamp-1 text-xs text-white/85">{service.description}</p>
              </div>
              <ChevronLeft className="h-5 w-5 shrink-0 text-white/80 transition group-hover:-translate-x-0.5 motion-reduce:transform-none" aria-hidden="true" />
            </div>
          </button>
        );
      })}
    </section>
  );
};

export default FeaturedServices;
