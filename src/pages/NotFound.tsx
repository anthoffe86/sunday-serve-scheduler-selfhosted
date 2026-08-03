import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Helmet } from 'react-helmet-async';

const SITE_URL = import.meta.env.VITE_SITE_URL || window.location.origin;

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    // Recover from accidentally double-slashed paths coming from external links
    // e.g. "//respond-invitation". Some environments will briefly render NotFound
    // before other normalizers run.
    if (location.pathname.includes("//")) {
      const normalizedPathname = location.pathname.replace(/\/{2,}/g, "/");
      const target = `${normalizedPathname}${location.search}${location.hash}`;
      window.history.replaceState(null, "", target);
      // Force re-render on the corrected URL
      window.location.replace(target);
      return;
    }
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted">
      <Helmet>
        <title>Page Not Found | ServeTogether</title>
        <meta
          name="description"
          content="The page you were looking for could not be found."
        />
        <meta name="robots" content="noindex,follow" />
        <link rel="canonical" href={`${SITE_URL}/404`} />
      </Helmet>

      <div className="text-center">
        <h1 className="mb-4 text-4xl font-bold">404</h1>
        <p className="mb-4 text-xl text-muted-foreground">Oops! Page not found</p>
        <a href="/" className="text-primary underline hover:text-primary/90">
          Return to Home
        </a>
      </div>
    </div>
  );
};

export default NotFound;
