import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * Guards the fix for a blank page on invite and password-reset links: a browser
 * that blocks storage throws on `localStorage` access, and the Supabase client is
 * built at module scope, so an unguarded read aborts the bundle before React
 * mounts. These adapters must degrade instead of throwing.
 *
 * `safeStorage` probes storage once when the module loads, so each case has to
 * arrange the environment first and then import a fresh copy.
 */

const originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');

function restoreLocalStorage() {
  if (originalDescriptor) {
    Object.defineProperty(globalThis, 'localStorage', originalDescriptor);
  }
}

function denyLocalStorage() {
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    get() {
      throw new DOMException('Access is denied for this document.', 'SecurityError');
    },
  });
}

/** Exposes the object but rejects writes, as some browsers do in private mode. */
function denyLocalStorageWrites() {
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: () => null,
      setItem: () => {
        throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
      },
      removeItem: () => undefined,
    },
  });
}

async function loadFreshModule() {
  vi.resetModules();
  return await import('./safeStorage');
}

afterEach(() => {
  restoreLocalStorage();
  vi.resetModules();
});

describe('createSafeStorage', () => {
  it('uses real localStorage when it is available', async () => {
    const { createSafeStorage } = await loadFreshModule();

    const storage = createSafeStorage();
    storage.setItem('token', 'abc');

    expect(storage.getItem('token')).toBe('abc');
    expect(window.localStorage.getItem('token')).toBe('abc');

    window.localStorage.clear();
  });

  it('does not throw when reading localStorage is denied', async () => {
    denyLocalStorage();

    const { createSafeStorage } = await loadFreshModule();

    expect(() => createSafeStorage()).not.toThrow();
  });

  it('falls back to a working in-memory store when storage is denied', async () => {
    denyLocalStorage();
    const { createSafeStorage } = await loadFreshModule();

    const storage = createSafeStorage();
    storage.setItem('token', 'abc');
    expect(storage.getItem('token')).toBe('abc');

    storage.removeItem('token');
    expect(storage.getItem('token')).toBeNull();
  });

  it('falls back when storage exists but rejects writes', async () => {
    denyLocalStorageWrites();
    const { createSafeStorage } = await loadFreshModule();

    const storage = createSafeStorage();
    expect(() => storage.setItem('token', 'abc')).not.toThrow();
    expect(storage.getItem('token')).toBe('abc');
  });
});

describe('createSafeLock', () => {
  it('leaves the default cross-tab lock in place when storage works', async () => {
    const { createSafeLock } = await loadFreshModule();

    expect(createSafeLock()).toBeUndefined();
  });

  it('supplies an in-process lock when storage is denied', async () => {
    denyLocalStorage();
    const { createSafeLock } = await loadFreshModule();

    const lock = createSafeLock();
    expect(lock).toBeTypeOf('function');

    await expect(lock!('name', 0, async () => 'value')).resolves.toBe('value');
  });

  it('serialises callers and keeps working after one of them fails', async () => {
    denyLocalStorage();
    const { createSafeLock } = await loadFreshModule();
    const lock = createSafeLock()!;

    const order: string[] = [];
    const first = lock('name', 0, async () => {
      order.push('first');
      throw new Error('boom');
    });
    const second = lock('name', 0, async () => {
      order.push('second');
      return 'ok';
    });

    await expect(first).rejects.toThrow('boom');
    await expect(second).resolves.toBe('ok');
    expect(order).toEqual(['first', 'second']);
  });
});
