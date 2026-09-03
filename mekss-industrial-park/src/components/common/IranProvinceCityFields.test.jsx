import React, { useState } from 'react';
import { act } from 'react-dom/test-utils';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import IranProvinceCityFields from './IranProvinceCityFields';

const Harness = () => {
  const [province, setProvince] = useState('');
  const [city, setCity] = useState('');
  return (
    <div>
      <IranProvinceCityFields
        province={province}
        city={city}
        onProvinceChange={setProvince}
        onCityChange={setCity}
      />
      <span data-testid="province">{province}</span>
      <span data-testid="city">{city}</span>
    </div>
  );
};

describe('IranProvinceCityFields', () => {
  let container;
  let root;

  beforeEach(async () => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root.render(<Harness />);
    });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    document.body.innerHTML = '';
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  });

  it('loads province options and cascades cities for the selected province', async () => {
    const selects = container.querySelectorAll('select');
    expect(selects).toHaveLength(2);
    expect([...selects[0].options].some((option) => option.value === 'تهران')).toBe(true);

    await act(async () => {
      selects[0].value = 'تهران';
      selects[0].dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(container.querySelector('[data-testid="province"]')?.textContent).toBe('تهران');
    expect(container.querySelector('[data-testid="city"]')?.textContent).toBe('');

    const citySelect = container.querySelectorAll('select')[1];
    expect([...citySelect.options].some((option) => option.value === 'تهران')).toBe(true);
    expect([...citySelect.options].some((option) => option.value === 'کرج')).toBe(false);

    await act(async () => {
      citySelect.value = 'تهران';
      citySelect.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(container.querySelector('[data-testid="city"]')?.textContent).toBe('تهران');
  });
});
