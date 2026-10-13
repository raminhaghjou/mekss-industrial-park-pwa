import { toneForService } from '../../constants/appServices';

const formatBadge = (count) => (count > 99 ? '۹۹+' : Number(count).toLocaleString('fa-IR'));

/**
 * iOS-style app icon: glossy gradient squircle with a white glyph and a short label underneath.
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
      className="group flex min-h-[6.5rem] flex-col items-center gap-2 rounded-2xl px-1 pb-2 pt-2.5 text-center outline-none transition duration-200 ease-out focus-visible:ring-2 focus-visible:ring-[var(--color-brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-95 motion-reduce:transition-none motion-safe:animate-tile-in"
      style={{ animationDelay: `${Math.min(index, 16) * 25}ms` }}
    >
      <span className="relative">
        <span
          className={`relative flex h-[3.6rem] w-[3.6rem] items-center justify-center overflow-hidden rounded-[1.1rem] bg-gradient-to-br text-white shadow-lg ring-1 ring-inset ring-white/25 transition duration-300 ease-out group-hover:-translate-y-1 group-hover:shadow-xl motion-reduce:transform-none ${tone.solid} ${tone.glow}`}
        >
          <span className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/35 to-transparent" aria-hidden="true" />
          <Icon className="relative h-[1.65rem] w-[1.65rem] drop-shadow-sm" strokeWidth={2} aria-hidden="true" />
        </span>
        {hasBadge && (
          <span
            data-testid={`service-badge-${service.id}`}
            className="absolute -end-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold leading-none text-white shadow-md ring-2 ring-white tabular-nums dark:ring-slate-900"
          >
            {formatBadge(badge)}
          </span>
        )}
      </span>
      <span className="line-clamp-2 text-[12px] font-semibold leading-5 tracking-tight text-foreground/90 sm:text-[12.5px]">
        {service.shortTitle || service.title}
      </span>
    </button>
  );
};

export default ServiceTile;
