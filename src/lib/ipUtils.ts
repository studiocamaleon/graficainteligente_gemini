export async function getPublicIP(): Promise<string | null> {
  try {
    const response = await fetch('https://api.ipify.org?format=json', {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      console.warn('Failed to fetch public IP from ipify');
      return null;
    }

    const data = await response.json();
    return data.ip || null;
  } catch (error) {
    console.warn('Error fetching public IP:', error);
    return null;
  }
}

export function validateIPv4(ip: string): boolean {
  const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

  if (!ipv4Regex.test(ip)) {
    return false;
  }

  const parts = ip.split('.');
  return parts.every((part) => {
    const num = parseInt(part, 10);
    return num >= 0 && num <= 255;
  });
}

export function formatIPValidationMessage(ip: string): string {
  if (!ip) {
    return 'La dirección IP es obligatoria';
  }

  if (ip.length < 7) {
    return 'IP incompleta';
  }

  const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

  if (!ipv4Regex.test(ip)) {
    return 'Formato inválido. Debe ser XXX.XXX.XXX.XXX';
  }

  const parts = ip.split('.');
  for (const part of parts) {
    const num = parseInt(part, 10);
    if (num < 0 || num > 255) {
      return 'Cada número debe estar entre 0 y 255';
    }
  }

  return '';
}
