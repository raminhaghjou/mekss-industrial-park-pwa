import { useEffect, useId, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  calendarCells,
  formatJalaliDate,
  isoDateFromJalali,
  isoDateTimeFromJalali,
  JALALI_MONTHS,
  JALALI_WEEKDAYS,
  jalaliFromIsoDate,
  pad2,
  partsFromIsoValue,
  shiftJalaliMonth,
  toFaDigits,
  todayIsoDate,
} from '../../utils/jalali';

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);
const MINUTES = Array.from({ length: 12 }, (_, index) => index * 5);

const selectClass =
  'h-10 rounded-lg bg-slate-50 px-2 text-sm text-slate-800 outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-[#0f4c81]';

/**
 * @param {{
 *   id?: string,
 *   label?: string,
 *   value?: string,
 *   onChange: (value: string) => void,
 *   required?: boolean,
 *   includeTime?: boolean,
 *   placeholder?: string,
 * }} props
 */
const JalaliDatePicker = ({
  id,
  label,
  value = '',
  onChange,
  required = false,
  includeTime = false,
  placeholder = 'انتخاب تاریخ',
}) => {
  const generatedId = useId();
  const fieldId = id || generatedId;
  const rootRef = useRef(null);
  const [open, setOpen] = useState(false);

  const selected = includeTime ? partsFromIsoValue(value) : (() => {
    const jalali = jalaliFromIsoDate(value);
    return jalali ? { ...jalali, hours: 8, minutes: 0 } : null;
  })();
  const today = jalaliFromIsoDate(todayIsoDate());
  const initialView = selected || (today ? { ...today, hours: 8, minutes: 0 } : { jy: 1404, jm: 1, jd: 1, hours: 8, minutes: 0 });
  const [view, setView] = useState({ jy: initialView.jy, jm: initialView.jm });
  const [time, setTime] = useState({
    hours: selected?.hours ?? 8,
    minutes: selected?.minutes ?? 0,
  });

  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    const onKey = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const emitDay = (jy, jm, jd) => {
    if (includeTime) {
      onChange(isoDateTimeFromJalali(jy, jm, jd, time.hours, time.minutes));
      return;
    }
    onChange(isoDateFromJalali(jy, jm, jd));
    setOpen(false);
  };

  const display = includeTime && value
    ? `${formatJalaliDate(value)}  ${toFaDigits(`${pad2(time.hours)}:${pad2(time.minutes)}`)}`
    : formatJalaliDate(value);

  const cells = calendarCells(view.jy, view.jm);
  const minuteOptions = MINUTES.includes(time.minutes) ? MINUTES : [...MINUTES, time.minutes].sort((a, b) => a - b);

  return (
    <div ref={rootRef} className="relative flex flex-col gap-1">
      {label ? (
        <label htmlFor={fieldId} className="text-xs font-medium text-foreground-600">
          {label}
        </label>
      ) : null}
      <input
        id={fieldId}
        value={value || ''}
        required={required}
        tabIndex={-1}
        onChange={(event) => onChange(event.target.value)}
        className="sr-only"
        autoComplete="off"
      />
      <button
        type="button"
        onClick={() => {
          setView({ jy: initialView.jy, jm: initialView.jm });
          if (selected) setTime({ hours: selected.hours, minutes: selected.minutes });
          setOpen((current) => !current);
        }}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="flex h-12 w-full items-center justify-between gap-3 rounded-xl bg-background px-3 text-right text-sm ring-1 ring-default-200 transition focus:ring-2 focus:ring-[#0f4c81]"
      >
        <span className={display ? 'font-medium text-foreground' : 'text-foreground-400'}>
          {display || placeholder}
        </span>
        <CalendarDays className="h-4 w-4 shrink-0 text-[#0f4c81]" />
      </button>

      {open ? (
        <>
          <div className="fixed inset-0 z-40 bg-black/35 lg:hidden" />
          <div
            role="dialog"
            aria-label="تقویم شمسی"
            className="fixed inset-x-0 bottom-0 z-50 animate-slide-up rounded-t-2xl bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_-12px_40px_rgba(0,0,0,0.18)] lg:absolute lg:inset-auto lg:top-full lg:z-30 lg:mt-2 lg:w-[20.5rem] lg:rounded-2xl lg:p-4 lg:shadow-xl lg:ring-1 lg:ring-slate-200"
          >
            <div className="mb-3 flex items-center justify-between">
              <button
                type="button"
                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100"
                onClick={() => setView((current) => shiftJalaliMonth(current.jy, current.jm, -1))}
                aria-label="ماه قبل"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              <div className="text-center">
                <p className="text-sm font-bold text-slate-900">{JALALI_MONTHS[view.jm - 1]}</p>
                <p className="text-xs text-slate-500">{toFaDigits(view.jy)}</p>
              </div>
              <button
                type="button"
                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100"
                onClick={() => setView((current) => shiftJalaliMonth(current.jy, current.jm, 1))}
                aria-label="ماه بعد"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            </div>

            <div className="mb-1 grid grid-cols-7 text-center text-[11px] font-medium text-slate-400">
              {JALALI_WEEKDAYS.map((day) => (
                <span key={day} className="py-1">{day}</span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-0.5">
              {cells.map((day, index) => {
                if (!day) return <span key={`empty-${index}`} />;
                const iso = isoDateFromJalali(view.jy, view.jm, day);
                const isSelected = selected && selected.jy === view.jy && selected.jm === view.jm && selected.jd === day;
                const isToday = today && today.jy === view.jy && today.jm === view.jm && today.jd === day;
                return (
                  <button
                    key={iso}
                    type="button"
                    onClick={() => emitDay(view.jy, view.jm, day)}
                    className={`h-10 rounded-lg text-sm transition ${
                      isSelected
                        ? 'bg-[#0f4c81] font-bold text-white'
                        : isToday
                          ? 'font-semibold text-[#0f4c81] ring-1 ring-[#0f4c81]/40'
                          : 'text-slate-800 hover:bg-slate-100'
                    }`}
                  >
                    {toFaDigits(day)}
                  </button>
                );
              })}
            </div>

            {includeTime ? (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-1 text-xs text-slate-500">
                  ساعت
                  <select
                    className={selectClass}
                    value={time.hours}
                    onChange={(event) => {
                      const hours = Number(event.target.value);
                      setTime((current) => {
                        const next = { ...current, hours };
                        if (selected) onChange(isoDateTimeFromJalali(selected.jy, selected.jm, selected.jd, hours, next.minutes));
                        return next;
                      });
                    }}
                  >
                    {HOURS.map((hour) => (
                      <option key={hour} value={hour}>{toFaDigits(pad2(hour))}</option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-xs text-slate-500">
                  دقیقه
                  <select
                    className={selectClass}
                    value={time.minutes}
                    onChange={(event) => {
                      const minutes = Number(event.target.value);
                      setTime((current) => {
                        const next = { ...current, minutes };
                        if (selected) onChange(isoDateTimeFromJalali(selected.jy, selected.jm, selected.jd, next.hours, minutes));
                        return next;
                      });
                    }}
                  >
                    {minuteOptions.map((minute) => (
                      <option key={minute} value={minute}>{toFaDigits(pad2(minute))}</option>
                    ))}
                  </select>
                </label>
              </div>
            ) : null}

            <div className="mt-3 flex items-center justify-between gap-2 text-sm">
              <button
                type="button"
                className="rounded-lg px-3 py-1.5 font-medium text-[#0f4c81] hover:bg-slate-100"
                onClick={() => {
                  if (!today) return;
                  setView({ jy: today.jy, jm: today.jm });
                  emitDay(today.jy, today.jm, today.jd);
                }}
              >
                امروز
              </button>
              {!required ? (
                <button
                  type="button"
                  className="rounded-lg px-3 py-1.5 text-slate-500 hover:bg-slate-100"
                  onClick={() => {
                    onChange('');
                    setOpen(false);
                  }}
                >
                  پاک کردن
                </button>
              ) : (
                <button
                  type="button"
                  className="rounded-lg px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-100 lg:hidden"
                  onClick={() => setOpen(false)}
                >
                  تأیید
                </button>
              )}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
};

export default JalaliDatePicker;
