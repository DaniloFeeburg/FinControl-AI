# 🚀 Guia de Deploy no Google Cloud Run

Este documento fornece instruções detalhadas para configurar e fazer deploy do **FinControl-AI** no Google Cloud Run após as melhorias de segurança implementadas.

## 🎯 Métodos de Deploy

Este projeto suporta **2 métodos de deploy**:

1. **Deploy Automático via Cloud Build** (Recomendado) - Deploy automático a cada `git push origin main`
2. **Deploy Manual via CLI** - Build e deploy manuais usando Docker e gcloud CLI

> ⚡ **Recomendação:** Use o método automático (Cloud Build) que já está configurado no projeto.

---

## 📋 Pré-requisitos

1. **Google Cloud CLI instalado** ([Instalação](https://cloud.google.com/sdk/docs/install))
2. **Projeto no Google Cloud criado**
3. **Faturamento ativado no projeto**
4. **Cloud Build API habilitada**
5. **Banco de dados PostgreSQL** (Supabase ou Cloud SQL)
6. **Repositório GitHub conectado ao Cloud Build**

---

## 🔐 Passo 1: Configurar Variáveis de Ambiente (Secrets)

As seguintes variáveis de ambiente são **OBRIGATÓRIAS** e devem ser configuradas como secrets no Google Cloud:

### 1.1. Gerar SECRET_KEY

Execute o comando abaixo para gerar uma chave segura:

```bash
python -c 'import secrets; print(secrets.token_urlsafe(32))'
```

**Exemplo de saída:** `xB9vN2mK8pL4qR7sT1wV6yZ3aC5dE0fG1hJ4kM7nP9`

### 1.2. Criar Secrets no Google Cloud

```bash
# Autenticar no Google Cloud
gcloud auth login

# Definir o projeto
gcloud config set project SEU_PROJECT_ID

# Criar secret para DATABASE_URL
echo -n "postgresql://usuario:senha@host:5432/database" | \
  gcloud secrets create DATABASE_URL --data-file=-

# Criar secret para SECRET_KEY (use a chave gerada no passo 1.1)
echo -n "SUA_SECRET_KEY_GERADA" | \
  gcloud secrets create SECRET_KEY --data-file=-

# Criar secret para GEMINI_API_KEY (se usar análise de IA)
echo -n "SUA_GEMINI_API_KEY" | \
  gcloud secrets create GEMINI_API_KEY --data-file=-

# Criar secret para ALLOWED_ORIGINS
echo -n "https://seu-dominio.com,https://www.seu-dominio.com" | \
  gcloud secrets create ALLOWED_ORIGINS --data-file=-
```

### 1.3. Verificar Secrets Criados

```bash
gcloud secrets list
```

---

## 🏗️ Passo 2: Build e Push da Imagem Docker

### 2.1. Configurar Docker para Google Cloud

```bash
gcloud auth configure-docker
```

### 2.2. Build da Imagem

```bash
# Substitua PROJECT_ID pelo ID do seu projeto
export PROJECT_ID=seu-project-id
export IMAGE_NAME=fincontrol-ai
export TAG=latest

docker build -t gcr.io/$PROJECT_ID/$IMAGE_NAME:$TAG .
```

### 2.3. Push para Container Registry

```bash
docker push gcr.io/$PROJECT_ID/$IMAGE_NAME:$TAG
```

---

## ☁️ Passo 3: Deploy no Cloud Run

### 3.1. Deploy com Secrets

```bash
gcloud run deploy fincontrol-ai \
  --image gcr.io/$PROJECT_ID/$IMAGE_NAME:$TAG \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --port 8080 \
  --memory 512Mi \
  --cpu 1 \
  --timeout 300 \
  --set-secrets="DATABASE_URL=DATABASE_URL:latest,SECRET_KEY=SECRET_KEY:latest,GEMINI_API_KEY=GEMINI_API_KEY:latest,ALLOWED_ORIGINS=ALLOWED_ORIGINS:latest"
```

### 3.2. Parâmetros Explicados

- `--allow-unauthenticated`: Permite acesso público (autenticação é feita pela aplicação via JWT)
- `--port 8080`: Porta padrão do Cloud Run
- `--memory 512Mi`: Memória alocada (ajuste conforme necessidade)
- `--cpu 1`: CPUs alocadas
- `--timeout 300`: Timeout de 5 minutos para requisições longas
- `--set-secrets`: Injeta os secrets como variáveis de ambiente

### 3.3. Obter URL do Serviço

Após o deploy, o Cloud Run fornecerá uma URL:

```bash
gcloud run services describe fincontrol-ai \
  --region us-central1 \
  --format 'value(status.url)'
```

**Exemplo:** `https://fincontrol-ai-abc123-uc.a.run.app`

---

## 🗄️ Passo 4: Aplicar Índices no Banco de Dados

Após o primeiro deploy, execute o script de criação de índices:

### 4.1. Conectar ao Container

```bash
# Listar revisões
gcloud run revisions list --service fincontrol-ai --region us-central1

# Executar comando no container (substitua REVISION_NAME)
gcloud run services proxy fincontrol-ai --region us-central1
```

### 4.2. Executar Script de Índices

**Opção 1: Via Cloud Shell**

```bash
# Conectar ao banco diretamente
# (requer Cloud SQL Proxy se estiver usando Cloud SQL)

# Executar SQL diretamente
psql $DATABASE_URL -c "CREATE INDEX IF NOT EXISTS idx_transaction_user_date ON transactions (user_id, date);"
psql $DATABASE_URL -c "CREATE INDEX IF NOT EXISTS idx_transaction_user_category ON transactions (user_id, category_id);"
psql $DATABASE_URL -c "CREATE INDEX IF NOT EXISTS idx_transaction_user_card ON transactions (user_id, credit_card_id);"
psql $DATABASE_URL -c "CREATE INDEX IF NOT EXISTS idx_transaction_user_status ON transactions (user_id, status);"
psql $DATABASE_URL -c "CREATE INDEX IF NOT EXISTS idx_category_user_type ON categories (user_id, type);"
psql $DATABASE_URL -c "CREATE INDEX IF NOT EXISTS idx_recurring_user_active ON recurring_rules (user_id, active);"
psql $DATABASE_URL -c "CREATE INDEX IF NOT EXISTS idx_recurring_user_card ON recurring_rules (user_id, credit_card_id);"
psql $DATABASE_URL -c "CREATE INDEX IF NOT EXISTS idx_creditcard_user_active ON credit_cards (user_id, active);"
```

**Opção 2: Via Script Python (recomendado)**

```bash
# Criar um Cloud Run Job para executar o script uma vez
gcloud run jobs create add-indexes \
  --image gcr.io/$PROJECT_ID/$IMAGE_NAME:$TAG \
  --region us-central1 \
  --set-secrets="DATABASE_URL=DATABASE_URL:latest" \
  --command python \
  --args "-m,backend.add_indexes"

# Executar o job
gcloud run jobs execute add-indexes --region us-central1
```

---

## 🌐 Passo 5: Configurar Domínio Customizado (Opcional)

### 5.1. Mapear Domínio

```bash
gcloud run domain-mappings create \
  --service fincontrol-ai \
  --domain seu-dominio.com \
  --region us-central1
```

### 5.2. Configurar DNS

Adicione os registros fornecidos pelo Cloud Run no seu provedor de DNS (ex: Cloudflare, GoDaddy).

### 5.3. Atualizar ALLOWED_ORIGINS

```bash
# Atualizar secret com o novo domínio
echo -n "https://seu-dominio.com,https://www.seu-dominio.com" | \
  gcloud secrets versions add ALLOWED_ORIGINS --data-file=-

# Fazer novo deploy para aplicar
gcloud run deploy fincontrol-ai \
  --image gcr.io/$PROJECT_ID/$IMAGE_NAME:$TAG \
  --platform managed \
  --region us-central1 \
  --update-secrets="ALLOWED_ORIGINS=ALLOWED_ORIGINS:latest"
```

---

## 🔍 Passo 6: Monitoramento e Logs

### 6.1. Ver Logs em Tempo Real

```bash
gcloud run logs tail fincontrol-ai --region us-central1
```

### 6.2. Consultar Logs no Console

Acesse: [https://console.cloud.google.com/logs](https://console.cloud.google.com/logs)

Filtro recomendado:
```
resource.type="cloud_run_revision"
resource.labels.service_name="fincontrol-ai"
```

### 6.3. Configurar Alertas

```bash
# Exemplo: alerta para erros 5xx
gcloud logging metrics create error_5xx \
  --description="Erros 5xx no FinControl" \
  --log-filter='resource.type="cloud_run_revision" AND httpRequest.status>=500'
```

---

## 🔄 Passo 7: Deploy Automático (Cloud Build)

> ⚡ Este projeto já vem configurado com Cloud Build via arquivo `cloudbuild.yaml`

### 7.1. Conectar GitHub ao Cloud Build (Primeira vez)

1. Acesse: https://console.cloud.google.com/cloud-build/triggers
2. Clique em **"Conectar Repositório"**
3. Selecione **GitHub**
4. Autorize o acesso ao seu repositório
5. Selecione o repositório **FinControl-AI**

### 7.2. Criar Trigger de Deploy

```bash
gcloud builds triggers create github \
  --repo-name=FinControl-AI \
  --repo-owner=SEU_USUARIO_GITHUB \
  --branch-pattern="^main$" \
  --build-config=cloudbuild.yaml \
  --name=fincontrol-ai-deploy
```

### 7.3. Habilitar APIs Necessárias

```bash
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable artifactregistry.googleapis.com
```

### 7.4. Configurar Permissões do Cloud Build

```bash
# Obter número do projeto
PROJECT_NUMBER=$(gcloud projects describe $(gcloud config get-value project) --format="value(projectNumber)")

# Permissão para acessar secrets
gcloud projects add-iam-policy-binding $(gcloud config get-value project) \
  --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

# Permissão para deploy no Cloud Run
gcloud projects add-iam-policy-binding $(gcloud config get-value project) \
  --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
  --role="roles/run.admin"

# Permissão para usar service account
gcloud iam service-accounts add-iam-policy-binding \
  ${PROJECT_NUMBER}-compute@developer.gserviceaccount.com \
  --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser"
```

### 7.5. Deploy Automático

Após configurar os secrets (veja `SETUP_SECRETS.md`), basta fazer push:

```bash
git add .
git commit -m "Deploy automático"
git push origin main
```

O Cloud Build:
1. Detecta o push na branch `main`
2. Executa os passos do `cloudbuild.yaml`:
   - Cria repositório no Artifact Registry (se não existir)
   - Build da imagem Docker
   - Push para o Artifact Registry
   - Deploy no Cloud Run com os secrets configurados

### 7.6. Acompanhar o Deploy

```bash
# Ver builds em execução
gcloud builds list --ongoing

# Ver logs do último build
gcloud builds log $(gcloud builds list --limit=1 --format="value(id)")

# Ou acesse o console:
# https://console.cloud.google.com/cloud-build/builds
```

---

## 🔄 Passo 8: Deploy Manual (Opcional)

Se preferir fazer deploy manual sem Cloud Build:

### 8.1. Build e Push Manual

```bash
# Build nova versão
docker build -t gcr.io/$PROJECT_ID/$IMAGE_NAME:v2 .

# Push
docker push gcr.io/$PROJECT_ID/$IMAGE_NAME:v2

# Deploy
gcloud run deploy fincontrol-ai \
  --image gcr.io/$PROJECT_ID/$IMAGE_NAME:v2 \
  --region us-central1 \
  --set-secrets="DATABASE_URL=DATABASE_URL:latest,SECRET_KEY=SECRET_KEY:latest,ALLOWED_ORIGINS=ALLOWED_ORIGINS:latest,GEMINI_API_KEY=GEMINI_API_KEY:latest"
```

### 8.2. Alternativa: GitHub Actions

Caso prefira GitHub Actions ao invés de Cloud Build

Crie o arquivo `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Cloud Run

on:
  push:
    branches:
      - main

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v3
      
      - name: Authenticate to Google Cloud
        uses: google-github-actions/auth@v1
        with:
          credentials_json: ${{ secrets.GCP_SA_KEY }}
      
      - name: Set up Cloud SDK
        uses: google-github-actions/setup-gcloud@v1
      
      - name: Configure Docker
        run: gcloud auth configure-docker
      
      - name: Build and Push
        run: |
          docker build -t gcr.io/${{ secrets.GCP_PROJECT_ID }}/fincontrol-ai:${{ github.sha }} .
          docker push gcr.io/${{ secrets.GCP_PROJECT_ID }}/fincontrol-ai:${{ github.sha }}
      
      - name: Deploy to Cloud Run
        run: |
          gcloud run deploy fincontrol-ai \
            --image gcr.io/${{ secrets.GCP_PROJECT_ID }}/fincontrol-ai:${{ github.sha }} \
            --region us-central1 \
            --platform managed
```

**Configurar Secrets no GitHub:**
1. Vá em `Settings > Secrets and variables > Actions`
2. Adicione:
   - `GCP_PROJECT_ID`: ID do projeto Google Cloud
   - `GCP_SA_KEY`: JSON da Service Account com permissões de Cloud Run Admin

---

## ⚙️ Passo 8: Configurações Avançadas

### 8.1. Escalonamento Automático

```bash
gcloud run services update fincontrol-ai \
  --region us-central1 \
  --min-instances 0 \
  --max-instances 10 \
  --concurrency 80
```

### 8.2. Configurar Cloud SQL (se usar)

```bash
# Criar instância
gcloud sql instances create fincontrol-db \
  --database-version=POSTGRES_15 \
  --tier=db-f1-micro \
  --region=us-central1

# Criar banco
gcloud sql databases create fincontrol \
  --instance=fincontrol-db

# Criar usuário
gcloud sql users create fincontrol-user \
  --instance=fincontrol-db \
  --password=SUA_SENHA_SEGURA

# Conectar Cloud Run ao Cloud SQL
gcloud run services update fincontrol-ai \
  --region us-central1 \
  --add-cloudsql-instances PROJECT_ID:us-central1:fincontrol-db
```

### 8.3. Backup Automático (Cloud SQL)

```bash
gcloud sql instances patch fincontrol-db \
  --backup-start-time=02:00 \
  --enable-bin-log
```

---

## ✅ Checklist de Validação Pós-Deploy

- [ ] Aplicação responde em `https://SEU_URL/`
- [ ] Endpoint de health check funciona: `https://SEU_URL/api/`
- [ ] Registro de usuário funciona
- [ ] Login funciona e retorna token JWT
- [ ] Endpoints protegidos exigem autenticação
- [ ] Análise de IA funciona (se configurada)
- [ ] Logs estão sendo gerados corretamente
- [ ] Secrets estão protegidos (não aparecem nos logs)
- [ ] Índices do banco foram aplicados
- [ ] Performance está adequada (< 2s para requests principais)

---

## 🆘 Troubleshooting

### Erro: "DATABASE_URL não configurada"

**Solução:** Verifique se o secret foi criado e vinculado corretamente:

```bash
gcloud secrets versions access latest --secret=DATABASE_URL
```

### Erro: "SECRET_KEY deve ter pelo menos 32 caracteres"

**Solução:** Gere uma nova chave segura e atualize o secret:

```bash
python -c 'import secrets; print(secrets.token_urlsafe(32))' | \
  gcloud secrets versions add SECRET_KEY --data-file=-
```

### Erro 503: Service Unavailable

**Causas comuns:**
1. Container não inicia (verificar logs)
2. Healthcheck falha
3. Timeout de inicialização

**Solução:**

```bash
# Ver logs de inicialização
gcloud run logs tail fincontrol-ai --region us-central1 | grep ERROR

# Aumentar timeout se necessário
gcloud run services update fincontrol-ai \
  --region us-central1 \
  --timeout 600
```

### Performance Lenta

**Soluções:**
1. Verificar se índices foram aplicados
2. Aumentar recursos:

```bash
gcloud run services update fincontrol-ai \
  --region us-central1 \
  --memory 1Gi \
  --cpu 2
```

---

## 📊 Estimativa de Custos

### Cloud Run (estimativa mensal)

- **Uso baixo** (< 10.000 requisições/mês): **GRÁTIS** (dentro do free tier)
- **Uso médio** (100.000 requisições/mês): **~$5-10 USD**
- **Uso alto** (1.000.000 requisições/mês): **~$50-80 USD**

### Cloud SQL (alternativa ao Supabase)

- **db-f1-micro**: **~$7 USD/mês**
- **db-g1-small**: **~$25 USD/mês**

### Secrets Manager

- **Primeiros 6 secrets**: **GRÁTIS**
- **Acesso aos secrets**: **~$0.03 USD por 10.000 acessos**

**Total estimado para startup:** **$0-15 USD/mês** (usando Supabase free tier)

---

## 📞 Suporte

- **Documentação oficial:** [https://cloud.google.com/run/docs](https://cloud.google.com/run/docs)
- **Community:** [https://stackoverflow.com/questions/tagged/google-cloud-run](https://stackoverflow.com/questions/tagged/google-cloud-run)

---

**Última atualização:** Dezembro 2025  
**Versão:** 2.0 (Pós-Correções de Segurança)


