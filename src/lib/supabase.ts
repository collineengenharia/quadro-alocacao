import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://gnzjofdgwvdunktoktns.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImduempvZmRnd3ZkdW5rdG9rdG5zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI3MDY2ODIsImV4cCI6MjA4ODI4MjY4Mn0.m9efZEAt0EUW6VrnFlJjrkynT6-_mE5v3pYLD0U2qgc';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
