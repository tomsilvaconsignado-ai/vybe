# Vybelog — Sua conexão. Suas regras. (+18)

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
- **Cadastro Inteligente em 6 Etapas:** Maioridade legal, casais com autorização mútua, dados pessoais, preferências de sintonia, fotos e pedido de selo de verificação (aprovado pela moderação).
- **Interação no estilo Instagram:** stories de 24h (com lista de quem viu), carrossel com arrastar, dois toques para curtir, legendas, comentários, enquetes, salvos e perfil em grade.
- **Agenda Liberal:** eventos enviados pelos membros, publicados após aprovação da moderação, com "Vou" e "Tenho interesse".
- **Publicidade:** anúncios patrocinados no feed, na coluna lateral e na agenda, com período de veiculação e contagem de visualizações e cliques (gestão pelo superadmin).
- **Algoritmo de Sintonia Bidirecional:** Cálculo de compatibilidade (0 a 100%) baseado em reciprocidade mútua, objetivos, estilo de vida e limites declarados.
- **Cofres Íntimos Protegidos:** Armazenamento isolado com *blur* preventivo e controle individual de concessão e revogação de chaves de acesso.
- **Mensagens Privadas com Portão Protetivo:** Prevenção contra envio de fotos íntimas ou spam sem autorização prévia.
- **Comunidades & Fóruns:** Espaços para troca de vivências e encontros sociais organizados por cidades e temas.
- **Painel Administrativo Completo:** indicadores, gestão de contas e da equipe, moderação de mídias, investigação de mensagens denunciadas com justificativa obrigatória e livro de auditoria imutável (*Audit Trail*).

---

## 🛠 Stack Tecnológica

- **Frontend:** React 19, TypeScript, Vite 8, Tailwind CSS v4, Motion, Lucide React
- **Backend:** Supabase (Postgres com RLS, Auth, Storage, Realtime). O `server.ts` (Express) apenas serve o app.
- **Banco de Dados & Auth:** PostgreSQL + Supabase Auth + Supabase Storage (com Row Level Security)
- **Segurança:** Row Level Security em todas as tabelas, cofres em bucket privado com links temporários, arquivos criptografados em repouso pelo Supabase, MFA obrigatório para a equipe administrativa e exclusão de conta conforme a LGPD.

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
├── server.ts                     # Servidor Express (dev com Vite / produção estática)
├── tsconfig.json                 # Configuração do TypeScript
├── vite.config.ts                # Configuração do Vite e Tailwind CSS v4
│
├── public/                       # Arquivos estáticos
│   └── 404.html                  # Redirecionamento SPA para o GitHub Pages
│
├── supabase/                     # Scripts de Banco de Dados e Storage
│   └── setup.sql                 # Schema, RLS, gatilhos, storage e realtime (script único)
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
   git clone https://github.com/tomsilvaconsignado-ai/vybe.git
   cd vybe
   ```

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

Para conectar o Vybelog ao Supabase em produção:

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

> **Ao atualizar o app, rode o `setup.sql` novo no Supabase antes de publicar o frontend.** O app depende das tabelas, colunas e funções do script (ex.: `user_blocks`, `profile_private.city`, `block_user`); com o banco desatualizado, o login falha ao carregar o perfil.
>
> Se mudar de projeto Supabase, atualize também `app_media_prefix()` no topo do script: fotos só são aceitas quando vêm do Storage desse projeto.

#### Testes de segurança do banco
```bash
npm install --no-save @electric-sql/pglite@0.2.17
npm run test:db
```
Executa o `setup.sql` num Postgres em memória e tenta os ataques conhecidos (conexão forjada, entrar em conversa alheia, ler cofre sem permissão, notificação falsa, links externos de rastreamento etc.). O GitHub Actions roda esses testes antes de cada deploy e em todo Pull Request para a `vybe.main`.

#### Configurações recomendadas no painel (não ficam no script)
- **Authentication → Attack Protection:** ative o **CAPTCHA** (Cloudflare Turnstile ou hCaptcha) para cadastro e login e a **proteção contra senhas vazadas**. O app já traduz os erros correspondentes. Com CAPTCHA ativo, falta renderizar o widget no cadastro e no login e repassar o token (`options.captchaToken`).
- **Authentication → Rate Limits:** mantenha limites baixos para envio de e-mails e cadastro.

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
2. Em **Site URL**, use `https://vybelog.com.br`.
3. Em **Redirect URLs**, adicione:
   - `https://vybelog.com.br/**`
   - `https://www.vybelog.com.br/**`
   - `http://localhost:3000/**` (desenvolvimento)

---

## ✉️ E-mails (confirmação de cadastro e recuperação de senha)

Sem SMTP próprio, o Supabase só envia e-mails para membros da equipe do projeto e com limite de poucos por hora. Para os usuários receberem os e-mails, configure um remetente próprio.

### 1. Configurar o SMTP
No Supabase: **Authentication** > **Emails** > **SMTP Settings** > **Enable custom SMTP**.

| Campo | Gmail (para começar) | Domínio próprio (recomendado, ex.: Resend ou Brevo) |
|---|---|---|
| Host | `smtp.gmail.com` | Fornecido pelo provedor (ex.: `smtp.resend.com`, `smtp-relay.brevo.com`) |
| Porta | `465` | `465` ou `587` |
| Usuário | o próprio e-mail Gmail | Fornecido pelo provedor |
| Senha | **senha de app** do Google (exige verificação em 2 etapas) | Chave SMTP do provedor |
| Sender email | o mesmo e-mail Gmail | ex.: `nao-responda@seudominio.com` |
| Sender name | `Vybelog` | `Vybelog` |

