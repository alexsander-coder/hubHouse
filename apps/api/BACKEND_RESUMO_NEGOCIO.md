# Resumo do Backend (Versao Menos Tecnica)

## O que este backend faz

Este backend suporta um sistema de organizacao de lares/familias com:

- criacao de conta e login
- criacao e gestao de lares
- convite de membros para o lar
- controle de limites por plano (Free/Pro)

## O que ja esta funcionando

- cadastro de usuario
- verificacao de conta (em modo de desenvolvimento)
- login e logout
- criacao de lar
- convite e aceite de convite
- consulta de perfil com limites do plano
- respostas padronizadas de sucesso e erro

## Regras principais do plano Free

- pode criar ate **1 lar**
- cada lar pode ter ate **4 membros** (incluindo o anfitriao)
- cada usuario pode participar de ate **4 lares** no total

## Como funciona o lar

- quem cria o lar vira o **anfitriao**
- o anfitriao pode convidar membros
- o anfitriao define permissao do convidado (ex.: visualizacao, edicao)
- o sistema bloqueia convites e entradas quando o limite do plano e atingido

## Convites

- convite e criado para um e-mail
- convite tem validade
- convite nao pode ser usado duas vezes
- convite duplicado pendente para o mesmo e-mail e bloqueado

## Seguranca (visao geral)

- senha protegida com hash forte
- sessao com token de acesso e token de renovacao
- bloqueio temporario apos varias tentativas de login com erro
- verificacao de conta antes do primeiro uso

## Padrao de retorno da API

Todas as respostas seguem um formato unico com:

- sucesso (true/false)
- status da requisicao
- codigo da operacao/erro
- mensagem em portugues

Isso facilita a integracao com frontend e tratamento de mensagens.

## O que falta para proxima etapa

- integrar envio real de e-mails
- restringir endpoints administrativos (como alteracao de plano)
- criar testes automatizados de fluxos principais
- documentacao navegavel (Swagger/OpenAPI)
