import { describe, expect, it } from 'vitest';
import {
  iranLocationFitsDatabase,
  iranLocationStats,
  listIranCities,
  listIranProvinces,
  toPersistedLocation,
} from './iranLocations';
import { isoDateFromJalali, isoDateTimeFromJalali } from './jalali';

describe('Iran province/city cascading data', () => {
  it('exposes all 31 provinces from the bundled Iranian locations package', () => {
    const stats = iranLocationStats();
    expect(stats.provinceCount).toBe(31);
    expect(stats.cityCount).toBeGreaterThan(1000);
    expect(listIranProvinces()).toHaveLength(31);
  });

  it('returns only cities of the selected province and clears invalid city pairings', () => {
    const tehranCities = listIranCities('تهران');
    const karajCities = listIranCities('البرز');
    expect(tehranCities.some((city) => city.fa === 'تهران')).toBe(true);
    expect(tehranCities.some((city) => city.fa === 'کرج')).toBe(false);
    expect(karajCities.some((city) => city.fa === 'کرج')).toBe(true);
    expect(iranLocationFitsDatabase('تهران', 'کرج')).toBe(false);
    expect(iranLocationFitsDatabase('البرز', 'کرج')).toBe(true);
  });

  it('builds Persian location + Shamsi-derived date payloads that fit database DTO limits', () => {
    const location = toPersistedLocation('اصفهان', 'کاشان');
    expect(location).toEqual({ province: 'اصفهان', city: 'کاشان' });
    expect(location.province.length).toBeGreaterThanOrEqual(2);
    expect(location.city.length).toBeLessThanOrEqual(80);
    expect(iranLocationFitsDatabase(location.province, location.city)).toBe(true);

    const parkPayload = {
      code: 'PARK-ISF',
      name: 'شهرک صنعتی کاشان',
      ...location,
      address: 'کاشان، شهرک صنعتی',
      phoneNumber: '03112345678',
      guardPhone: '09121234567',
    };
    const advertisementPayload = {
      title: 'فروش تجهیزات',
      category: 'EQUIPMENT',
      ...location,
      content: 'توضیحات آگهی صنعتی',
      contactInfo: { phone: '09121234567' },
      parkId: 'cm12345678901234567890123',
    };
    const invoicePayload = {
      factoryId: 'cm12345678901234567890123',
      description: 'هزینه خدمات ماهانه',
      amount: 1500000,
      taxAmount: 0,
      dueDate: isoDateFromJalali(1405, 1, 15),
    };
    const gatePassPayload = {
      factoryId: 'cm12345678901234567890123',
      cargoType: 'RAW_MATERIALS',
      driverName: 'راننده تست',
      driverNationalId: '0012345678',
      driverPhone: '09121234567',
      vehicleType: 'TRUCK',
      licensePlate: '12ب34567',
      exitDate: isoDateTimeFromJalali(1405, 6, 20, 10, 0),
    };

    expect(parkPayload.province).toBe('اصفهان');
    expect(advertisementPayload.city).toBe('کاشان');
    expect(invoicePayload.dueDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(gatePassPayload.exitDate).toMatch(/Z$/);
  });
});
