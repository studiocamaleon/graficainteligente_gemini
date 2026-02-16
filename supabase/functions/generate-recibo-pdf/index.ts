import { createClient } from 'jsr:@supabase/supabase-js@2';
import { PDFDocument, StandardFonts, rgb } from 'npm:pdf-lib@1.17.1';

type GenerateBody = {
  recibo_id?: string;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey, X-Trigger-Secret',
};

function formatMoney(value: number): string {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(value);
}

function formatDate(value: string | Date): string {
  // Importante: Supabase/Edge suele correr en UTC.
  // - Para columnas `date` (ej: '2026-02-16') evitamos parsear con Date() para no corrernos de día.
  // - Para timestamptz, formateamos en la zona horaria de Argentina.
  const AR_TZ = 'America/Argentina/Buenos_Aires';

  if (typeof value === 'string') {
    const s = value.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      const [yyyy, mm, dd] = s.split('-');
      return `${dd}/${mm}/${yyyy}`;
    }
  }

  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '-';
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: AR_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

async function tryFetchImageBytes(url: string): Promise<{ bytes: Uint8Array; contentType: string } | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const contentType = res.headers.get('content-type') ?? '';
    const ab = await res.arrayBuffer();
    return { bytes: new Uint8Array(ab), contentType };
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ success: false, error: 'Método no permitido' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = (await req.json()) as GenerateBody;
    const reciboId = body.recibo_id;
    if (!reciboId) {
      return new Response(JSON.stringify({ success: false, error: 'Falta recibo_id' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Auth:
    // - A) Usuario logueado (JWT) de la misma empresa del recibo
    // - B) Caller interno opcional via trigger secret (compatibilidad / jobs)
    const triggerSecret = Deno.env.get('TRIGGER_SECRET_TOKEN') ?? '';
    const providedSecret = req.headers.get('X-Trigger-Secret') ?? '';
    const isInternalCall = Boolean(triggerSecret && providedSecret && providedSecret === triggerSecret);

    if (!isInternalCall) {
      const authHeader = req.headers.get('Authorization');
      if (!authHeader?.startsWith('Bearer ')) {
        return new Response(JSON.stringify({ success: false, error: 'No autorizado' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const supabaseAuth = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });

      const {
        data: { user },
        error: authError,
      } = await supabaseAuth.auth.getUser();

      if (authError || !user) {
        return new Response(JSON.stringify({ success: false, error: 'Token inválido o expirado' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Traer recibo mínimo para validar tenant antes de generar el PDF
      const { data: reciboMin, error: reciboMinError } = await supabaseAdmin
        .from('recibos_pagos')
        .select('company_id')
        .eq('id', reciboId)
        .maybeSingle();

      if (reciboMinError || !reciboMin?.company_id) {
        return new Response(JSON.stringify({ success: false, error: 'Recibo no encontrado' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: profile, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .maybeSingle();

      if (profileError || !profile?.company_id) {
        return new Response(JSON.stringify({ success: false, error: 'No se pudo validar la empresa del usuario' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (profile.company_id !== reciboMin.company_id) {
        return new Response(JSON.stringify({ success: false, error: 'No autorizado para esta empresa' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const { data: recibo, error: reciboError } = await supabaseAdmin
      .from('recibos_pagos')
      .select(
        `
        id,
        company_id,
        cliente_id,
        orden_trabajo_id,
        orden_copiado_id,
        numero_recibo,
        token_corto,
        fecha_emision,
        fecha_pago,
        monto,
        metodo_pago,
        medio_cobro_id,
        referencia_pago,
        notas,
        pdf_storage_path,
        companies:company_id(name, logo_url),
        clients:cliente_id(nombre_fantasia, razon_social, tipo_documento, numero_documento, whatsapp)
      `
      )
      .eq('id', reciboId)
      .maybeSingle();

    if (reciboError || !recibo) {
      return new Response(JSON.stringify({ success: false, error: 'Recibo no encontrado' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // No regenerar si ya existe PDF.
    if (recibo.pdf_storage_path) {
      return new Response(JSON.stringify({ success: true, message: 'PDF ya generado', pdf_storage_path: recibo.pdf_storage_path }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let ordenNumero: string | null = null;
    if (recibo.orden_trabajo_id) {
      const { data: ot } = await supabaseAdmin.from('ordenes_trabajo').select('numero_orden').eq('id', recibo.orden_trabajo_id).maybeSingle();
      ordenNumero = ot?.numero_orden ?? null;
    } else if (recibo.orden_copiado_id) {
      const { data: cco } = await supabaseAdmin
        .from('centro_copiado_ordenes')
        .select('numero_orden')
        .eq('id', recibo.orden_copiado_id)
        .maybeSingle();
      ordenNumero = cco?.numero_orden ?? null;
    }

    let medioCobroNombre: string | null = null;
    if (recibo.medio_cobro_id) {
      const { data: mc } = await supabaseAdmin.from('medios_cobro').select('nombre').eq('id', recibo.medio_cobro_id).maybeSingle();
      medioCobroNombre = mc?.nombre ?? null;
    }

    const companyName = (recibo as any).companies?.name ?? 'Empresa';
    const companyLogoUrl = (recibo as any).companies?.logo_url ?? null;
    const client = (recibo as any).clients;
    const clientName = client?.nombre_fantasia || client?.razon_social || 'Cliente';

    const pdf = await PDFDocument.create();
    const page = pdf.addPage([595.28, 841.89]); // A4 (pt)
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

    const margin = 48;
    let y = 841.89 - margin;

    // Logo (si existe)
    if (companyLogoUrl) {
      const img = await tryFetchImageBytes(companyLogoUrl);
      if (img) {
        try {
          const embedded =
            img.contentType.includes('png') ? await pdf.embedPng(img.bytes) : await pdf.embedJpg(img.bytes);
          const maxW = 140;
          const maxH = 50;
          const scale = Math.min(maxW / embedded.width, maxH / embedded.height, 1);
          const w = embedded.width * scale;
          const h = embedded.height * scale;
          page.drawImage(embedded, { x: margin, y: y - h, width: w, height: h });
        } catch {
          // ignorar logo si falla
        }
      }
    }

    // Header
    page.drawText('RECIBO', { x: 420, y: y - 14, size: 20, font: fontBold, color: rgb(0.05, 0.08, 0.15) });
    page.drawText(`Nro: ${String(recibo.numero_recibo).padStart(6, '0')}`, { x: 420, y: y - 36, size: 11, font: fontBold });
    page.drawText(`Fecha: ${formatDate(recibo.fecha_emision)}`, { x: 420, y: y - 52, size: 10, font });

    y -= 90;
    page.drawLine({ start: { x: margin, y }, end: { x: 595.28 - margin, y }, thickness: 1, color: rgb(0.85, 0.86, 0.88) });
    y -= 24;

    // Empresa
    page.drawText(companyName, { x: margin, y, size: 14, font: fontBold });
    y -= 22;

    // Cliente / Orden
    page.drawText(`Cliente: ${clientName}`, { x: margin, y, size: 11, font });
    y -= 16;
    if (ordenNumero) {
      page.drawText(`Orden: ${ordenNumero}`, { x: margin, y, size: 11, font });
      y -= 16;
    }
    page.drawText(`Fecha de pago: ${formatDate(recibo.fecha_pago)}`, { x: margin, y, size: 11, font });
    y -= 24;

    // Caja de detalle
    const boxTop = y;
    const boxH = 140;
    page.drawRectangle({
      x: margin,
      y: boxTop - boxH,
      width: 595.28 - margin * 2,
      height: boxH,
      borderColor: rgb(0.85, 0.86, 0.88),
      borderWidth: 1,
    });

    let innerY = boxTop - 22;
    const leftX = margin + 14;
    page.drawText('Detalle del pago', { x: leftX, y: innerY, size: 12, font: fontBold });
    innerY -= 22;

    const monto = Number(recibo.monto ?? 0);
    page.drawText(`Monto recibido: ${formatMoney(monto)}`, { x: leftX, y: innerY, size: 11, font: fontBold });
    innerY -= 18;

    const metodo = medioCobroNombre || recibo.metodo_pago || '-';
    page.drawText(`Medio de cobro: ${metodo}`, { x: leftX, y: innerY, size: 10, font });
    innerY -= 16;

    if (recibo.referencia_pago) {
      page.drawText(`Referencia: ${recibo.referencia_pago}`, { x: leftX, y: innerY, size: 10, font });
      innerY -= 16;
    }

    if (recibo.notas) {
      const notas = String(recibo.notas);
      page.drawText(`Notas: ${notas.slice(0, 120)}${notas.length > 120 ? '…' : ''}`, { x: leftX, y: innerY, size: 10, font });
      innerY -= 16;
    }

    // Footer
    const footerY = 70;
    page.drawLine({ start: { x: margin, y: footerY + 20 }, end: { x: 595.28 - margin, y: footerY + 20 }, thickness: 1, color: rgb(0.92, 0.93, 0.94) });
    page.drawText('Este recibo fue generado automáticamente por el sistema.', { x: margin, y: footerY, size: 9, font, color: rgb(0.4, 0.4, 0.4) });

    const pdfBytes = await pdf.save();

    const path = `${recibo.company_id}/${recibo.token_corto}.pdf`;
    const { error: uploadError } = await supabaseAdmin.storage.from('recibos').upload(path, pdfBytes, {
      contentType: 'application/pdf',
      upsert: true,
    });

    if (uploadError) {
      return new Response(JSON.stringify({ success: false, error: `Error subiendo PDF: ${uploadError.message}` }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { error: updateError } = await supabaseAdmin
      .from('recibos_pagos')
      .update({ pdf_storage_path: path, pdf_generated_at: new Date().toISOString() })
      .eq('id', recibo.id);

    if (updateError) {
      return new Response(JSON.stringify({ success: false, error: `Error actualizando recibo: ${updateError.message}` }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true, pdf_storage_path: path, orden_numero: ordenNumero }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('[generate-recibo-pdf] Error:', err);
    return new Response(JSON.stringify({ success: false, error: err?.message ?? 'Error interno' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
