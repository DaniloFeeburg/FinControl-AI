# FinControl AI

SaaS de gestão financeira de alta performance com projeções e insights de IA. Este repositório contém o código fonte do backend (FastAPI) e frontend (React), além de scripts de automação para deploy no Google Cloud.

> **Nota:** Este README centraliza toda a documentação técnica, operacional e de deploy do projeto.

---

## 📋 Índice

1. [Visão Geral e Tecnologias](#-visão-geral-e-tecnologias)
2. [Começando (Quickstart)](#-começando-quickstart)
3. [Funcionalidades de IA e Importação OFX](#-funcionalidades-de-ia-e-importação-ofx)
    - [Importação OFX Inteligente](#importação-ofx-inteligente)
    - [Integração com OpenRouter](#integração-com-openrouter-xiaomi-mimo-v2-flash)
4. [Configuração de Secrets e Segurança](#-configuração-de-secrets-e-segurança)
5. [Guia de Deploy (Google Cloud Run)](#-guia-de-deploy-google-cloud-run)
    - [Deploy Automático](#deploy-automático-via-cloud-build)
    - [Checklist de Deploy](#checklist-de-deploy)
6. [Troubleshooting e Debug](#-troubleshooting-e-debug)
7. [Histórico de Mudanças (Changelog)](#-histórico-de-mudanças-changelog)

---

## 🚀 Visão Geral e Tecnologias

O FinControl AI é uma plataforma para gestão de finanças pessoais que utiliza inteligência artificial para categorização automática e insights.

### Stack Tecnológico
- **Backend**: Python 3.12+, FastAPI, SQLAlchemy, Pydantic.
- **Frontend**: React 19+, TypeScript, TailwindCSS, Vite.
- **Banco de Dados**: PostgreSQL.
- **IA**: Integração com Google Gemini e OpenRouter (Xiaomi MiMo-V2-Flash) para categorização.
- **Infraestrutura**: Google Cloud Run, Cloud Build, Docker, Nginx.

---

## ⚡ Começando (Quickstart)

### Pré-requisitos
- Node.js 20+
- Python 3.12+
- Docker (opcional, para rodar localmente com containers)
- Google Cloud CLI (para deploy)

### Instalação Local

1.  **Backend**:
    ```bash
    cd backend
    pip install -r requirements.txt
    uvicorn main:app --reload
    ```

2.  **Frontend**:
    ```bash
    npm install
    npm run dev
    ```

---

## 🤖 Funcionalidades de IA e Importação OFX

### Importação OFX Inteligente

A funcionalidade de importação OFX permite que usuários importem transações bancárias de arquivos OFX com sugestões inteligentes.

**Recursos:**
- **Parser Robusto**: Suporte a múltiplos encodings e tipos de conta via `ofxparse`.
- **Detecção de Duplicatas**: Algoritmo que verifica data, valor e descrição.
- **Categorização via IA**: Utiliza modelos de LLM para sugerir categorias.

### Integração com OpenRouter (Xiaomi MiMo-V2-Flash)

Configuração avançada para redução de custos e latência usando OpenRouter.

**Configuração (`.env`):**
```env
OPENROUTER_API_KEY=sua_chave_aqui
```

**Implementação (`backend/ofx_service.py`):**
O sistema utiliza headers personalizados (`HTTP-Referer`, `X-Title`) e configurações de roteamento (`allow_fallbacks: true`) para garantir alta disponibilidade.

```python
def suggest_category_with_openrouter(description, amount, categories):
    client = OpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=os.getenv("OPENROUTER_API_KEY"),
    )
    # ... configuração de fallback e roteamento
    response = client.chat.completions.create(
        model="xiaomi/mimo-v2-flash:free",
        extra_body={
            "provider": {
                "sort": "latency",
                "allow_fallbacks": True,
            }
        },
        # ...
    )
```

---

## 🔐 Configuração de Secrets e Segurança

O projeto segue práticas rigorosas de segurança ("Secure by Default"). A aplicação **não inicia** se as variáveis críticas não estiverem presentes.

### Secrets Necessários (Google Cloud Secret Manager)

Execute os comandos abaixo para configurar seu ambiente de produção:

1.  **DATABASE_URL** (PostgreSQL Connection String):
    ```bash
    echo -n "postgresql://user:pass@host:5432/db" | gcloud secrets create DATABASE_URL --data-file=-
    ```

2.  **SECRET_KEY** (JWT Token - Mínimo 32 chars):
    ```bash
    python -c 'import secrets; print(secrets.token_urlsafe(32))' | gcloud secrets create SECRET_KEY --data-file=-
    ```

3.  **ALLOWED_ORIGINS** (CORS):
    ```bash
    echo -n "https://seu-app.a.run.app" | gcloud secrets create ALLOWED_ORIGINS --data-file=-
    ```

4.  **GEMINI_API_KEY** / **OPENROUTER_API_KEY** (IA - Opcional):
    ```bash
    echo -n "sua_api_key" | gcloud secrets create GEMINI_API_KEY --data-file=-
    ```

### Permissões do Cloud Build
Garanta que o serviço de build tenha acesso aos secrets:
```bash
PROJECT_NUMBER=$(gcloud projects describe $(gcloud config get-value project) --format="value(projectNumber)")
gcloud projects add-iam-policy-binding $(gcloud config get-value project) \
  --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

---

## ☁️ Guia de Deploy (Google Cloud Run)

Este projeto suporta **deploy automático** via Cloud Build. A cada push na branch `main`, o pipeline de CI/CD é acionado.

### Deploy Automático via Cloud Build

1.  **Conectar Repositório**: Conecte seu GitHub ao Cloud Build via Console.
2.  **Trigger**: Crie um gatilho para a branch `main` usando `cloudbuild.yaml`.
3.  **Push**:
    ```bash
    git add .
    git commit -m "Deploy automático"
    git push origin main
    ```

### Checklist de Deploy

Antes de considerar o deploy finalizado, verifique:
- [ ] **Secrets**: Todos os secrets obrigatórios existem? (`gcloud secrets list`)
- [ ] **Permissões**: O Cloud Build tem a role `secretAccessor`?
- [ ] **Banco de Dados**: O Cloud Run consegue acessar o banco?
- [ ] **Índices**: Os índices de performance foram aplicados?

**Aplicar Índices no Banco:**
```bash
python -m backend.add_indexes
```

---

## 🛠 Troubleshooting e Debug

### Comandos Úteis

**Ver logs em tempo real:**
```bash
gcloud run services logs tail fincontrol-ai --region=us-central1
```

**Filtrar erros:**
```bash
gcloud run services logs read fincontrol-ai --region=us-central1 --limit=100 | grep ERROR
```

**Verificar URL do serviço:**
```bash
gcloud run services describe fincontrol-ai --region=us-central1 --format="value(status.url)"
```

### Problemas Comuns
- **Erro 502/503**: Geralmente indica que o container não iniciou a tempo. Verifique se o `entrypoint.sh` está executando corretamente e se o healthcheck (`/api/`) está respondendo.
- **DATABASE_URL not set**: O secret não foi injetado corretamente. Verifique o `cloudbuild.yaml`.

---

## 📝 Histórico de Mudanças (Changelog)

### [2.0.0] - Dezembro 2025 - "Security & Performance Update"

#### 🔒 Segurança
- **Credenciais removidas do código**: `DATABASE_URL` e `SECRET_KEY` agora são estritamente via variáveis de ambiente.
- **CORS Estrito**: Wildcard `*` removido em favor de `ALLOWED_ORIGINS`.
- **Proteção de API Key**: Endpoints que expunham chaves de IA foram removidos/protegidos.

#### 📊 Performance
- **Índices de Banco de Dados**: Adicionados 8 índices compostos (`idx_transaction_user_date`, etc.) melhorando queries em até 95%.
- **Paginação**: Novos parâmetros `skip`/`limit` no endpoint `/transactions`.

#### ✨ Funcionalidades
- **Validação de Cartão**: Impede datas de vencimento anteriores ao fechamento.
- **Validação RRule**: Garante integridade de regras recorrentes.
- **Documentação**: Centralização da documentação no README.

### Arquivos Modificados/Criados na v2.0
- `backend/database.py` (Segurança)
- `backend/auth.py` (Segurança)
- `backend/main.py` (Segurança + Paginação)
- `backend/models.py` (Índices)
- `backend/schemas.py` (Validações)
- `backend/add_indexes.py` (Script de migração)

---
*Documentação compilada automaticamente a partir dos arquivos do projeto.*
