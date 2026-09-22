import { requestTypeLabels } from './persianLabels';

export const STAFF_ACCESS_PRESET_CUSTOM = 'CUSTOM';

/** Named bundles for factory employee «سطح دسترسی» (maps to canApproveRequestTypes). */
export const staffAccessPresets = [
  {
    id: 'FULL',
    label: 'کامل',
    description: 'همه انواع درخواست',
    types: Object.keys(requestTypeLabels),
  },
  {
    id: 'LIMITED',
    label: 'محدود',
    description: 'مرخصی، ماموریت و درخواست‌های روزمره',
    types: ['DAILY_LEAVE', 'HOURLY_LEAVE', 'MISSION', 'APPOINTMENT', 'SERVICE_ORDER', 'OTHER'],
  },
  {
    id: 'LEAVE_ONLY',
    label: 'فقط مرخصی',
    description: 'تایید مرخصی روزانه و ساعتی',
    types: ['DAILY_LEAVE', 'HOURLY_LEAVE'],
  },
];

export const detectStaffAccessPreset = (types = []) => {
  const sorted = [...types].sort().join(',');
  const match = staffAccessPresets.find(
    (preset) => [...preset.types].sort().join(',') === sorted,
  );
  return match?.id || STAFF_ACCESS_PRESET_CUSTOM;
};
