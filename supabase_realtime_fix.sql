-- 1. Garante que a segurança de linha está ativada
ALTER TABLE app_state ENABLE ROW LEVEL SECURITY;

-- 2. Apaga diretrizes anteriores conflitantes (se existirem)
DROP POLICY IF EXISTS "Permitir todos os usuarios lerem e escreverem no matriz" ON app_state;
DROP POLICY IF EXISTS "Enable read access for all users" ON app_state;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON app_state;
DROP POLICY IF EXISTS "Enable update for users based on email" ON app_state;

-- 3. Cria uma política absoluta: Qualquer pessoa LOGADA (authenticated) pode fazer TUDO (Select, Insert, Update, Delete)
-- Não tem restrição de ID de coluna. Liberdade total dentro dos usuários com conta na sua empresa.
CREATE POLICY "Acesso total para usuarios logados"
ON app_state
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- 4. Confirma que a tabela enviará a resposta JSON completa em atualizações real-time
ALTER TABLE app_state REPLICA IDENTITY FULL;
