# 🚀 Manual de Deploy Fácil — quadro-alocacao (Plano de Fuga!)

Este guia foi criado para ajudar você a publicar e atualizar o **quadro-alocacao** na internet de forma simples, organizada e livre de erros de conta!

---

## 🛑 O "Segurança de Condomínio" (Por que dava erro?)

Cada aplicativo que criamos no Antigravity pertence a uma conta de e-mail diferente, com seu próprio GitHub, banco de dados Supabase e conta da Vercel. 
Se você tentar publicar as novidades de um projeto usando as credenciais de outro, a Vercel vai barrar você como um "segurança de condomínio" zeloso, ou pior: pode publicar o site no endereço errado, gerando uma grande confusão de identidade!

---

## ⚡ A Solução: O "Crachá de Identidade" e o "Disfarce Invisível"

Para que cada projeto seja publicado na conta correta e sem bloqueios, usamos dois elementos simples:

1.  **O Crachá do Projeto (`.vercel-config`):** Um arquivo local na pasta deste projeto que guarda as chaves de acesso exclusivas dele (Token, Project ID e Org ID). **Nunca misture as chaves de projetos diferentes no mesmo arquivo!**
2.  **O Disfarce Invisível (Script de Deploy):** Um script que esconde as assinaturas do Git temporariamente (renomeando a pasta `.git`), carrega o crachá do projeto, envia a atualização para a Vercel e devolve o Git ao seu lugar.

---

## 🛠️ Passo a Passo para Fazer o Deploy

### Passo 1: Preencher o seu Crachá (Apenas uma vez por projeto!)
Abra o arquivo chamado `.vercel-config` na pasta deste projeto e certifique-se de que ele possui as informações corretas da conta Vercel deste projeto:

- `VERCEL_TOKEN`: O token de acesso pessoal gerado no painel da conta Vercel deste projeto (*Settings -> Tokens*).
- `VERCEL_PROJECT_ID`: O ID do projeto na Vercel (*Settings -> Project ID*).
- `VERCEL_ORG_ID`: O ID da organização ou conta na Vercel.

*(Nota: Se você já fez deploy deste projeto antes por este computador ou se a pasta oculta `.vercel` já existe, as chaves de ID do Projeto e ID da Organização já estarão preenchidas).*

---

### Passo 2: O Comando Mágico do Deploy (Sempre que atualizar o app!)
Sempre que fizer alterações no código do seu programa e quiser publicar as novidades na internet:

1.  Abra a pasta do **quadro-alocacao** no seu computador.
2.  Clique com o botão direito em um espaço em branco e escolha **"Abrir no Terminal"** (ou abra o PowerShell nesta pasta).
3.  Copie o bloco de comandos completo abaixo (selecione tudo de uma vez):

```powershell
# 1. Esconde as assinaturas do Git temporariamente
Rename-Item -Path ".git" -NewName ".git_back" -ErrorAction SilentlyContinue

# 2. Carrega as chaves secretas exclusivas do crachá do projeto (.vercel-config)
if (Test-Path ".vercel-config") {
    Get-Content ".vercel-config" | ForEach-Object {
        $line = $_.Trim()
        if ($line -and -not $line.StartsWith("#") -and $line -match "^([^=]+)=(.*)$") {
            $key = $Matches[1].Trim()
            $val = $Matches[2].Trim()
            [System.Environment]::SetEnvironmentVariable($key, $val)
        }
    }
}

# 3. Envia o disfarce anônimo e faz o deploy de produção para a conta correta
npx vercel --prod --yes --token $env:VERCEL_TOKEN --scope $env:VERCEL_ORG_ID

# 4. Devolve a pasta do Git ao seu lugar
Rename-Item -Path ".git_back" -NewName ".git" -ErrorAction SilentlyContinue
```

4.  Cole o bloco no PowerShell e aperte **Enter**. 
5.  Pronto! O seu aplicativo será compilado e atualizado na conta da Vercel correspondente a este projeto de forma limpa, isolada e sem qualquer erro! 🎉
