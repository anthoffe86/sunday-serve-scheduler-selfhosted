import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { HelmetProvider } from 'react-helmet-async';
import App from '@/App';

const renderApp = () =>
  render(
    <HelmetProvider>
      <App />
    </HelmetProvider>
  );

const settle = (ms = 500) => new Promise((resolve) => setTimeout(resolve, ms));

const SANDBOX_ROUTES = [
  '/sandbox/dashboard',
  '/sandbox/schedule',
  '/sandbox/availability',
  '/sandbox/swaps',
  '/sandbox/invitations',
  '/sandbox/profile',
  '/sandbox/admin',
  '/sandbox/admin/volunteers',
  '/sandbox/admin/schedule',
  '/sandbox/admin/events',
  '/sandbox/admin/swaps',
  '/sandbox/admin/settings',
];

describe('sandbox entry', () => {
  it('renders on a direct load of /sandbox/dashboard', async () => {
    window.history.pushState({}, '', '/sandbox/dashboard');
    const { container } = renderApp();
    await settle();

    expect(window.location.pathname).toBe('/sandbox/dashboard');
    expect(container.textContent).toContain('Sandbox mode is active');
  });

  it('renders after client-side navigation from the landing page', async () => {
    window.history.pushState({}, '', '/');
    const { container } = renderApp();
    await settle(300);

    const demoLink = screen.getAllByRole('link', { name: /try demo/i })[0];
    expect(demoLink.getAttribute('href')).toBe('/sandbox');

    fireEvent.click(demoLink);
    await settle(800);

    expect(window.location.pathname).toBe('/sandbox/dashboard');
    expect(container.textContent).toContain('Sandbox mode is active');
    expect(container.textContent).toContain('ServeTogether Demo Church');
  });
});

describe('sandbox link containment', () => {
  // Every in-app link rendered on a sandbox page must stay under /sandbox.
  // An absolute path like /admin/volunteers escapes to the live route tree,
  // where ProtectedRoute bounces the demo user to the login screen.
  it.each(SANDBOX_ROUTES)('keeps every link inside the sandbox on %s', async (route) => {
    cleanup();
    window.history.pushState({}, '', route);
    const { container } = renderApp();
    await settle(600);

    // The page itself must not have been bounced out.
    expect(window.location.pathname).toBe(route);
    expect(container.textContent).toContain('Sandbox mode is active');

    const escaping = Array.from(container.querySelectorAll('a[href]'))
      .map((a) => a.getAttribute('href') as string)
      .filter((href) => href.startsWith('/'))
      .filter((href) => href !== '/sandbox' && !href.startsWith('/sandbox/'));

    expect(escaping, `links escaping the sandbox on ${route}`).toEqual([]);
  });
});
