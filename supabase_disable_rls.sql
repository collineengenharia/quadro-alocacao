-- Desativando a segurança de nível de linha temporariamente para permitir o quadro único
-- Isso permite que a linha 'colline_matriz' ganhe vida e todos possam ler e escrever.
ALTER TABLE app_state DISABLE ROW LEVEL SECURITY;
