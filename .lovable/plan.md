# Publicar, testar o checkout real e conectar ao GitHub

## 1. Publicar
- Verificar se há alertas de segurança críticos antes de publicar (se houver, aviso você antes).
- Publicar o projeto, para que a correção do botão "Your checkout is ready" chegue a create-yours.perfectbookshelf.com.

## 2. Checkout real em perfectbookshelf.com com ESTE_TR20
- Abrir a página da loja que tem o designer embutido, em um navegador automático.
- Montar uma estante, ir até a etapa 5, aplicar o cupom ESTE_TR20 e confirmar que o desconto aparece no preço.
- Clicar em Checkout e, se o navegador bloquear o redirecionamento, clicar no botão pulsante "checkout ready".
- Confirmar que a página de pagamento do Shopify abre com: modelo e preço corretos, desconto ESTE_TR20 aplicado e campo de endereço de entrega obrigatório.
- Testar também: mudar o acabamento depois do botão aparecer e confirmar que o link antigo some.
- Não vou concluir o pagamento. O pedido de teste criado no Shopify será apagado em seguida.
- Envio prints de cada passo. Se algo falhar, corrijo e publico de novo.

## 3. Conectar ao GitHub
- Isso só você pode fazer, porque precisa autorizar com a sua conta do GitHub. Vou abrir o cartão de conexão no chat para você:
  1. Autorizar o app do Lovable no GitHub
  2. Escolher a conta/organização
  3. Criar o repositório (é criado novo e privado)
- O código vai para o GitHub e fica sincronizado nos dois sentidos.
- As configurações da loja ficam seguras: chaves do Shopify e outros segredos **não** vão para o GitHub e continuam guardados no Lovable Cloud, assim como os e-mails e orçamentos salvos. Atualizar o código pelo GitHub não apaga essas configurações.

## Detalhes técnicos
- Teste via Playwright no domínio da loja; o rascunho do pedido é removido pela API Admin do Shopify depois da verificação.
- Segredos ficam no ambiente do servidor, nunca no repositório.