- Gmail: limite de cerca de 500 envios por dia e maior chance de cair no spam. Bom para testes e início.
- Domínio próprio: configure os registros SPF e DKIM indicados pelo provedor para não cair no spam.
- Depois, em **Authentication** > **Rate Limits**, ajuste "Rate limit for sending emails" conforme o volume.

### 2. Modelos em português
Em **Authentication** > **Emails** > **Templates**, cole o HTML de cada arquivo de `supabase/email-templates/` e use o assunto indicado no comentário do topo:

| Modelo no Supabase | Arquivo |
|---|---|
| Confirm signup | `confirmar-cadastro.html` |
| Invite user | `convidar-usuario.html` |
| Magic Link | `link-de-acesso.html` |
| Change Email Address | `alterar-email.html` |
| Reset Password | `redefinir-senha.html` |
| Reauthentication | `reautenticacao.html` |

Em **Security notifications** (mesma página), ative cada aviso e cole o modelo:

| Aviso no Supabase | Arquivo |
|---|---|
| Password changed | `aviso-senha-alterada.html` |
| Email address changed | `aviso-email-alterado.html` |
| MFA method added | `aviso-mfa-adicionado.html` |
| MFA method removed | `aviso-mfa-removido.html` |

Os avisos de telefone e de identidade vinculada não se aplicam: o app não usa login por telefone nem por redes sociais.

### 3. Notificações por e-mail (próxima etapa)
Curtidas, comentários, pedidos de conexão e de cofre já geram linhas na tabela `notifications`. Enviá-las por e-mail exige uma Edge Function acionada por Database Webhook, usando a API do mesmo provedor de e-mail.

---

## 🚀 Publicação no GitHub Pages

O workflow `.github/workflows/deploy.yml` verifica os tipos, compila o app e publica a pasta `dist` a cada push na branch `vybe.main` (ou manualmente pela aba **Actions** > **Run workflow**).

Configuração única no repositório:
1. **Settings** > **Pages** > **Build and deployment** > **Source**: selecione **GitHub Actions**.
2. **Settings** > **Pages** > **Custom domain**: `vybelog.com.br`, depois marque **Enforce HTTPS**.
3. No Supabase, siga a seção "Configurar Redirecionamentos de Autenticação".

### Domínio vybelog.com.br (Registro.br > DNS > Editar zona)
| Tipo | Nome | Valor |
|---|---|---|
| A | (vazio) | `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153` (um registro para cada) |
| AAAA | (vazio) | `2606:50c0:8000::153`, `2606:50c0:8001::153`, `2606:50c0:8002::153`, `2606:50c0:8003::153` |
| CNAME | www | `tomsilvaconsignado-ai.github.io` |
| TXT | `_github-pages-challenge-tomsilvaconsignado-ai` | código mostrado pelo GitHub ao verificar o domínio |

O site fica em `https://vybelog.com.br/` (o endereço antigo `tomsilvaconsignado-ai.github.io/vybe/` redireciona para ele). O `base: './'` do Vite e o `public/404.html` evitam tela branca em subpastas e ao recarregar a página.

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
- **Privacidade de Localização:** O usuário escolhe entre exibir a cidade, uma região aproximada (só o estado) ou ocultar a localização. A regra é aplicada no banco: a localização real fica em `profile_private` e outros usuários só recebem a versão mascarada.
- **Fotos sem metadados:** Antes do envio, o app redesenha as imagens para remover GPS e outros dados EXIF. Fotos e mídias só são aceitas quando vêm do Storage do próprio app, o que impede links externos de rastrear o IP de quem visualiza.
- **Bloqueio:** Quem bloqueia some para o bloqueado, que não consegue seguir, pedir conexão, enviar mensagens nem pedir acesso a cofres. A pessoa bloqueada não é avisada.
- **Pedido de conversa:** Até o aceite, quem inicia a conversa só envia uma mensagem de texto. Recusar arquiva a conversa sem permitir um novo pedido. Mensagens não podem ser apagadas, para preservar evidências em caso de denúncia.
- **Discrição:** Listas de seguidores, conexões, curtidas, membros de comunidades e presença em eventos são privadas (aparecem só os totais). No modo discreto, outras pessoas veem apenas o dia da última atividade. O botão de saída rápida (ou Esc duas vezes) troca a página por um site neutro.
- **Direito do Titular:** O usuário pode exportar todos os seus dados em formato JSON (Art. 18 da LGPD) ou solicitar a exclusão irrevogável da conta nas Configurações.
- **Moderação Não-Invasiva:** Não existe leitura silenciosa ou indiscriminada de mensagens de usuários; inspeções técnicas ocorrem estritamente sob denúncia formal fundamentada e auditada em log. O mesmo vale para os cofres: a moderação só abre uma mídia privada que tenha denúncia em aberto. Toda alteração de moderação passa por funções que exigem justificativa e registram no livro de auditoria; não há edição direta das tabelas pela equipe.

---
**Vybelog — Sua conexão. Suas regras.**
Todos os direitos reservados.
