const SANDBOX_PATH_PREFIX = '/sandbox';

export function isSandboxMode(pathname?: string): boolean {
  const currentPath = pathname ?? (typeof window !== 'undefined' ? window.location.pathname : '');
  return currentPath === SANDBOX_PATH_PREFIX || currentPath.startsWith(`${SANDBOX_PATH_PREFIX}/`);
}

export function withSandboxPath(path: string): string {
  if (!isSandboxMode()) {
    return path;
  }

  if (path.startsWith(SANDBOX_PATH_PREFIX)) {
    return path;
  }

  if (path === '/') {
    return SANDBOX_PATH_PREFIX;
  }

  return `${SANDBOX_PATH_PREFIX}${path.startsWith('/') ? '' : '/'}${path}`;
}

export const SANDBOX_ROUTE_PREFIX = SANDBOX_PATH_PREFIX;
