import { toneForService } from '../../constants/appServices';

const formatBadge = (count) => (count > 99 ? '۹۹+' : Number(count).toLocaleString('fa-IR'));

/**
 * Super-app style launcher tile: tinted icon square with a short label underneath.
 * @param {{ service: object, badge?: number, onOpen: (service: object) => void, index?: number }} props
 */
export const ServiceTile = ({ service, badge = 0, onOpen, index = 0 }) => {
  const Icon = service.icon;
  const tone = toneForService(service);
  const hasBadge = Number(badge) > 0;

  return (
    <button
      type="button"
      onClick={() => onOpen(service)}
      aria-label={hasBadge ? `${service.title} — ${formatBadge(badge)} مورد جدید` : service.title}
      title={service.description}
      data-testid={`service-tile-${service.id}`}
      className="group flex min-h-[6.25rem] flex-col items-center gap-2 rounded-2xl px-1 pb-2 pt-3 text-center outline-none transition duration-200 ease-out hover:bg-default-100/70 focus-visible:ring-2 focus-visible:ring-[var(--color-brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-95 motion-reduce:transition-none motion-safe:animate-tile-in dark:hover:bg-white/5"
      style={{ animationDelay: `${Math.min(index, 16) * 25}ms` }}
    >
      <span className="relative">
        <span
          className={`flex h-14 w-14 items-center justify-center rounded-[1.15rem] shadow-[0_6px_14px_-8px_rgba(15,23,42,0.35)] ring-1 transition duration-200 ease-out group-hover:-translate-y-0.5 group-hover:shadow-[0_10px_20px_-10px_rgba(15,23,42,0.4)] motion-reduce:transform-none ${tone.soft}`}
        >
          <Icon className="h-[1.6rem] w-[1.6rem]" strokeWidth={1.9} aria-hidden="true" />
        </span>
        {hasBadge && (
          <span
            data-testid={`service-badge-${service.id}`}
            className="absolute -end-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-background tabular-nums"
          >
            {formatBadge(badge)}
          </span>
        )}
      </span>
      <span className="line-clamp-2 text-[12.5px] font-semibold leading-5 text-foreground sm:text-[13px]">
        {service.shortTitle || service.title}
      </span>
    </button>
  );
};

export default ServiceTile;
