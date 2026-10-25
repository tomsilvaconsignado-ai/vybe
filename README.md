# VYBE — Sua conexão. Suas regras. (+18)

Rede social moderna e sofisticada voltada exclusivamente para adultos maiores de 18 anos, especialmente casais liberais, pessoas solteiras e conexões consensuais.

---

## 📋 Sumário
1. [Visão Geral & Recursos](#-visão-geral--recursos)
2. [Stack Tecnológica](#-stack-tecnológica)
3. [Estrutura de Pastas do Projeto](#-estrutura-de-pastas-do-projeto)
4. [Instalação e Execução Local](#-instalação-e-execução-local)
5. [Configuração Completa do Supabase](#-configuração-completa-do-supabase)
6. [Publicação no GitHub](#-publicação-no-github)
7. [Implantação em Produção](#-implantação-em-produção)
8. [Conta do Administrador Principal](#-conta-do-administrador-principal)
9. [Segurança e Conformidade LGPD](#-segurança-e-conformidade-lgpd)

---

## 🌟 Visão Geral & Recursos

- **Identidade Própria & Elegante:** Preto profundo, violeta, magenta neon e detalhes em coral.
- **Cadastro Inteligente em 6 Etapas:** Maioridade legal, casais com autorização mútua, dados pessoais, preferências de sintonia, galeria e verificação com selfie.
- **Feed Social Estilo Instagram:** Publicações com carrossel de fotos, legendas, enquetes interativas, curtidas, comentários e favoritos.
- **Algoritmo de Sintonia Bidirecional:** Cálculo de compatibilidade (0 a 100%) baseado em reciprocidade mútua, objetivos, estilo de vida e limites declarados.
- **Cofres Íntimos Protegidos:** Armazenamento isolado com *blur* preventivo e controle individual de concessão e revogação de chaves de acesso.
- **Mensagens Privadas com Portão Protetivo:** Prevenção contra envio de fotos íntimas ou spam sem autorização prévia.
- **Comunidades & Fóruns:** Espaços para troca de vivências e encontros sociais organizados por cidades e temas.
- **Painel Administrativo Completo:** Dashboard com 11 KPIs, gestão de contas, moderação de mídias, investigação de mensagens denunciadas com justificativa obrigatória e livro de auditoria imutável (*Audit Trail*).

---

## 🛠 Stack Tecnológica

- **Frontend:** React 19, TypeScript, Vite 8, Tailwind CSS v4, Motion, Lucide React
- **Backend / API:** Node.js com Express e middlewares Vite (Full-Stack)
- **Banco de Dados & Auth:** PostgreSQL + Supabase Auth + Supabase Storage (com Row Level Security)
- **Segurança:** Criptografia de ponta a ponta para cofres, autenticação multifator (MFA) e conformidade estrita com a LGPD.

---

## 📁 Estrutura de Pastas do Projeto

```
vybe/
├── .env.example                  # Variáveis de ambiente documentadas
├── .gitignore                    # Regras para exclusão de arquivos no Git
├── index.html                    # Entry point HTML com metadados +18
├── metadata.json                 # Metadados da aplicação
├── package.json                  # Dependências e scripts npm
├── README.md                     # Documentação completa do projeto
├── server.ts                     # Servidor Express Full-Stack com rotas de API
├── tsconfig.json                 # Configuração do TypeScript
├── vite.config.ts                # Configuração do Vite e Tailwind CSS v4
│
├── public/                       # Arquivos estáticos
│   └── vybe-project.zip          # Pacote ZIP exportado completo para download
│
├── supabase/                     # Scripts de Banco de Dados e Storage
│   ├── schema.sql                # Tabelas, chaves estrangeiras, enums e índices
│   ├── rls_policies.sql          # Políticas de Row Level Security (RLS)
│   └── storage_setup.sql         # Criação de buckets e políticas de armazenamento
│
└── src/                          # Código-fonte da aplicação
    ├── App.tsx                   # Roteamento e orquestrador principal
    ├── main.tsx                  # Ponto de montagem React
    ├── index.css                 # Estilos globais e tokens visuais
    ├── types/
    │   └── index.ts              # Modelos de dados TypeScript
    ├── lib/
    │   └── supabase.ts           # Cliente Supabase e helpers de Storage/Auth
    ├── context/
    │   └── AppContext.tsx        # Gerenciamento de estado global e persistência
    ├── data/
    │   └── mockData.ts           # Dados iniciais e perfis pré-carregados
    ├── utils/
    │   └── compatibility.ts      # Algoritmo de compatibilidade bidirecional
    └── components/
        ├── layout/               # Header, Sidebar, MobileNav, AgeGateModal
        ├── auth/                 # LandingPage, LoginModal, RegisterWizard
        ├── feed/                 # FeedView, PostCard, CreatePostModal, StoriesBar
        ├── discover/             # DiscoverView, ProfileCard, filtros avançados
        ├── compatibility/        # CompatibilityView (comparador 1-para-1)
        ├── profile/              # ProfileView, EditProfileModal, AlbumPermissions
        ├── communities/          # CommunitiesView e fóruns temáticos
        ├── messages/             # MessagesView e chat criptografado
        ├── notifications/        # NotificationsView com modo discreto
        ├── settings/             # SettingsView e exportação de dados LGPD
        ├── modals/               # ReportModal e TermsPrivacyModal
        └── admin/                # AdminPortal, AdminUserDetailModal, etc.
```

---

## 💻 Instalação e Execução Local

### Pré-requisitos
- **Node.js**: versão 18.x ou superior (recomendado 20.x+)
- **npm** ou **pnpm** / **yarn**
- **Git** instalado no computador

### Passo a Passo

1. **Clonar ou extrair o projeto:**
   ```bash
   git clone https://github.com/SEU-USUARIO/vybe.git
   cd vybe
   ```
   *(Ou descompacte o arquivo `vybe-project.zip` em uma pasta)*

2. **Instalar as dependências:**
   ```bash
   npm install
   ```

3. **Configurar as variáveis de ambiente:**
   Copie o arquivo `.env.example` para `.env`:
   ```bash
   cp .env.example .env
   ```
   *(Abra o `.env` e preencha suas chaves do Supabase quando criadas)*

4. **Executar o ambiente de desenvolvimento:**
   ```bash
   npm run dev
   ```
   Acesse a aplicação no navegador em: `http://localhost:3000`

5. **Compilar para produção:**
   ```bash
   npm run build
   ```

---

## 🗄 Configuração Completa do Supabase

Para conectar o VYBE ao Supabase em produção:

### 1. Criar o Projeto no Supabase
1. Acesse [supabase.com](https://supabase.com) e crie uma conta gratuita ou faça login.
2. Clique em **New Project**, defina o nome (ex: `vybe-production`) e crie uma senha segura para o banco.
3. Escolha uma região próxima (ex: `South America (São Paulo)`).

### 2. Executar o Script SQL no Supabase
No painel do Supabase, acesse **SQL Editor**, cole todo o conteúdo de **`supabase/setup.sql`** e clique em **Run**.
O script pode ser executado novamente sem perder dados. Ele cria:

- Tabelas, índices e tipos (perfis, posts, conexões, comunidades, cofres, mensagens, denúncias, auditoria).
- Gatilho que cria o perfil automaticamente no cadastro (bloqueando menores de 18 anos).
- Regras de segurança (RLS) em todas as tabelas. Dados sensíveis (e-mail, nascimento) ficam em `profile_private`, visível só para o dono e a moderação.
- Papel de superadministrador para o e-mail definido em `primary_admin_email()`, concedido **somente após a confirmação do e-mail**. Permissões administrativas no banco exigem sessão com MFA (aal2).
- Buckets `public-media` (público) e `private-vaults` (cofres, acesso via *signed URL* só para dono e pessoas aprovadas).
- Realtime para mensagens e notificações.

### 3. Obter as Chaves de API
1. Acesse **Project Settings** -> **API Keys**.
2. Copie a **Project URL** e a chave **publishable** (ou a antiga **anon**) para o `.env`:
   ```env
   VITE_SUPABASE_URL="https://seu-id.supabase.co"
   VITE_SUPABASE_ANON_KEY="sb_publishable_..."
   ```
3. A chave **secret / service_role** ignora todas as regras de segurança: use apenas em servidor, nunca no frontend.

### 4. Configurar Redirecionamentos de Autenticação
1. No painel do Supabase, acesse **Authentication** -> **URL Configuration**.
2. Em **Site URL**, configure a URL da sua aplicação (ex: `https://vybe.app` ou `http://localhost:3000`).
3. Em **Redirect URLs**, adicione:
   - `http://localhost:3000/**`
   - `https://seu-dominio.com/**`

---

---

## 🚀 Publicação no GitHub e GitHub Pages (Sem Tela Branca)

### ⚠️ Diagnóstico e Solução da "Tela Branca" no GitHub Pages

A tela branca ocorria por dois motivos clássicos de publicação de aplicações React/Vite no GitHub:

1. **Caminhos Absolutos de Assets (`base: '/'`):** 
   Por padrão, o Vite gerava caminhos absolutos como `/assets/index.js`. Quando o site é publicado no GitHub Pages em um subdiretório (ex: `https://seu-usuario.github.io/vybe/`), o navegador tentava carregar os arquivos da raiz do domínio (`https://seu-usuario.github.io/assets/index.js`), resultando em erro **404 Not Found** e deixando a tela em branco.
   - **Correção aplicada:** Configuramos `base: './'` no `vite.config.ts`, garantindo que todos os assets sejam referenciados de forma relativa e carreguem perfeitamente em qualquer URL, repositório ou subdiretório.

2. **Publicação dos Arquivos Fontes Brutos (.tsx) sem Compilação:** 
   Se o GitHub Pages for configurado para "Deploy from a branch" apontando para a raiz do repositório, o servidor estático serve o arquivo `index.html` original apontando para `/src/main.tsx`. Navegadores web não executam arquivos TypeScript diretamente sem compilação.
   - **Correção aplicada:** Criamos o fluxo automatizado do GitHub Actions em `.github/workflows/deploy.yml`, que compila o projeto com `npm run build` e publica a pasta `dist` já transpilada e otimizada.
   - **Adicionado `public/404.html`:** Redirecionador SPA para garantir que recarregar a página ou navegar por links diretos não cause tela de erro 404.
   - **Adicionado `ErrorBoundary` e Preloader:** Proteção no `src/main.tsx` e `index.html` que previne falhas silenciosas e exibe interface de recuperação caso ocorra qualquer imprevisto.

---

### 📋 Passo a Passo para Publicar no GitHub Pages (2 Opções Simples)

#### Opção 1: Instantânea pela Pasta `/docs` (Recomendada se você não usa GitHub Actions)
1. Baixe o pacote `vybe-project.zip` ou envie todos os arquivos do repositório para o GitHub.
2. No seu repositório no GitHub, clique na aba **Settings** (Configurações) > **Pages**.
3. Em **Build and deployment** > **Source**, mantenha **"Deploy from a branch"**.
4. Em **Branch**, selecione a branch `main` e no campo da pasta ao lado selecione **`/docs`**.
5. Clique em **Save**.
6. Pronto! O site entrará no ar em segundos com todos os arquivos já compilados e sem nenhuma tela de erro.

#### Opção 2: Automática com GitHub Actions (Para compilação contínua a cada commit)
1. Envie as alterações para o seu repositório:
   ```bash
   git add .
   git commit -m "fix: correcao definitiva erro github pages"
   git push origin main
   ```
2. No seu repositório no GitHub, vá em **Settings** > **Pages**.
3. Em **Build and deployment** > **Source**, escolha **"GitHub Actions"**.
4. O GitHub executará o fluxo `.github/workflows/deploy.yml` automaticamente.
5. Em aproximadamente 45 segundos, o site estará publicado no link indicado no topo da página.

---

## 🌐 Implantação Alternativa em Produção

### Opção A: Vercel (Recomendado para Frontend Serverless)
1. Conecte sua conta do GitHub na [Vercel](https://vercel.com).
2. Importe o repositório `vybe`.
3. Em **Environment Variables**, adicione (opcional se for usar Supabase real):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Clique em **Deploy**. A Vercel executará `npm run build` e publicará o site instantaneamente.

### Opção B: Render / Railway / Fly.io (Para Full-Stack com Express / server.ts)
1. Crie uma nova aplicação Web Service apontando para o repositório GitHub.
2. Defina o comando de build: `npm install && npm run build`
3. Defina o comando de inicialização: `npm start` (executa `tsx server.ts`)
4. Configure as variáveis de ambiente no painel do serviço.

---

## 👑 Conta do Administrador Principal

- **E-mail:** definido na função `primary_admin_email()` em `supabase/setup.sql`.
- **Como ativar:** cadastre-se normalmente no app com esse e-mail e confirme pelo link recebido. O papel `superadmin` é concedido automaticamente na confirmação.
- **Privilégios:** Painel Administrativo, gestão de usuários, moderação de conteúdos, análise de denúncias e livro de auditoria imutável.
- **MFA obrigatório:** no primeiro acesso ao painel, vincule um aplicativo autenticador (Google Authenticator, Authy etc.) pelo QR code exibido. Sem a sessão MFA, o banco não concede nenhuma permissão administrativa.
- **Outros administradores:** o superadmin pode inserir linhas em `admin_users` (papéis `moderator`, `support`, `auditor`).

---

## 🔒 Segurança e Conformidade LGPD

- **Exclusividade +18:** Verificação etária obrigatória antes da liberação das funcionalidades sociais.
- **Consentimento Mútuo:** Diretriz primária de toda a rede. Tolerância zero para importunação, fotos sem consentimento e contas falsas.
- **Privacidade de Localização:** O usuário escolhe entre exibir a cidade, uma região aproximada ou ocultar a localização. O endereço residencial nunca é exposto.
- **Direito do Titular:** O usuário pode exportar todos os seus dados em formato JSON (Art. 18 da LGPD) ou solicitar a exclusão irrevogável da conta nas Configurações.
- **Moderação Não-Invasiva:** Não existe leitura silenciosa ou indiscriminada de mensagens de usuários; inspeções técnicas ocorrem estritamente sob denúncia formal fundamentada e auditada em log.

---
**VYBE — Sua conexão. Suas regras.**
Todos os direitos reservados.
