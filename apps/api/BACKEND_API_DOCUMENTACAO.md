# Backend API - Documentacao Tecnica

## Visao geral

Este backend foi construido com `NestJS` + `Prisma` + `PostgreSQL` e segue os principios:

- autenticacao forte (hash com `Argon2id`, JWT access/refresh, validacoes)
- regras de negocio por plano (`FREE` e `PRO`)
- respostas padronizadas para sucesso e erro
- mensagens em portugues

Base URL local:

- `http://localhost:3000`

## Stack e infraestrutura

- Framework API: `NestJS`
- ORM: `Prisma`
- Banco: `PostgreSQL` (Docker)
- Autenticacao: JWT (`accessToken` + `refreshToken`)
- Hash de senha/token: `Argon2id`
- Seguranca: `helmet`, `ValidationPipe`, CORS habilitado

Arquivos importantes:

- `src/main.ts`: pipes, interceptor de sucesso e filtro global de erros
- `src/common/interceptors/success-response.interceptor.ts`
- `src/common/filters/http-exception.filter.ts`
- `src/common/errors/business-error-code.ts`
- `src/common/errors/success-code.ts`
- `prisma/schema.prisma`

## Modelo de dados (Prisma)

Entidades principais:

- `User`
- `Household`
- `HouseholdMember`
- `Invite`

Enums principais:

- `PlanTier`: `FREE`, `PRO`
- `HouseholdRole`: `HOST`, `ADMIN`, `EDITOR`, `VIEWER`

## Padrao de resposta

## Sucesso

```json
{
  "sucesso": true,
  "statusCode": 200,
  "codigo": "OPERACAO_SUCESSO",
  "mensagem": "Operacao realizada com sucesso.",
  "caminho": "/rota",
  "timestamp": "2026-04-27T00:00:00.000Z",
  "dados": {}
}
```

## Erro

```json
{
  "sucesso": false,
  "statusCode": 400,
  "codigo": "CODIGO_DE_ERRO",
  "mensagem": "Mensagem em portugues.",
  "caminho": "/rota",
  "timestamp": "2026-04-27T00:00:00.000Z",
  "detalhes": null
}
```

## Contratos de API

## Auth

### POST `/auth/register`

- Auth: nao
- Body:

```json
{
  "name": "Alex Souza",
  "email": "ana@example.com",
  "password": "SenhaForte@2026"
}
```

- Sucesso:
  - `statusCode`: `201`
  - `codigo`: `CONTA_CRIADA`
  - `dados`: `userId`, `verificationTokenForDev`

### POST `/auth/verify-email`

- Auth: nao
- Body:

```json
{
  "token": "token_retorno_register"
}
```

- Sucesso:
  - `statusCode`: `201`
  - `codigo`: `EMAIL_VERIFICADO`

### POST `/auth/login`

- Auth: nao
- Body:

```json
{
  "email": "ana@example.com",
  "password": "SenhaForte@2026"
}
```

- Sucesso:
  - `statusCode`: `200`
  - `codigo`: `LOGIN_REALIZADO`
  - `dados`: `accessToken`, `refreshToken`, `user`

### POST `/auth/refresh`

- Auth: nao
- Body:

```json
{
  "userId": "uuid",
  "refreshToken": "jwt_refresh"
}
```

- Sucesso:
  - `statusCode`: `200`
  - `codigo`: `TOKEN_RENOVADO`

### POST `/auth/logout`

- Auth: sim (`Bearer accessToken`)
- Body: vazio
- Sucesso:
  - `statusCode`: `200`
  - `codigo`: `LOGOUT_REALIZADO`

## Households (lares)

### GET `/households/me`

- Auth: sim
- Sucesso:
  - `statusCode`: `200`
  - `codigo`: `LARES_LISTADOS`
  - `dados.items`: lista de lares com membros

### POST `/households`

- Auth: sim
- Body:

```json
{
  "name": "Lar da Ana"
}
```

- Sucesso:
  - `statusCode`: `201`
  - `codigo`: `LAR_CRIADO`
  - `dados.household`: lar criado com membro `HOST` automatico

## Invites (convites)

### POST `/invites/households/:householdId`

- Auth: sim
- Regra: apenas `HOST` do lar pode convidar
- Body:

```json
{
  "email": "membro@example.com",
  "role": "EDITOR"
}
```

