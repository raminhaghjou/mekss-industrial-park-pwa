import { SearchX } from 'lucide-react';
import { groupServices, serviceTones } from '../../constants/appServices';
import { ServiceTile } from './ServiceTile';

const cardClass = 'relative isolate overflow-hidden rounded-[1.75rem] bg-white/80 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_18px_40px_-24px_rgba(15,23,42,0.35)] ring-1 ring-black/[0.05] backdrop-blur-xl dark:bg-white/[0.04] dark:ring-white/10';

/**
 * Launcher grid. Grouped into Apple-style category cards by default; while searching the matches are
 * shown as one flat list.
 * @param {{ services: object[], badges?: Record<string, number>, onOpen: (service: object) => void, searching?: boolean }} props
 */
export const ServiceGrid = ({ services, badges = {}, onOpen, searching = false }) => {
  if (services.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-[1.75rem] border border-dashed border-default-300 px-6 py-10 text-center dark:border-white/15">
        <SearchX className="h-8 w-8 text-foreground-400" aria-hidden="true" />
        <p className="font-semibold text-foreground">خدمتی پیدا نشد</p>
        <p className="text-sm text-foreground-500">کلمه دیگری را امتحان کنید؛ مثلاً «قبض»، «خروج» یا «پیام».</p>
      </div>
    );
  }

  const badgeFor = (service) => (service.badgeKey ? Number(badges[service.badgeKey] || 0) : 0);

  if (searching) {
    return (
      <section aria-label="نتایج جستجو" className={`${cardClass} p-3 sm:p-4`}>
        <div className="grid grid-cols-4 gap-1 sm:grid-cols-6 lg:grid-cols-8">
          {services.map((service, index) => (
            <ServiceTile key={service.id} service={service} badge={badgeFor(service)} onOpen={onOpen} index={index} />
          ))}
        </div>
      </section>
    );
  }

  const groups = groupServices(services);
  let tileIndex = 0;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {groups.map((group) => {
        const tone = serviceTones[group.tone] || serviceTones.emerald;
        const GroupIcon = group.icon;
        const pending = group.services.reduce((sum, service) => sum + badgeFor(service), 0);
        const wide = groups.length % 2 === 1 && group === groups[groups.length - 1];
        return (
          <section
            key={group.id}
            aria-labelledby={`service-group-${group.id}`}
            className={`${cardClass} p-3 sm:p-4 ${wide ? 'lg:col-span-2' : ''}`}
          >
            <div className={`pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b ${tone.tint}`} aria-hidden="true" />
            <div
              className={`pointer-events-none absolute -end-10 -top-12 -z-10 h-36 w-36 rounded-full bg-gradient-to-br opacity-20 blur-3xl ${tone.solid}`}
              aria-hidden="true"
            />
            <header className="flex items-center gap-3 px-1 pb-2">
              {GroupIcon ? (
                <span className={`relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-[0.8rem] bg-gradient-to-br text-white shadow-md ${tone.solid} ${tone.glow}`}>
                  <span className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/30 to-transparent" aria-hidden="true" />
                  <GroupIcon className="relative h-[1.1rem] w-[1.1rem]" strokeWidth={2.2} aria-hidden="true" />
                </span>
              ) : null}
              <div className="min-w-0 flex-1">
                <h2 id={`service-group-${group.id}`} className="text-[15px] font-bold tracking-tight text-foreground">
                  {group.title}
                </h2>
                {group.subtitle ? <p className="truncate text-[11px] text-foreground-500">{group.subtitle}</p> : null}
              </div>
              {pending > 0 ? (
                <span className="shrink-0 rounded-full bg-rose-600 px-2.5 py-1 text-[11px] font-bold text-white shadow-sm tabular-nums">
                  {pending.toLocaleString('fa-IR')} مورد
                </span>
              ) : (
                <span className={`shrink-0 rounded-full bg-white/70 px-2.5 py-1 text-[11px] font-semibold ring-1 ring-black/[0.04] tabular-nums dark:bg-white/10 dark:ring-white/10 ${tone.text}`}>
                  {group.services.length.toLocaleString('fa-IR')} خدمت
                </span>
              )}
            </header>
            <div className={`grid grid-cols-4 gap-1 sm:grid-cols-6 ${wide ? 'lg:grid-cols-8' : 'lg:grid-cols-4 xl:grid-cols-5'}`}>
              {group.services.map((service) => {
                tileIndex += 1;
                return (
                  <ServiceTile
                    key={service.id}
                    service={service}
                    badge={badgeFor(service)}
                    onOpen={onOpen}
                    index={tileIndex}
                  />
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
};

export default ServiceGrid;
