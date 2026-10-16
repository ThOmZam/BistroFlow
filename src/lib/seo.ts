export interface SEOConfig {
  title: string;
  description: string;
  image?: string;
  url?: string;
  type?: string;
  favicon?: string;
  jsonLd?: object;
}

export interface SEOMetadataParams {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
  type?: string;
  favicon?: string;
  restaurantName?: string;
  slogan?: string;
  logoUrl?: string;
  price?: number;
  currency?: string;
  category?: string;
}

/**
 * Dynamically updates document head metadata (title, description, OG tags, Twitter cards, favicon, and JSON-LD).
 */
export function updateMetaTags(config: SEOConfig) {
  if (typeof document === 'undefined') return;

  // 1. Document Title
  if (config.title) {
    document.title = config.title;
  }

  // Helper function to set or create meta tag
  const setMeta = (attrName: 'name' | 'property', attrValue: string, contentValue: string) => {
    if (!contentValue) return;
    let element = document.querySelector(`meta[${attrName}="${attrValue}"]`);
    if (!element) {
      element = document.createElement('meta');
      element.setAttribute(attrName, attrValue);
      document.head.appendChild(element);
    }
    element.setAttribute('content', contentValue);
  };

  // Helper for link tags
  const setLink = (relValue: string, hrefValue: string) => {
    if (!hrefValue) return;
    let element = document.querySelector(`link[rel="${relValue}"]`);
    if (!element) {
      element = document.createElement('link');
      element.setAttribute('rel', relValue);
      document.head.appendChild(element);
    }
    element.setAttribute('href', hrefValue);
  };

  // 2. Standard Meta
  if (config.description) {
    setMeta('name', 'description', config.description);
  }

  // 3. OpenGraph Tags
  setMeta('property', 'og:title', config.title);
  setMeta('property', 'og:description', config.description);
  setMeta('property', 'og:type', config.type || 'website');
  
  const currentUrl = config.url || (typeof window !== 'undefined' ? window.location.href : '');
  if (currentUrl) {
    setMeta('property', 'og:url', currentUrl);
  }
  
  if (config.image) {
    setMeta('property', 'og:image', config.image);
    setMeta('name', 'twitter:image', config.image);
  }

  // 4. Twitter Cards
  setMeta('name', 'twitter:card', 'summary_large_image');
  setMeta('name', 'twitter:title', config.title);
  setMeta('name', 'twitter:description', config.description);

  // 5. Favicon / Logo
  if (config.favicon) {
    setLink('icon', config.favicon);
    setLink('apple-touch-icon', config.favicon);
  }

  // 6. JSON-LD Structured Data
  if (config.jsonLd) {
    let script = document.querySelector('script[type="application/ld+json"]');
    if (!script) {
      script = document.createElement('script');
      script.setAttribute('type', 'application/ld+json');
      document.head.appendChild(script);
    }
    script.textContent = JSON.stringify(config.jsonLd);
  }
}

/**
 * High-level SEO updater for restaurant and menu item metadata
 */
export function updateSEOMetadata(params: SEOMetadataParams) {
  const restName = params.restaurantName || "Q' Sandwich";
  const slogan = params.slogan || "Menú Digital & POS";
  const defaultTitle = `${restName} – ${slogan}`;
  const defaultDesc = `${slogan} | Explora el menú en línea de ${restName}, realiza tus pedidos de forma rápida y disfruta de la mejor experiencia gastronómica.`;

  const title = params.title ? (params.title.includes(restName) ? params.title : `${params.title} | ${restName}`) : defaultTitle;
  const description = params.description || defaultDesc;
  const image = params.image || params.logoUrl;
  const favicon = params.logoUrl || params.favicon;

  const jsonLd = params.price !== undefined ? {
    "@context": "https://schema.org",
    "@type": "MenuItem",
    "name": params.title || "Plato del Menú",
    "description": description,
    "image": image,
    "offers": {
      "@type": "Offer",
      "price": params.price,
      "priceCurrency": params.currency || "USD",
      "availability": "https://schema.org/InStock"
    }
  } : {
    "@context": "https://schema.org",
    "@type": "Restaurant",
    "name": restName,
    "description": slogan,
    "image": params.logoUrl,
    "url": typeof window !== 'undefined' ? window.location.origin : ''
  };

  updateMetaTags({
    title,
    description,
    image,
    url: params.url,
    type: params.price !== undefined ? 'product' : 'website',
    favicon,
    jsonLd
  });
}
