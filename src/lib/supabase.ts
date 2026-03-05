import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://gnzjofdgwvdunktoktns.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_s3zmjvRs-FQ3Cm498orYBw_FxZoCket';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
