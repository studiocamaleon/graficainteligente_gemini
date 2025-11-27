export const WHATSAPP_BACKEND_BASE_URL =
  import.meta.env.VITE_WHATSAPP_BACKEND_URL ?? 'https://whatsapp-backend-w6ot.onrender.com';

export interface ConnectionStatus {
  connected: boolean;
  number: string | null;
}

export interface ConnectResponse {
  qr: string;
}

export interface SendMessageResponse {
  success: boolean;
}

export async function connectWhatsApp(companyId: string): Promise<ConnectResponse> {
  const response = await fetch(`${WHATSAPP_BACKEND_BASE_URL}/connect`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ companyId }),
  });

  if (!response.ok) {
    throw new Error(`Error al conectar WhatsApp: ${response.statusText}`);
  }

  return response.json();
}

export async function getConnectionStatus(companyId: string): Promise<ConnectionStatus> {
  const response = await fetch(`${WHATSAPP_BACKEND_BASE_URL}/status/${companyId}`);

  if (!response.ok) {
    throw new Error(`Error al obtener el estado: ${response.statusText}`);
  }

  return response.json();
}

export async function sendMessage(
  companyId: string,
  to: string,
  message: string
): Promise<SendMessageResponse> {
  const response = await fetch(`${WHATSAPP_BACKEND_BASE_URL}/send`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ companyId, to, message }),
  });

  if (!response.ok) {
    throw new Error(`Error al enviar mensaje: ${response.statusText}`);
  }

  return response.json();
}