- Sucesso:
  - `statusCode`: `201`
  - `codigo`: `CONVITE_CRIADO`
  - `dados.invite`: `inviteId`, `token`, `expiresAt`

### POST `/invites/accept`

- Auth: sim (usuario convidado)
- Body:

```json
{
  "token": "token_convite"
}
```

- Sucesso:
  - `statusCode`: `201`
  - `codigo`: `CONVITE_ACEITO`
  - `dados.acceptance`: `householdId`, `acceptedAt`

## Users

### GET `/users/me`

- Auth: sim
- Sucesso:
  - `statusCode`: `200`
  - `codigo`: `USUARIO_CARREGADO`
  - `dados.user`: dados do usuario
  - `dados.plan`: plano e limites
  - `dados.onboarding`: resumo de participacao

## Plans

### GET `/plans/:userId`

- Auth: nao (atualmente aberto)
- Sucesso:
  - `statusCode`: `200`
  - `codigo`: `PLANO_CARREGADO`

### PATCH `/plans/:userId`

- Auth: nao (atualmente aberto)
- Body:

```json
{
  "tier": "PRO"
}
```

- Sucesso:
  - `statusCode`: `200`
  - `codigo`: `PLANO_ATUALIZADO`

## Regras de negocio implementadas

## Plano FREE

- maximo de `1` lar criado como anfitriao
- maximo de `4` membros por lar (inclui anfitriao)
- maximo de `4` participacoes totais em lares (host + membro)

## Convites

- somente `HOST` pode criar convite
- nao permite convite se lar ja estiver no limite de membros
- nao permite convite para usuario que ja pertence ao lar
- nao permite convite duplicado pendente para mesmo e-mail
- token de convite com expiração (48h)
- convite nao pode ser aceito se:
  - token invalido
  - token expirado
  - convite ja utilizado
  - usuario excedeu limite de participacao do plano

## Autenticacao

- senha minima forte via DTO (tamanho + complexidade)
- hash de senha com `Argon2id`
- `refreshToken` armazenado com hash
- bloqueio progressivo de tentativas de login:
  - a partir de 5 tentativas: bloqueio temporario
  - a partir de 10 tentativas: bloqueio maior
- verificacao de e-mail obrigatoria antes do login
- sem servico de e-mail ainda:
  - fluxo de verificacao em modo dev via `verificationTokenForDev`

## Catalogo de codigos de sucesso

Arquivo: `src/common/errors/success-code.ts`

- `OPERACAO_SUCESSO`
- `CONTA_CRIADA`
- `EMAIL_VERIFICADO`
- `LOGIN_REALIZADO`
- `TOKEN_RENOVADO`
- `LOGOUT_REALIZADO`
- `LAR_CRIADO`
- `LARES_LISTADOS`
- `CONVITE_CRIADO`
- `CONVITE_ACEITO`
- `USUARIO_CARREGADO`
- `PLANO_CARREGADO`
- `PLANO_ATUALIZADO`

## Catalogo de codigos de erro de negocio

Arquivo: `src/common/errors/business-error-code.ts`

- `EMAIL_JA_EM_USO`
- `TOKEN_VERIFICACAO_INVALIDO`
- `TOKEN_VERIFICACAO_EXPIRADO`
- `CREDENCIAIS_INVALIDAS`
- `EMAIL_NAO_VERIFICADO`
- `SESSAO_INVALIDA`
- `MUITAS_TENTATIVAS`
- `LAR_NAO_ENCONTRADO`
- `USUARIO_NAO_ENCONTRADO`
- `APENAS_ANFITRIAO`
- `PLANO_LIMITE_LARES`
- `PLANO_LIMITE_MEMBROS`
- `PLANO_LIMITE_PARTICIPACAO`
- `CONVITE_INVALIDO`
- `CONVITE_EXPIRADO`
- `CONVITE_JA_UTILIZADO`
- `CONVITE_DUPLICADO`
- `USUARIO_JA_NO_LAR`

## Pontos de atencao / proximos passos

- Proteger endpoints de plano com autenticacao e autorizacao (admin/internal)
- Adicionar servico real de e-mail para verificacao/convites
- Persistir tentativas de login (hoje em memoria do processo)
- Adicionar testes automatizados (e2e) para regras de plano/convites
- Gerar OpenAPI/Swagger para documentacao navegavel
