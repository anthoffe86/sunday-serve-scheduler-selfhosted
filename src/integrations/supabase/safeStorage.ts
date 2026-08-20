/**
 * Storage and lock adapters for supabase-js that survive a browser which has
 * blocked storage for the document.
 *
 * Reading `window.localStorage` is not safe: when storage is blocked the
 * property access itself raises a SecurityError. Browsers do this for "block
 * all cookies" settings, some private-browsing modes, and the in-app webviews
 * that email clients use to open links. Because the Supabase client is created
 * at module scope, an unguarded `storage: localStorage` aborts the whole bundle
 * before React mounts and the user gets a blank page — which is exactly the
 * context invite and password-reset links get opened in.
 *
 * The same partitioned-storage restriction also denies `navigator.locks`, which
 * supabase-js uses by default to serialise token refreshes across tabs. That
 * rejection surfaces as a never-resolving `getSession()`, so we swap in an
 * in-process lock for those browsers too.
 *
 * In both degraded cases the session lasts only as long as the page. That is
 * enough for the invite and reset flows and strictly better than a blank screen.
 * Browsers with working storage keep the standard behaviour untouched.
 */

type SupabaseStorage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
};

type LockFn = <R>(name: string, acquireTimeout: number, fn: () => Promise<R>) => Promise<R>;

function createMemoryStorage(): SupabaseStorage {
  const entries = new Map<string, string>();

  return {
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => {
      entries.set(key, value);
    },
    removeItem: (key) => {
      entries.delete(key);
    },
  };
}

/**
 * Probe real storage once. The property access and the write are both capable of
 * throwing — some browsers expose the object but reject `setItem`.
 */
function resolveLocalStorage(): Storage | null {
  const probeKey = '__servetogether_storage_probe__';
  try {
    const candidate = globalThis.localStorage;
    candidate.setItem(probeKey, probeKey);
    candidate.removeItem(probeKey);
    return candidate;
  } catch {
    return null;
  }
}

const realLocalStorage = resolveLocalStorage();

export function createSafeStorage(): SupabaseStorage {
  return realLocalStorage ?? createMemoryStorage();
}

/**
 * Returns `undefined` when the default `navigator.locks` implementation can be
 * trusted, so normal browsers keep supabase-js's cross-tab locking. Storage
 * being blocked is the signal that Web Locks will be denied as well.
 */
export function createSafeLock(): LockFn | undefined {
  if (realLocalStorage) {
    return undefined;
  }

  // Serialise callers through a single promise chain. There is no cross-tab
  // coordination to do here: without storage nothing is shared between tabs.
  let tail: Promise<unknown> = Promise.resolve();

  return <R>(_name: string, _acquireTimeout: number, fn: () => Promise<R>): Promise<R> => {
    const result = tail.then(fn, fn);
    // Swallow rejections on the chain itself so one failure cannot block every
    // later acquisition, while still returning the real result to the caller.
    tail = result.catch(() => undefined);
    return result;
  };
}
