
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

async function checkAndUpdateProfile() {
    console.log('Checking profiles...');

    const { data: profiles, error } = await supabase
        .from('profiles')
        .select('*');

    if (error) {
        console.error('Error fetching profiles:', error);
        return;
    }

    console.log(`Found ${profiles.length} profiles.`);

    if (profiles.length === 0) {
        console.log('No profiles found. Make sure you have registered a user.');
        return;
    }

    const firstProfile = profiles[0];
    console.log('First profile:', firstProfile);

    if (firstProfile.role !== 'super_admin') {
        console.log(`Updating role for ${firstProfile.email} from ${firstProfile.role} to super_admin...`);

        const { error: updateError } = await supabase
            .from('profiles')
            .update({ role: 'super_admin' })
            .eq('id', firstProfile.id);

        if (updateError) {
            console.error('Error updating profile:', updateError);
        } else {
            console.log('Profile updated successfully to super_admin.');
        }
    } else {
        console.log('Profile is already super_admin.');
    }
}

checkAndUpdateProfile();
