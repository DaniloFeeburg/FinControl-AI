# FinControl AI 🚀

> SaaS de Gestão Financeira Pessoal com Inteligência Artificial e Projeções Futuras.

![Status](https://img.shields.io/badge/Status-Em_Desenvolvimento-emerald)
![Stack](https://img.shields.io/badge/Stack-React_|_TypeScript_|_Supabase_|_Python-blue)
![Deploy](https://img.shields.io/badge/Deploy-Google_Cloud-orange)

O **FinControl AI** é uma aplicação web moderna para controle financeiro que vai além do básico. Ele utiliza um motor de recorrência inteligente para projetar seu fluxo de caixa futuro e integra a IA do Google Gemini para oferecer insights personalizados sobre sua saúde financeira.

---

## ✨ Funcionalidades Principais

### 📊 Dashboard Inteligente
- **Visão 360º:** Cards de KPI para Patrimônio Total, Saldo Disponível (Líquido de Reservas) e Total em Metas.
- **Gráficos Interativos:** Despesas por Categoria (Pizza), Comparativo Semestral Receita x Despesa (Barras) e Fluxo de Caixa Projetado (Área).
- **Consultor IA:** Integração com **Google Gemini** para analisar seus dados e dar dicas de economia em tempo real.

### 💰 Gestão de Transações
- Controle completo de Receitas e Despesas.
- Filtragem por tipo e categorias personalizáveis.
- Interface ágil para adição e edição de lançamentos.

### 🔄 Motor de Recorrência (Subscription Engine)
- Cadastro de contas fixas (Aluguel, Streaming, Salário).
- **Projeção Automática:** O sistema calcula o impacto dessas regras no seu saldo futuro para os próximos 6 meses.

### 🎯 Módulo de Reservas (Metas)
- Sistema de "Envelopes" virtuais: Separe dinheiro para objetivos (ex: Viagem, Carro) sem criar múltiplas contas bancárias.
- **Simulador de Impacto:** Ao criar uma meta, o app calcula quanto você precisa poupar por mês e se isso cabe no seu orçamento atual.
- **Extrato de Reserva:** Histórico detalhado de aportes e retiradas de cada meta.

---

## 🛠️ Tech Stack

**Frontend:**
- **Core:** React 19, TypeScript.
- **Estilização:** Tailwind CSS (Dark Mode nativo).
- **Componentes:** UI inspirada no Shadcn (Radix primitives).
- **Gráficos:** Recharts.
- **Estado:** Zustand (Gerenciamento global de estado).
- **IA:** Google GenAI SDK.

**Backend & Dados:**
- **Banco de Dados:** PostgreSQL (via Supabase).
- **Scripts de Controle:** Python 3 + Psycopg2 (Automação de Schema e Migrations).

**Infraestrutura:**
- **Container:** Docker (Nginx Alpine).
- **CI/CD:** Google Cloud Build.
- **Hospedagem:** Google Cloud Run.

---

## 🚀 Como Executar o Projeto Localmente

### Pré-requisitos
- Node.js (v18+)
- Python (v3.9+)
- Conta no Google AI Studio (para API Key do Gemini)
- Connection String do Supabase

### 1. Configuração do Banco de Dados
O projeto possui um script Python automatizado para criar toda a estrutura de tabelas necessária no Supabase.

1. Navegue até a pasta `backend`:
   ```bash
   cd backend
   ```

2. Instale as dependências Python:
   ```bash
   pip install -r requirements.txt
   ```

3. Configure a conexão no arquivo `init_db.py` (ou via variável de ambiente) e execute o script:
   ```bash
   python init_db.py
   ```

### 2. Configuração do Frontend

1. Instale as dependências:
   ```bash
   npm install
   ```

2. Crie um arquivo `.env` na raiz com sua chave API (ver `.env.example`):
   ```env
   VITE_API_KEY=sua_chave_aqui
   ```

3. Inicie o servidor:
   ```bash
   npm run dev
   ```

---

## 🔑 Usuário Demo

Para testes rápidos, o sistema cria automaticamente um usuário de demonstração se executado em ambiente de desenvolvimento (ou quando `init_tables.py` é invocado).

- **Email:** `demo@fincontrol.ai`
- **Senha:** `demo123`

> **Nota:** O sistema implementa isolamento estrito de dados (multitenancy lógico). Cada usuário vê apenas seus próprios dados (Categorias, Transações, Reservas, etc.), garantido pelo `user_id` em todas as tabelas e filtros automáticos no backend.

---

## ☁️ Tutorial: Configurando CI/CD no Google Cloud

Este guia explica como configurar o **deploy automático** (CI/CD) usando GitHub Actions ou Google Cloud Build para o Cloud Run.

### 1. Preparação no Google Cloud Platform (GCP)
1. Crie um projeto no console do Google Cloud.
2. Ative as seguintes APIs:
   - **Cloud Build API**
   - **Cloud Run API**
   - **Artifact Registry API**

### 2. Criar Repositório no Artifact Registry
É aqui que as imagens Docker do seu site ficarão armazenadas.

1. No console GCP, vá para **Artifact Registry**.
2. Clique em **Criar Repositório**.
3. **Nome:** `fincontrol-repo` (deve ser igual ao definido no `cloudbuild.yaml`).
4. **Formato:** Docker.
5. **Região:** `us-central1` (ou a de sua preferência).
6. Clique em **Criar**.

### 3. Conectar Repositório do GitHub ao Cloud Build
1. No console GCP, vá para **Cloud Build** > **Gatilhos (Triggers)**.
2. Clique em **Criar Gatilho**.
3. **Nome:** `fincontrol-deploy`.
4. **Evento:** Push para um branch.
5. **Fonte:** Conecte seu repositório do GitHub e selecione o branch `main` (ou master).
6. **Configuração:** Arquivo de configuração do Cloud Build (yaml ou json).
7. **Localização:** `/cloudbuild.yaml` (já incluído no projeto).
8. Clique em **Criar**.

### 4. Ajustar Permissões (IAM)
O Cloud Build precisa de permissão para fazer deploy no Cloud Run.

1. Vá para **Configurações** do Cloud Build.
2. Localize a conta de serviço do Cloud Build (ex: `xxxx@cloudbuild.gserviceaccount.com`).
3. Certifique-se de que ela tenha as funções:
   - *Cloud Run Admin*
   - *Service Account User*

### 5. Executar o Deploy
Agora, qualquer `git push` para o branch `main` disparará o processo:
1. O Cloud Build lê o `cloudbuild.yaml`.
2. Cria a imagem Docker usando o `Dockerfile`.
3. Envia a imagem para o Artifact Registry.
4. Atualiza o serviço no Cloud Run com a nova versão.

Você receberá uma URL pública (ex: `https://fincontrol-ai-xxxxx-uc.a.run.app`) onde sua aplicação estará rodando segura (HTTPS) e escalável.

---

## 📂 Estrutura do Projeto

```text
/
├── backend/               # Scripts Python para gestão do DB
├── src/
│   ├── components/        # Componentes UI
│   ├── pages/             # Páginas da aplicação
│   ├── store.ts           # Estado Global (Zustand)
│   ├── types.ts           # Tipos TypeScript
│   └── utils/             # Lógica de negócio
├── cloudbuild.yaml        # Pipeline CI/CD GCP
├── Dockerfile             # Definição do Container
├── nginx.conf             # Configuração do Servidor Web
└── init_db.py             # Script de Banco de Dados
```

---

## 🧠 Como funciona a Projeção?

A lógica de projeção está localizada em `src/utils/projection.ts`. Ela funciona da seguinte maneira:
1. Pega o **Saldo Atual**.
2. Aplica um decaimento diário estimado (gastos variáveis de dia a dia).
3. Itera dia a dia pelos próximos 180 dias.
4. Verifica as **Regras de Recorrência** (ex: todo dia 5 cai salário, todo dia 10 paga aluguel).
5. Soma ou subtrai esses valores na linha do tempo.
6. Gera o gráfico de área verde no Dashboard.

---

## 🛡️ Licença

Este projeto é desenvolvido para fins educacionais e de portfólio. Sinta-se livre para usar e modificar.

---

Desenvolvido com 💻 e ☕.