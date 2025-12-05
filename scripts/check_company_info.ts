
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

async function checkCompanyInfo() {
    console.log('Checking company and profile info...');

    // 1. Get all profiles
    const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select(`
            id, 
            email, 
            full_name, 
            role, 
            company_id,
            companies (
                id,
                name,
                slug,
                status
            )
        `);

    if (profilesError) {
        console.error('Error fetching profiles:', profilesError);
    } else {
        console.log('\n--- PROFILES ---');
        console.log(JSON.stringify(profiles, null, 2));
    }

    // 2. Get all companies just in case
    const { data: companies, error: companiesError } = await supabase
        .from('companies')
        .select('*');

    if (companiesError) {
        console.error('Error fetching companies:', companiesError);
    } else {
        console.log('\n--- ALL COMPANIES ---');
        console.log(JSON.stringify(companies, null, 2));
    }
}

checkCompanyInfo();
