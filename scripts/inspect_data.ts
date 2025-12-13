
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: '/Users/lucasgomez/graficainteligente_saas_v2/.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials in .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectItems() {
    console.log('Inspecting presupuestos columns...');
    const { data: constraints } = await supabase.rpc('fn_debug_table_info', { p_table_name: 'presupuestos' });
    console.log('Presupuestos Columns:', JSON.stringify(constraints, null, 2));

}

inspectItems();
