import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";

import appCss from "../styles.css?url";

/**
 * Google Tag Manager — the same container the Shopify store uses, so GA4,
 * Google Ads and Meta tags configured there also see the configurator.
 * Only loaded when the configurator is the top-level page: inside an iframe
 * the host page already runs GTM and receives events via postMessage
 * (see src/lib/track.ts). Set VITE_GTM_ID=off to disable.
 */
const GTM_ID = (import.meta.env.VITE_GTM_ID as string | undefined) ?? "GTM-N4NTN29G";
const GTM_SNIPPET = /^GTM-[A-Z0-9]+$/.test(GTM_ID)
  ? `(function(){try{if(window.self!==window.top)return}catch(e){return}` +
    `window.dataLayer=window.dataLayer||[];window.dataLayer.push({'gtm.start':new Date().getTime(),event:'gtm.js'});` +
    `var f=document.getElementsByTagName('script')[0],j=document.createElement('script');` +
    `j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id=${GTM_ID}';` +
    `f&&f.parentNode?f.parentNode.insertBefore(j,f):document.head.appendChild(j)})();`
  : null;

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "author", content: "Perfect-Bookshelf" },
      { property: "og:site_name", content: "Perfect-Bookshelf" },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://create-yours.perfectbookshelf.com/" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/9cb593c8-bf52-403d-aa61-aaf64d265056/id-preview-6948177c--fbfb0bc5-6f44-4dcc-8e74-85731b03f64c.lovable.app-1778547201659.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/9cb593c8-bf52-403d-aa61-aaf64d265056/id-preview-6948177c--fbfb0bc5-6f44-4dcc-8e74-85731b03f64c.lovable.app-1778547201659.png" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700&family=Cormorant+Garamond:ital,wght@0,400;0,500;1,400;1,500&display=swap" },
      { rel: "icon", type: "image/png", href: "/favicon.png" },
      { rel: "preload", as: "image", href: "/textures/oak.jpg" },
      { rel: "preload", as: "image", href: "/textures/maple.jpg" },
      { rel: "preload", as: "image", href: "/textures/walnut.jpg" },
      { rel: "preload", as: "image", href: "/textures/black.jpg" },
      { rel: "preload", as: "image", href: "/textures/white.jpg" },
    ],
    scripts: [
      ...(GTM_SNIPPET ? [{ children: GTM_SNIPPET }] : []),
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "Perfect-Bookshelf",
          url: "https://create-yours.perfectbookshelf.com/",
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "Perfect-Bookshelf",
          url: "https://create-yours.perfectbookshelf.com/",
        }),
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return <Outlet />;
}
