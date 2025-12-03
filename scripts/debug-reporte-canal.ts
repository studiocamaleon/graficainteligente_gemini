/**
 * Script de diagnóstico para verificar reportes por canal
 *
 * Este script verifica:
 * 1. Qué datos tienen las órdenes de copiado en el campo 'origen'
 * 2. Qué devuelve la función fn_reporte_ventas_por_canal
 * 3. Si hay diferencias entre lo esperado y lo real
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugReporteCanal() {
  console.log('🔍 Iniciando diagnóstico de Reporte por Canal...\n');

  try {
    // 1. Verificar órdenes de copiado y su campo origen
    console.log('📋 1. Verificando órdenes de centro copiado...');
    const { data: ordenes, error: ordenesError } = await supabase
      .from('centro_copiado_ordenes')
      .select('id, numero_orden, origen, estado, total, orden_trabajo_id, fecha_solicitud')
      .neq('estado', 'cancelada')
      .order('fecha_solicitud', { ascending: false })
      .limit(20);

    if (ordenesError) {
      console.error('❌ Error obteniendo órdenes:', ordenesError);
      return;
    }

    console.log(`   Total órdenes activas (últimas 20): ${ordenes?.length || 0}`);

    if (ordenes && ordenes.length > 0) {
      const origenStats = ordenes.reduce((acc: any, orden: any) => {
        const origen = orden.origen || 'NULL';
        acc[origen] = (acc[origen] || 0) + 1;
        return acc;
      }, {});

      console.log('\n   📊 Distribución por origen:');
      Object.entries(origenStats).forEach(([origen, count]) => {
        console.log(`      ${origen}: ${count} órdenes`);
      });

      console.log('\n   📝 Ejemplos de órdenes:');
      ordenes.slice(0, 5).forEach((orden: any) => {
        console.log(`      #${orden.numero_orden}: origen="${orden.origen || 'NULL'}", vinculada=${!!orden.orden_trabajo_id}, total=$${orden.total}`);
      });
    }

    // 2. Llamar a la función de reporte
    console.log('\n📊 2. Ejecutando función fn_reporte_ventas_por_canal...');

    // Obtener el company_id del primer usuario
    const { data: profiles } = await supabase
      .from('profiles')
      .select('company_id')
      .limit(1)
      .single();

    if (!profiles?.company_id) {
      console.error('❌ No se pudo obtener company_id');
      return;
    }

    const companyId = profiles.company_id;
    console.log(`   Company ID: ${companyId}`);

    // Calcular fechas del mes actual
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const fechaInicio = firstDay.toISOString().split('T')[0];
    const fechaFin = lastDay.toISOString().split('T')[0];

    console.log(`   Período: ${fechaInicio} a ${fechaFin}`);

    const { data: reporte, error: reporteError } = await supabase
      .rpc('fn_reporte_ventas_por_canal', {
        p_company_id: companyId,
        p_fecha_inicio: fechaInicio,
        p_fecha_fin: fechaFin
      });

    if (reporteError) {
      console.error('❌ Error ejecutando función de reporte:', reporteError);
      return;
    }

    console.log('\n   📈 Resultados del reporte:');
    if (reporte && reporte.length > 0) {
      reporte.forEach((canal: any) => {
        console.log(`\n      ${canal.canal}:`);
        console.log(`         Ventas: $${canal.total_ventas} (${canal.porcentaje_ventas.toFixed(1)}%)`);
        console.log(`         Órdenes: ${canal.total_ordenes} (${canal.ordenes_trabajo} trabajo, ${canal.ordenes_copiado} copiado)`);
        console.log(`         Ticket promedio: $${canal.ticket_promedio}`);
      });
    } else {
      console.log('      ⚠️ No hay datos para este período');
    }

    // 3. Verificar órdenes de copiado independientes específicamente
    console.log('\n📋 3. Verificando órdenes de copiado INDEPENDIENTES (sin orden_trabajo_id)...');
    const { data: independientes, error: indError } = await supabase
      .from('centro_copiado_ordenes')
      .select('numero_orden, origen, total, fecha_solicitud')
      .is('orden_trabajo_id', null)
      .neq('estado', 'cancelada')
      .gte('fecha_solicitud', fechaInicio)
      .lte('fecha_solicitud', fechaFin)
      .order('fecha_solicitud', { ascending: false });

    if (indError) {
      console.error('❌ Error:', indError);
    } else if (independientes && independientes.length > 0) {
      console.log(`   Total: ${independientes.length} órdenes independientes`);

      const origenIndStats = independientes.reduce((acc: any, orden: any) => {
        const origen = orden.origen || 'NULL';
        acc[origen] = (acc[origen] || 0) + 1;
        return acc;
      }, {});

      console.log('\n   📊 Distribución por origen (independientes):');
      Object.entries(origenIndStats).forEach(([origen, count]) => {
        console.log(`      ${origen}: ${count} órdenes`);
      });

      if (independientes.length > 0) {
        console.log('\n   📝 Ejemplos:');
        independientes.slice(0, 5).forEach((orden: any) => {
          console.log(`      #${orden.numero_orden}: origen="${orden.origen || 'NULL'}", total=$${orden.total}`);
        });
      }
    } else {
      console.log('   ⚠️ No hay órdenes independientes en este período');
    }

    // 4. Análisis de discrepancias
    console.log('\n🔍 4. Análisis de posibles problemas...');

    if (independientes && independientes.length > 0) {
      const origenesUnicos = [...new Set(independientes.map(o => o.origen))];
      const canalesReporte = reporte?.map((r: any) => r.canal) || [];

      console.log(`   Orígenes en órdenes independientes: ${origenesUnicos.join(', ')}`);
      console.log(`   Canales en reporte: ${canalesReporte.join(', ')}`);

      const faltantes = origenesUnicos.filter(origen => origen && !canalesReporte.includes(origen));
      if (faltantes.length > 0) {
        console.log(`\n   ⚠️ PROBLEMA: Orígenes que NO aparecen en el reporte: ${faltantes.join(', ')}`);
      } else {
        console.log('\n   ✅ Todos los orígenes aparecen en el reporte');
      }
    }

    console.log('\n✅ Diagnóstico completado');

  } catch (error) {
    console.error('❌ Error general:', error);
  }
}

debugReporteCanal();
