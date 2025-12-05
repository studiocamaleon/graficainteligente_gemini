
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase URL or Key');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDb() {
    console.log('Checking database state...');

    // 1. Check if table exists by trying to select from it
    const { data, error } = await supabase
        .from('ordenes_trabajo_items_rutas')
        .select('id, global_task_id')
        .limit(1);

    if (error) {
        console.error('Error querying table:', error.message);
        if (error.code === '42P01') { // undefined_table
            console.log('RESULT: TABLE DOES NOT EXIST. The database is empty.');
        } else if (error.code === '42703') { // undefined_column
            console.log('RESULT: TABLE EXISTS BUT COLUMN MISSING. Migration not applied.');
        } else {
            console.log('RESULT: UNKNOWN ERROR. might be connectivity or RLS.');
        }
    } else {
        console.log('RESULT: TABLE EXISTS AND COLUMN EXISTS. Migration applied successfully.');
    }
    // Check table count
    const { count, error: countError } = await supabase
        .from('information_schema.tables')
        .select('*', { count: 'exact', head: true })
        .eq('table_schema', 'public');

    if (countError) {
        console.log('Error counting tables:', countError.message);
    } else {
        console.log(`Total public tables: ${count}`);
    }

    // Check functions count
    const { count: functionCount, error: functionError } = await supabase
        .from('information_schema.routines')
        .select('*', { count: 'exact', head: true })
        .eq('routine_schema', 'public')
        .eq('routine_type', 'FUNCTION');

    if (functionError) {
        console.log('Error counting functions:', functionError.message);
    } else {
        console.log(`Total public functions: ${functionCount}`);
    }
}

checkDb();
