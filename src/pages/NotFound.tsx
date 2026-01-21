import { useLocation } from "react-router-dom";
import { useEffect } from "react";

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
