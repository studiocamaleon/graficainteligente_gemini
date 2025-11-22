export function updateFavicon(logoUrl: string | null) {
  if (!logoUrl) {
    resetFavicon();
    return;
  }

  const existingLink = document.querySelector('link[rel="icon"]') as HTMLLinkElement | null;

  if (existingLink) {
    existingLink.href = logoUrl;
  } else {
    const link = document.createElement('link');
    link.rel = 'icon';
    link.type = 'image/png';
    link.href = logoUrl;
    document.head.appendChild(link);
  }

  updateAppleTouchIcon(logoUrl);
}

export function resetFavicon() {
  const existingLink = document.querySelector('link[rel="icon"]') as HTMLLinkElement | null;

  if (existingLink) {
    existingLink.href = '/vite.svg';
  }

  const appleLink = document.querySelector('link[rel="apple-touch-icon"]') as HTMLLinkElement | null;
  if (appleLink) {
    appleLink.remove();
  }
}

function updateAppleTouchIcon(logoUrl: string) {
  let existingAppleLink = document.querySelector('link[rel="apple-touch-icon"]') as HTMLLinkElement | null;

  if (existingAppleLink) {
    existingAppleLink.href = logoUrl;
  } else {
    const appleLink = document.createElement('link');
    appleLink.rel = 'apple-touch-icon';
    appleLink.href = logoUrl;
    document.head.appendChild(appleLink);
  }
}

export function updateDocumentTitle(companyName: string | null) {
  if (companyName) {
    document.title = `${companyName} - Sistema de Gestión`;
  } else {
    document.title = 'GDI Grafica Digital Inteligente - SaaS';
  }
}
