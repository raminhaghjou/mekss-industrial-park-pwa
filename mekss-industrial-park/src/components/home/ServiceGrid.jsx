import { SearchX } from 'lucide-react';
import { groupServices } from '../../constants/appServices';
import { ServiceTile } from './ServiceTile';

const gridClass = 'grid grid-cols-4 gap-x-1 gap-y-1 sm:grid-cols-6 lg:grid-cols-8';

/**
 * Launcher grid. Grouped by default; while searching the matches are shown as one flat list.
 * @param {{ services: object[], badges?: Record<string, number>, onOpen: (service: object) => void, searching?: boolean }} props
 */
export const ServiceGrid = ({ services, badges = {}, onOpen, searching = false }) => {
  if (services.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-3xl border border-dashed border-default-300 px-6 py-10 text-center dark:border-white/15">
        <SearchX className="h-8 w-8 text-foreground-400" aria-hidden="true" />
        <p className="font-semibold text-foreground">خدمتی پیدا نشد</p>
        <p className="text-sm text-foreground-500">کلمه دیگری را امتحان کنید؛ مثلاً «قبض»، «خروج» یا «پیام».</p>
      </div>
    );
  }

  const badgeFor = (service) => (service.badgeKey ? Number(badges[service.badgeKey] || 0) : 0);

  if (searching) {
    return (
      <section aria-label="نتایج جستجو" className="rounded-3xl bg-content1 p-2 ring-1 ring-default-200/70 sm:p-3 dark:ring-white/10">
        <div className={gridClass}>
          {services.map((service, index) => (
            <ServiceTile key={service.id} service={service} badge={badgeFor(service)} onOpen={onOpen} index={index} />
          ))}
        </div>
      </section>
    );
  }

  let tileIndex = 0;
  return (
    <div className="flex flex-col gap-4">
      {groupServices(services).map((group) => (
        <section
          key={group.id}
          aria-labelledby={`service-group-${group.id}`}
          className="rounded-3xl bg-content1 px-2 pb-2 pt-4 ring-1 ring-default-200/70 sm:px-3 dark:ring-white/10"
        >
          <h2 id={`service-group-${group.id}`} className="px-2 pb-1 text-sm font-bold text-foreground">
            {group.title}
          </h2>
          <div className={gridClass}>
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
      ))}
    </div>
  );
};

export default ServiceGrid;
