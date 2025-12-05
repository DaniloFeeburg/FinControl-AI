# FinControl AI

O **FinControl AI** é uma aplicação completa para gestão de finanças pessoais, desenvolvida para oferecer controle total sobre receitas, despesas, orçamentos e metas financeiras. O sistema é construído com foco em privacidade (isolamento de dados por usuário), segurança (autenticação JWT) e usabilidade.

## 📋 Visão Geral

O aplicativo permite que usuários gerenciem suas finanças através de um painel intuitivo. As principais funcionalidades incluem o registro de transações, organização por categorias personalizáveis, definição de regras recorrentes e gestão de reservas financeiras (metas).

## 🚀 Tecnologias Utilizadas

A aplicação utiliza uma arquitetura moderna e escalável:

*   **Frontend:** React (Vite), TypeScript, TailwindCSS, Zustand (Gerenciamento de Estado).
*   **Backend:** Python (FastAPI), SQLAlchemy (ORM), Pydantic (Validação), Python-Jose (JWT).
*   **Banco de Dados:** PostgreSQL (Supabase).
*   **Infraestrutura:** Docker, Nginx (Reverse Proxy), Google Cloud Run.

## 🛠️ Funcionalidades Detalhadas

### 1. Autenticação e Segurança
*   **Registro e Login:** Usuários podem criar contas com nome, email e senha.
*   **JWT (JSON Web Token):** A autenticação é gerenciada via tokens JWT (algoritmo HS256) com validade de 7 dias.
*   **Isolamento de Dados:** Todos os recursos (transações, categorias, reservas) são estritamente vinculados ao ID do usuário (`user_id`), garantindo que um usuário nunca acesse dados de outro.
*   **Validações:**
    *   **Email:** Validação de formato via Regex.
    *   **Senha:** Mínimo de 6 caracteres, máximo de 72 bytes (limitação do bcrypt). Senhas são armazenadas como hash seguro.

### 2. Gestão de Transações
O núcleo do sistema é o registro de movimentações financeiras.
*   **Propriedades:** Valor, Data, Descrição, Categoria, Status (Pago/Pendente).
*   **Cálculos:**
    *   **Saldo Total:** Soma de todas as transações (Receitas - Despesas). *Nota: O sistema espera que despesas sejam registradas com valores negativos ou processadas conforme a lógica de entrada.*
    *   As transações são ordenadas por data (mais recentes primeiro).

### 3. Categorias
Permite classificar as transações para melhor análise.
*   **Tipos:** Receita (Income) ou Despesa (Expense).
*   **Atributos:** Nome, Cor, Ícone, e se é uma despesa Fixa ou Variável.
*   **Regra de Negócio:** Categorias são criadas especificamente para cada usuário, permitindo personalização total.

### 4. Regras Recorrentes (Recurring Rules)
Funcionalidade para registrar despesas ou receitas que se repetem.
*   **Estrutura:** Define Categoria, Valor, Descrição e a Regra de Recorrência (RRule string).
*   **Funcionamento:** Atualmente, o sistema permite o cadastro e armazenamento dessas regras para referência e planejamento futuro.

### 5. Reservas (Metas Financeiras)
Uma ferramenta poderosa para separar dinheiro do saldo principal para objetivos específicos (ex: Viagem, Fundo de Emergência).
*   **Atributos:** Nome, Valor Alvo (Meta), Valor Atual, Prazo (Deadline).
*   **Histórico:** O sistema rastreia depósitos e saques em cada reserva.
*   **Impacto no Saldo:**
    *   **Saldo Disponível:** Calculado como `Saldo Total - Total em Reservas`. Isso ajuda o usuário a saber quanto dinheiro realmente pode gastar sem comprometer suas metas.

### 6. Relatórios e Gráficos

O sistema oferece visualizações avançadas para análise financeira:

