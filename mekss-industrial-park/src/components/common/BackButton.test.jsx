import { act } from 'react-dom/test-utils';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BackButton } from './BackButton';

const LocationProbe = () => {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
};

describe('BackButton', () => {
  let container;
  let root;

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    window.history.replaceState(null, '');
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  });

  const render = async (initialEntries, initialIndex, props = {}) => {
    await act(async () => root.render(
      <MemoryRouter initialEntries={initialEntries} initialIndex={initialIndex}>
        <BackButton {...props} />
        <Routes>
          <Route path="*" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    ));
  };

  const click = async () => {
    const button = container.querySelector('[data-testid="back-button"]');
    if (!button) throw new Error('back button not rendered');
    await act(async () => button.dispatchEvent(new MouseEvent('click', { bubbles: true })));
  };

  const currentPath = () => container.querySelector('[data-testid="location"]')?.textContent;

  it('is hidden on the dashboard', async () => {
    await render(['/dashboard'], 0);
    expect(container.querySelector('[data-testid="back-button"]')).toBeNull();
  });

  it('falls back to the dashboard when the tab has no in-app history', async () => {
    await render(['/invoices/abc/pay'], 0);
    await click();
    expect(currentPath()).toBe('/dashboard');
  });

  it('goes back in history when there is a previous in-app entry', async () => {
    // BrowserRouter stores the entry index in history.state.idx; MemoryRouter does not, so mirror it here.
    window.history.replaceState({ idx: 1 }, '');
    await render(['/requests', '/requests/new'], 1);
    expect(currentPath()).toBe('/requests/new');
    await click();
    expect(currentPath()).toBe('/requests');
  });

  it('falls back after a replace-redirect even though the location has a key', async () => {
    window.history.replaceState({ idx: 0, key: 'abc' }, '');
    await render(['/requests', '/invoices'], 1);
    await click();
    expect(currentPath()).toBe('/dashboard');
  });

  it('is hidden on the configured public home route', async () => {
    await render(['/welcome'], 0, { fallback: '/welcome', hiddenOn: ['/welcome'] });
    expect(container.querySelector('[data-testid="back-button"]')).toBeNull();
  });

  it('uses the custom fallback on public pages without history', async () => {
    await render(['/directory/f1'], 0, { fallback: '/welcome', hiddenOn: ['/welcome'] });
    await click();
    expect(currentPath()).toBe('/welcome');
  });
});
