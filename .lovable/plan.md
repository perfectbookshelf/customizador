# Preparar o projeto para ir ao GitHub

## O que você precisa fazer (só você pode)

A conexão com o GitHub exige autorização com a sua conta, então acontece na interface do Lovable, não por mim:

1. Nome/logo do projeto, canto superior esquerdo → **Settings** (atalho `Ctrl` + `.`)
2. Aba **Git**
3. Linha do **GitHub** → **Connect** → autorize na janela do GitHub → escolha conta/organização → **Create repository**

Alternativa: **(+) ao lado da caixa de chat** → **Project** → **GitHub**.
Se o item não aparecer, falta uma autorização do workspace: **Workspace settings → Git → GitHub → Add connection**.

## O que eu preparo antes de você conectar

- **Arquivo de descrição do projeto** (`README.md` na raiz): o que é o customizador, as peças que o compõem (configurador em 3D, etapas do assistente, preços por acabamento, formulário de contato, pagamento na Shopify), como rodar localmente e como testar. Hoje o repositório não tem nenhuma descrição — quem abrir depois não sabe por onde começar.
- **Nota sobre o que não está no código**: senhas da Shopify, e-mails dos clientes e orçamentos salvos ficam no Lovable Cloud e não sobem para o GitHub. Os dados da loja são exportados separadamente.
- **Revisar o que é ignorado** na hora de subir, para o repositório sair limpo (pastas de dependência e de compilação já estão cobertas).

## Detalhes técnicos

- `README.md` novo na raiz, em inglês (padrão de repositórios), com: resumo do produto, stack (React + TanStack Start + Three.js + Tailwind v4), mapa curto das pastas, comandos de instalação/teste, e uma seção "Where things live" apontando configurador, preços, formulário de contato e rota de pagamento.
- Verificado: `.env` está sob controle de versão, mas só guarda URL, chave pública e identificador do backend — valores que já aparecem no navegador. As credenciais verdadeiras (token da Shopify, segredo de administração) ficam nos Secrets do Lovable Cloud e não entram no repositório. Nenhuma mudança necessária aqui.
- `.gitignore` já cobre dependências, saída de compilação e arquivos locais. Sem ajustes além de confirmar.
- Nenhum arquivo do app é alterado: nada muda no customizador que seus clientes usam.

## Ordem

1. Eu escrevo a descrição do projeto.
2. Você conecta o GitHub pelo caminho acima.
3. O repositório é criado privado e passa a sincronizar sozinho; a partir daí, cada alteração que eu fizer aqui chega lá automaticamente.
