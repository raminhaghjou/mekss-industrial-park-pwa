import { Clock } from 'lucide-react';
import { pad2, toFaDigits } from '../../utils/jalali';

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);
const MINUTES = Array.from({ length: 12 }, (_, index) => index * 5);

const selectClass =
  'h-full flex-1 appearance-none bg-transparent text-center text-sm font-medium tabular-nums text-foreground outline-none';

/**
 * 24-hour time field with Persian digits; value is `HH:mm` (or '' when empty).
 * @param {{ label?: string, value?: string, onChange: (value: string) => void, compact?: boolean }} props
 */
export const TimeSelect = ({ label, value = '', onChange, compact = false }) => {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value || '');
  const hours = match ? Number(match[1]) : null;
  const minutes = match ? Number(match[2]) : null;
  const minuteOptions = minutes === null || MINUTES.includes(minutes) ? MINUTES : [...MINUTES, minutes].sort((a, b) => a - b);

  const emit = (nextHours, nextMinutes) => {
    onChange(`${pad2(nextHours ?? 8)}:${pad2(nextMinutes ?? 0)}`);
  };

  return (
    <div className="flex flex-col gap-1">
      {label ? <span className="text-xs font-medium text-foreground-600">{label}</span> : null}
      <div
        dir="ltr"
        className={`flex items-center gap-1 rounded-xl bg-background px-3 ring-1 ring-default-200 transition focus-within:ring-2 focus-within:ring-[var(--color-brand)] ${compact ? 'h-10' : 'h-12'}`}
      >
        <select
          aria-label="ساعت"
          className={selectClass}
          value={hours ?? ''}
          onChange={(event) => emit(Number(event.target.value), minutes)}
        >
          {hours === null ? <option value="">--</option> : null}
          {HOURS.map((hour) => (
            <option key={hour} value={hour}>{toFaDigits(pad2(hour))}</option>
          ))}
        </select>
        <span className="text-foreground-400">:</span>
        <select
          aria-label="دقیقه"
          className={selectClass}
          value={minutes ?? ''}
          onChange={(event) => emit(hours, Number(event.target.value))}
        >
          {minutes === null ? <option value="">--</option> : null}
          {minuteOptions.map((minute) => (
            <option key={minute} value={minute}>{toFaDigits(pad2(minute))}</option>
          ))}
        </select>
        <Clock className="h-4 w-4 shrink-0 text-[var(--color-brand)]" />
      </div>
    </div>
  );
};

export default TimeSelect;