*   **Fluxo de Caixa Projetado (180 Dias):**
    *   **Objetivo:** Prever o saldo futuro com base no saldo atual e regras recorrentes.
    *   **Lógica:** O algoritmo projeta o saldo dia a dia para os próximos 6 meses.
    *   **Fatores Considerados:**
        *   Saldo Inicial (Atual).
        *   **Regras Recorrentes:** Receitas e Despesas fixas cadastradas são aplicadas automaticamente nos dias de vencimento (`BYMONTHDAY`).
        *   **Gastos Variáveis Estimados:** O sistema aplica uma redução linear diária (ex: R$ 20,00/dia) para simular gastos cotidianos não previstos (alimentação, transporte, etc).
    *   **Visualização:** Gráfico de área mostrando a tendência de crescimento ou redução do patrimônio ao longo do tempo.

*   **Gráfico de Receitas vs. Despesas (6 Meses):**
    *   **Objetivo:** Comparar o desempenho financeiro mês a mês.
    *   **Janela de Tempo:** Últimos 6 meses (incluindo o mês atual).
    *   **Agregação:** As transações são agrupadas por mês e separadas em:
        *   **Receitas (Income):** Soma de transações positivas.
        *   **Despesas (Expense):** Soma do valor absoluto de transações negativas.
    *   **Visualização:** Gráfico de barras lado a lado para fácil comparação visual de superávit ou déficit mensal.

*   **Análise Inteligente (IA):**
    *   Integração opcional com Google Gemini para gerar insights financeiros personalizados baseados nos dados atuais do usuário (Saldo, Gastos, Metas).

## 📐 Cálculos e Regras de Negócio

### Cálculo de Saldos
O sistema apresenta dois tipos de saldo para o usuário:

1.  **Saldo Geral (Total Balance):**
    *   Fórmula: `∑ (Todas as Transações)`
    *   Representa todo o dinheiro que o usuário possui, incluindo o que já foi separado para reservas.

2.  **Saldo Disponível (Available Balance):**
    *   Fórmula: `Saldo Geral - ∑ (Valor Atual de Todas as Reservas)`
    *   Representa o valor livre para gastos do dia a dia, excluindo o montante comprometido com metas.

### Validações de Entrada
*   **API (Backend):** O backend utiliza Pydantic para garantir que todos os dados recebidos (ex: criar transação) estejam no formato correto antes de processar.
*   **Frontend:** O gerenciamento de estado via Zustand intercepta respostas 401 (Não Autorizado) e realiza logout automático, protegendo a sessão.

## 🐳 Executando o Projeto

### Pré-requisitos
*   Docker e Docker Compose instalados.

### Passos para Rodar Localmente

1.  **Construir a Imagem:**
    ```bash
    docker build -t fincontrol .
    ```

2.  **Executar o Container:**
    ```bash
    docker run -p 8080:8080 -e DATABASE_URL="sua_string_de_conexao_postgres" fincontrol
    ```
    *Nota: Se a variável `DATABASE_URL` não for fornecida, o sistema tentará usar uma conexão padrão (não recomendado para produção).*

3.  **Acessar:**
    Abra o navegador em `http://localhost:8080`.

### Estrutura do Container
O container Docker segue uma abordagem *multi-stage*:
1.  **Frontend Build:** Compila o React/Vite para arquivos estáticos.
2.  **Backend Setup:** Instala dependências Python.
3.  **Runtime (Final):** Utiliza Nginx para servir o frontend estático e fazer proxy reverso das chamadas de API (`/api/`) para o servidor Uvicorn (FastAPI) rodando em background.

## 📂 Estrutura de Arquivos

*   `backend/`: Código fonte da API (Python/FastAPI).
    *   `models.py`: Modelos do banco de dados (SQLAlchemy).
    *   `schemas.py`: Schemas de validação (Pydantic).
    *   `crud.py`: Lógica de banco de dados.
    *   `auth.py`: Autenticação e segurança.
*   `src/` (root no frontend): Código fonte do Frontend (React).
    *   `store.ts`: Gerenciamento de estado global e lógica de negócios do frontend.
    *   `App.tsx`: Roteamento e layout principal.
    *   `components/`: Componentes de UI reutilizáveis.
