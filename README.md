# HubOn – Sistema de Gestão de Patrimônio

<p align="center">
  <img src="HUB ON COR.png" alt="HubOn Logo" width="220"/>
</p>

<p align="center">
  Sistema web para controle e gerenciamento de ativos corporativos (notebooks e celulares) da <strong>HubOn</strong> · CRECI 17135
</p>

<p align="center">
  <img src="https://img.shields.io/badge/versão-1.2.0-16a34a?style=flat-square" />
  <img src="https://img.shields.io/badge/tecnologia-HTML%20%7C%20CSS%20%7C%20JS%20%7C%20Supabase-0d1b2e?style=flat-square" />
  <img src="https://img.shields.io/badge/deploy-Vercel-000?style=flat-square" />
  <img src="https://img.shields.io/badge/licença-privado-gray?style=flat-square" />
</p>

---

## Índice

- [Visão Geral](#visão-geral)
- [Funcionalidades](#funcionalidades)
- [Estrutura de Arquivos](#estrutura-de-arquivos)
- [Pré-requisitos](#pré-requisitos)
- [Configuração](#configuração)
- [Banco de Dados](#banco-de-dados)
- [Controle de Acessos](#controle-de-acessos)
- [Deploy na Vercel](#deploy-na-vercel)
- [Como Usar](#como-usar)
- [Tecnologias](#tecnologias)
- [Identidade Visual](#identidade-visual)
- [Contato](#contato)

---

## Visão Geral

O **Sistema de Gestão de Patrimônio HubOn** é uma aplicação web para registrar, visualizar e gerenciar o inventário de ativos tecnológicos da empresa — notebooks e celulares corporativos.

Os dados são persistidos no **Supabase** (PostgreSQL + Storage + Auth), com papéis de **administrador** e **visualizador**, histórico de custódia e upload de fotos dos equipamentos.

---

## Funcionalidades

- **Login** com Supabase Auth (usuário `@hubon.com` ou nome com espaços, ex.: `Rafael Arcanjo`)
- **Listagem** de ativos com busca, filtros e exportação CSV
- **Cadastro, edição, visualização e exclusão** de patrimônios
- **Histórico de custódia** com reordenação, edição e exclusão de registros
- **Upload de fotos** no Supabase Storage com lightbox
- **Avaliação** com nota (0–10) e resumo automático
- **Controle de acessos** (somente admin): criar usuários, alterar papéis e excluir acessos
- **Papéis**: administrador (CRUD completo) e visualizador (somente leitura)
- **Ajuda rápida** via botão flutuante
- **Layout responsivo**

---

## Estrutura de Arquivos

```
gestao-de-patrimonios/
├── index.html              # Aplicação principal (listagem, visualização, formulário)
├── login.html              # Tela de autenticação
├── access-control.html     # Controle de acessos (somente admin)
├── app.js                  # Lógica principal
├── access-control.js       # Lógica do controle de acessos
├── auth-email.js           # Normalização de usuário → e-mail @hubon.com
├── style.css               # Estilos globais + identidade HubOn
├── supabase-config.js      # URL e chave anon do Supabase
├── package.json            # Dependências da API (Vercel)
├── api/
│   └── manage-users.js     # API serverless: criar e excluir usuários
├── migrations/             # Scripts SQL (histórico e setup do Supabase)
│   ├── database_setup.sql
│   ├── fix_schema.sql
│   ├── migration_custody_history.sql
│   ├── migration_custody_log_admin.sql
│   ├── migration_custody_sort_order.sql
│   ├── migration_departamento_outros_estoque.sql
│   ├── migration_access_control.sql
│   └── migration_custody_delete.sql
├── HUB ON BRANCO.png       # Logo branco (cabeçalho escuro)
├── HUB ON COR.png          # Logo colorida (acessos e README)
├── login_bg.gif            # Background da tela de login
└── .gitignore
```

Os arquivos em `migrations/` não são usados pelo site em produção; servem como histórico e para configurar novos ambientes no Supabase.

---

## Pré-requisitos

- Conta e projeto no [Supabase](https://supabase.com)
- Projeto na [Vercel](https://vercel.com) (para a API de usuários)
- Scripts SQL executados no SQL Editor do Supabase
- Pelo menos um usuário **admin** (ver [Controle de Acessos](#controle-de-acessos))

---

## Configuração

### 1. Banco de dados

Execute no **SQL Editor** do Supabase, nesta ordem (arquivos em `migrations/`):

1. `migrations/database_setup.sql` — tabelas `assets` e `asset_photos`, RLS e bucket `assets`
2. `migrations/fix_schema.sql` — apenas se o banco foi criado antes da versão completa do schema
3. Migrações na ordem lógica de dependência:
   - `migrations/migration_custody_history.sql`
   - `migrations/migration_custody_log_admin.sql`
   - `migrations/migration_custody_sort_order.sql`
   - `migrations/migration_departamento_outros_estoque.sql`
   - `migrations/migration_access_control.sql`
   - `migrations/migration_custody_delete.sql`

### 2. Credenciais no front-end

Edite `supabase-config.js`:

```javascript
const SUPABASE_URL      = 'https://SEU_PROJETO.supabase.co';
const SUPABASE_ANON_KEY = 'SUA_CHAVE_ANON';
```

Valores em **Dashboard → Settings → API**.

### 3. Primeiro administrador

No Supabase: **Authentication → Users** → selecione o usuário → **App Metadata**:

```json
{ "role": "admin" }
```

O usuário deve sair e entrar de novo para o papel valer na sessão.

Demais usuários podem ser criados pela tela **Controle de Acessos** (admin) ou pelo painel do Supabase.

### 4. Desenvolvimento local

```bash
npm install
npx vercel dev
```

Ou, sem API de usuários:

```bash
npx serve .
```

Acesse `http://localhost:3000/login.html` (ou a porta indicada pelo Vercel).

---

## Banco de Dados

| Recurso | Descrição |
|---------|-----------|
| `assets` | Notebooks e celulares |
| `asset_photos` | Referências às fotos no Storage |
| `asset_custody_history` | Histórico de custódia (responsável, setor, períodos) |
| Bucket `assets` | Imagens dos equipamentos |

**RLS:** visualizadores podem ler; apenas administradores podem inserir, atualizar e excluir dados e arquivos.

Funções auxiliares: `get_user_role()`, `is_admin()`, `admin_list_users()`, `admin_set_user_role()`.

---

## Controle de Acessos

- Rota: `access-control.html` (link **Acessos** na barra superior, só para admin)
- **Criar usuário:** via API `POST /api/manage-users` (ação `create`)
- **Excluir usuário:** via API (ação `delete`)
- **Alterar papel:** via RPC `admin_set_user_role` no Supabase

| Papel | Permissões |
|-------|------------|
| **admin** | CRUD de patrimônios, fotos, custódia e usuários |
| **viewer** | Consulta, filtros e exportação CSV |

---

## Deploy na Vercel

Configure em **Settings → Environment Variables**:

| Variável | Descrição |
|----------|-----------|
| `SUPABASE_URL` | URL do projeto Supabase |
| `SUPABASE_ANON_KEY` | Chave anon (pública) |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave service role (secreta — só no servidor) |

A pasta `api/` é detectada automaticamente pela Vercel. O `package.json` instala `@supabase/supabase-js` para `manage-users.js`.

---

## Como Usar

1. Acesse `login.html` e entre com suas credenciais
2. Na listagem, busque, filtre ou selecione o tipo (Todos / Notebooks / Celulares)
3. Clique em uma linha para visualizar; use **Editar** para alterar (admin)
4. Use **Adicionar Patrimônio** para cadastrar (admin)
5. Na edição, gerencie o **Histórico de Custódia** (arrastar para reordenar, excluir com confirmação)
6. Admins: **Acessos** na barra superior para gerenciar usuários
7. Botão **?** no canto inferior direito para ajuda rápida

**Login:** aceita `usuario`, `usuario@hubon.com` ou nome com espaços (ex.: `Rafael Arcanjo` → `rafael.arcanjo@hubon.com`).

---

## Tecnologias

| Tecnologia | Uso |
|------------|-----|
| HTML5 / CSS3 / JavaScript (ES6+) | Interface e lógica |
| [Supabase](https://supabase.com) | Auth, PostgreSQL, Storage, RPC |
| [Vercel](https://vercel.com) | Hospedagem estática + serverless API |
| Google Fonts – Sora | Tipografia |
| FileReader / Blob API | Fotos e exportação CSV |

---

## Identidade Visual

| Variável CSS | Cor | Uso |
|--------------|-----|-----|
| `--hubon-green` | `#1adc5a` | Botões primários, destaques |
| `--hubon-green-dark` | `#13b348` | Hover |
| `--hubon-navy` | `#0d1b2e` | Cabeçalho hero, avatar |

---

## Contato

**HubOn CRECI 17135**  
© 2026 HubOn. Todos os direitos reservados.
