-- ==========================================
-- SCRIPT DE UNIFICAÇÃO TOTAL DO QUADRO (MODO TRELLO)
-- ==========================================

-- 1. Remove a trava que exige que o ID seja um usuário real cadastrado
-- Isso permite usarmos um "ID Mestre" compartilhado por todos.
ALTER TABLE app_state DROP CONSTRAINT IF EXISTS app_state_user_id_fkey;

-- 2. Ativa a segurança de linha para configurarmos a permissão
ALTER TABLE app_state ENABLE ROW LEVEL SECURITY;

-- 3. Limpa políticas antigas
DROP POLICY IF EXISTS "Acesso total para usuarios logados" ON app_state;
DROP POLICY IF EXISTS "Permitir todos os usuarios lerem e escreverem no matriz" ON app_state;

-- 4. Cria a nova política: QUALQUER USUÁRIO LOGADO pode mexer no quadro compartilhado
CREATE POLICY "Acesso compartilhado total"
ON app_state
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- 5. Garante que o sincronismo ao vivo (Real-time) envie os dados completos
ALTER TABLE app_state REPLICA IDENTITY FULL;

-- 6. TENTA RESGATAR O ÚLTIMO QUADRO SALVO (Para você não perder o que já fez)
-- Ele pega o quadro mais recente de qualquer usuário e joga no novo ID compartilhado.
INSERT INTO app_state (user_id, state, updated_at)
SELECT '00000000-0000-0000-0000-000000000000', state, now()
FROM app_state
WHERE user_id != '00000000-0000-0000-0000-000000000000'
ORDER BY updated_at DESC
LIMIT 1
ON CONFLICT (user_id) DO UPDATE SET state = EXCLUDED.state, updated_at = EXCLUDED.updated_at;
