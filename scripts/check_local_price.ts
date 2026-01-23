
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkPrice() {
    // 1. List ALL Products to find the name
    const { data: products, error: prodError } = await supabase
        .from('productos_gran_formato')
        .select('id, nombre');

    if (prodError || !products?.length) {
        console.error('Error finding product:', prodError);
        return;
    }

    console.log('Found Products:', products);

    // 2. Check Price for first match
    const productId = products[0].id;
    const { data: prices, error: priceError } = await supabase
        .from('productos_gran_formato_precios')
        .select('*')
        .eq('producto_gran_formato_id', productId);

    if (priceError) {
        console.error('Error fetching prices:', priceError);
    } else {
        console.log('Local Prices:', JSON.stringify(prices, null, 2));
    }
}

checkPrice();
