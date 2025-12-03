import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ExtractionResult {
  success: boolean;
  numeroFactura?: string;
  error?: string;
}

/**
 * Extrae el número de factura de un PDF de AFIP argentino.
 * Busca patrones como:
 * - "Punto de Venta: XXXXX Comp. Nro: XXXXXXXX"
 * - "00002-00000300"
 * - Variantes comunes de facturas AFIP
 */
function extractFacturaNumber(text: string): string | null {
  // Normalizar el texto
  const normalizedText = text
    .replace(/\s+/g, ' ')
    .replace(/\n/g, ' ')
    .trim();

  console.log('[Extract] Texto normalizado (primeros 500 chars):', normalizedText.substring(0, 500));

  // Patrón 1: "Punto de Venta: 00002 Comp. Nro: 00000300"
  const patron1 = /Punto\s+de\s+Venta\s*:\s*(\d{5})\s+(?:Comp\.|Comprobante)\s+(?:Nro|N[°º])\s*:\s*(\d{8})/i;
  const match1 = normalizedText.match(patron1);
  if (match1) {
    const puntoVenta = match1[1];
    const numero = match1[2];
    const facturaNum = `${puntoVenta}-${numero}`;
    console.log('[Extract] ✅ Encontrado con patrón 1:', facturaNum);
    return facturaNum;
  }

  // Patrón 2: Formato directo "00002-00000300"
  const patron2 = /(\d{5})-(\d{8})/;
  const match2 = normalizedText.match(patron2);
  if (match2) {
    const facturaNum = match2[0];
    console.log('[Extract] ✅ Encontrado con patrón 2:', facturaNum);
    return facturaNum;
  }

  // Patrón 3: "Nro de Comprobante: 00002-00000300" o variantes
  const patron3 = /(?:Nro|N[°º]|Número)\s+(?:de\s+)?Comprobante\s*:\s*(\d{5})-(\d{8})/i;
  const match3 = normalizedText.match(patron3);
  if (match3) {
    const facturaNum = `${match3[1]}-${match3[2]}`;
    console.log('[Extract] ✅ Encontrado con patrón 3:', facturaNum);
    return facturaNum;
  }

  // Patrón 4: "Factura Nro: 00002-00000300" o variantes
  const patron4 = /Factura\s+(?:Nro|N[°º]|Número)\s*:\s*(\d{5})-(\d{8})/i;
  const match4 = normalizedText.match(patron4);
  if (match4) {
    const facturaNum = `${match4[1]}-${match4[2]}`;
    console.log('[Extract] ✅ Encontrado con patrón 4:', facturaNum);
    return facturaNum;
  }

  // Patrón 5: Buscar cualquier secuencia XXXXX espacio XXXXXXXX
  const patron5 = /(\d{5})\s+(\d{8})/;
  const match5 = normalizedText.match(patron5);
  if (match5) {
    const facturaNum = `${match5[1]}-${match5[2]}`;
    console.log('[Extract] ✅ Encontrado con patrón 5:', facturaNum);
    return facturaNum;
  }

  console.log('[Extract] ❌ No se pudo encontrar número de factura');
  return null;
}

/**
 * Extrae texto de un PDF usando pdf-parse
 */
async function extractTextFromPDF(pdfBuffer: Uint8Array): Promise<string> {
  try {
    // Importar pdf-parse dinámicamente
    const pdfParse = await import('npm:pdf-parse@1.1.1');

    console.log('[Extract] Procesando PDF con pdf-parse...');

    const data = await pdfParse.default(pdfBuffer);

    console.log('[Extract] ✅ PDF procesado. Páginas:', data.numpages);
    console.log('[Extract] ✅ Caracteres extraídos:', data.text.length);

    return data.text;
  } catch (error: any) {
    console.error('[Extract] ❌ Error extrayendo texto del PDF:', error);
    throw new Error(`Error procesando PDF: ${error.message}`);
  }
}

Deno.serve(async (req: Request) => {
  // Manejar OPTIONS para CORS
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  // Solo aceptar POST
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({
        success: false,
        error: "Método no permitido. Use POST."
      }),
      {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  try {
    console.log('[Extract] Nueva solicitud de extracción de número de factura');

    // Leer el PDF desde FormData
    const formData = await req.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
      console.log('[Extract] ❌ No se recibió archivo válido');
      return new Response(
        JSON.stringify({
          success: false,
          error: "No se recibió un archivo PDF válido"
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log('[Extract] Archivo recibido:', {
      name: file.name,
      size: file.size,
      type: file.type
    });

    // Validar que sea PDF
    if (file.type !== 'application/pdf') {
      console.log('[Extract] ❌ Archivo no es PDF');
      return new Response(
        JSON.stringify({
          success: false,
          error: "El archivo debe ser un PDF"
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Validar tamaño (máximo 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      console.log('[Extract] ❌ Archivo muy grande');
      return new Response(
        JSON.stringify({
          success: false,
          error: "El archivo excede el tamaño máximo de 10MB"
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Convertir archivo a buffer
    const arrayBuffer = await file.arrayBuffer();
    const pdfBuffer = new Uint8Array(arrayBuffer);

    console.log('[Extract] PDF cargado en buffer, tamaño:', pdfBuffer.length);

    // Extraer texto del PDF
    const texto = await extractTextFromPDF(pdfBuffer);

    // Buscar número de factura en el texto
    const numeroFactura = extractFacturaNumber(texto);

    if (numeroFactura) {
      console.log('[Extract] ✅ Número de factura extraído exitosamente:', numeroFactura);

      const result: ExtractionResult = {
        success: true,
        numeroFactura: numeroFactura
      };

      return new Response(
        JSON.stringify(result),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    } else {
      console.log('[Extract] ⚠️ No se pudo encontrar el número de factura en el PDF');

      const result: ExtractionResult = {
        success: false,
        error: "No se pudo detectar el número de factura en el PDF"
      };

      return new Response(
        JSON.stringify(result),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

  } catch (error: any) {
    console.error('[Extract] ❌ Error general:', error);

    const result: ExtractionResult = {
      success: false,
      error: error.message || "Error interno al procesar el PDF"
    };

    return new Response(
      JSON.stringify(result),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});