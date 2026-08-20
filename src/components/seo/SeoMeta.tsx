import { ReactNode } from 'react';
import { Helmet } from 'react-helmet-async';

type SeoMetaProps = {
  title: string;
  description: string;
  path: string;
  noindex?: boolean;
  ogType?: 'website' | 'article';
  imageUrl?: string;
  imageAlt?: string;
  children?: ReactNode;
};

const SITE_URL = import.meta.env.VITE_SITE_URL || window.location.origin;

const resolveAbsoluteUrl = (value: string) => {
  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  if (value.startsWith('/')) {
    return `${SITE_URL}${value}`;
  }

  return `${SITE_URL}/${value}`;
};

const canonicalForPath = (path: string) => {
  if (path === '/') {
    return `${SITE_URL}/`;
  }

  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;
};

export const SeoMeta = ({
  title,
  description,
  path,
  noindex = false,
  ogType = 'website',
  imageUrl,
  imageAlt,
  children,
}: SeoMetaProps) => {
  const canonicalUrl = canonicalForPath(path);
  const absoluteImageUrl = imageUrl ? resolveAbsoluteUrl(imageUrl) : undefined;

  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonicalUrl} />
      <meta name="robots" content={noindex ? 'noindex,follow' : 'index,follow'} />

      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content={ogType} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:site_name" content="ServeTogether" />

      <meta name="twitter:card" content={absoluteImageUrl ? 'summary_large_image' : 'summary'} />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />

      {absoluteImageUrl ? <meta property="og:image" content={absoluteImageUrl} /> : null}
      {absoluteImageUrl ? <meta name="twitter:image" content={absoluteImageUrl} /> : null}
      {imageAlt ? <meta property="og:image:alt" content={imageAlt} /> : null}

      {children}
    </Helmet>
  );
};
