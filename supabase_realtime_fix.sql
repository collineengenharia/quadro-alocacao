-- Configuração necessária para que o Real-time funcione corretamente no Supabase.
-- Isso diz ao banco para enviar o registro completo (o documento JSON 'state') 
-- para o outro computador em cada modificação, em vez de enviar só um pedaço e apagar o resto.
ALTER TABLE app_state REPLICA IDENTITY FULL;
