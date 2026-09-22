import { requestTypeLabels } from '../../constants/persianLabels';
import {
  STAFF_ACCESS_PRESET_CUSTOM,
  detectStaffAccessPreset,
  staffAccessPresets,
} from '../../constants/staffAccessPresets';

const allRequestTypes = Object.keys(requestTypeLabels);

export const StaffAccessLevelPicker = ({ value = [], onChange, disabled = false }) => {
  const presetId = detectStaffAccessPreset(value);

  const applyPreset = (id) => {
    if (id === STAFF_ACCESS_PRESET_CUSTOM) return;
    const preset = staffAccessPresets.find((item) => item.id === id);
    if (preset) onChange(preset.types);
  };

  const toggleType = (type) => {
    onChange(
      value.includes(type)
        ? value.filter((item) => item !== type)
        : [...value, type],
    );
  };

  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="mb-2 text-xs font-medium text-foreground-600">سطح دسترسی</p>
        <div className="flex flex-wrap gap-2">
          {staffAccessPresets.map((preset) => {
            const selected = presetId === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                disabled={disabled}
                onClick={() => applyPreset(preset.id)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ring-1 ${
                  selected
                    ? 'bg-[var(--color-brand)] text-white ring-[var(--color-brand)]'
                    : 'bg-default-50 text-foreground-600 ring-default-200 hover:ring-[var(--color-brand)]'
                }`}
                title={preset.description}
              >
                {preset.label}
              </button>
            );
          })}
          <button
            type="button"
            disabled={disabled}
            onClick={() => applyPreset(STAFF_ACCESS_PRESET_CUSTOM)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ring-1 ${
              presetId === STAFF_ACCESS_PRESET_CUSTOM
                ? 'bg-[var(--color-brand)] text-white ring-[var(--color-brand)]'
                : 'bg-default-50 text-foreground-600 ring-default-200 hover:ring-[var(--color-brand)]'
            }`}
          >
            سفارشی
          </button>
        </div>
      </div>
      <div>
        <p className="mb-2 text-xs text-foreground-500">انتخاب دقیق مجوز تایید درخواست</p>
        <div className="flex flex-wrap gap-2">
          {allRequestTypes.map((type) => {
            const selected = value.includes(type);
            return (
              <button
                key={type}
                type="button"
                disabled={disabled}
                onClick={() => toggleType(type)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ring-1 ${
                  selected
                    ? 'bg-[var(--color-brand)] text-white ring-[var(--color-brand)]'
                    : 'bg-default-50 text-foreground-600 ring-default-200 hover:ring-[var(--color-brand)]'
                }`}
              >
                {requestTypeLabels[type]}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default StaffAccessLevelPicker;
