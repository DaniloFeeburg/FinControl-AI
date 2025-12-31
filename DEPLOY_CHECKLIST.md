# ✅ Checklist de Deploy - FinControl AI

Use este checklist antes de fazer deploy para garantir que tudo está configurado corretamente.

---

## 🔐 Pré-Deploy: Verificar Secrets no Google Cloud

### 1. Verificar se as secrets existem

```bash
gcloud secrets list --filter="name:(DATABASE_URL OR SECRET_KEY OR ALLOWED_ORIGINS OR GEMINI_API_KEY)"
```

**Esperado:** Você deve ver as 4 secrets listadas.

### 2. Se alguma secret estiver faltando, criar:

```bash
# DATABASE_URL (obrigatório)
echo "postgresql://user:password@host:5432/database" | gcloud secrets create DATABASE_URL --data-file=-

# SECRET_KEY (obrigatório)
echo "your-secret-key-here" | gcloud secrets create SECRET_KEY --data-file=-

# ALLOWED_ORIGINS (obrigatório)
echo "https://fincontrol-ai-HASH-uc.a.run.app,http://localhost:8080" | gcloud secrets create ALLOWED_ORIGINS --data-file=-

# GEMINI_API_KEY (opcional - para IA)
echo "your-gemini-api-key" | gcloud secrets create GEMINI_API_KEY --data-file=-
```

### 3. Dar permissões ao Cloud Run

```bash
# Obter o número do projeto
PROJECT_NUMBER=$(gcloud projects describe $(gcloud config get-value project) --format="value(projectNumber)")

# Dar permissão para acessar as secrets
for SECRET in DATABASE_URL SECRET_KEY ALLOWED_ORIGINS GEMINI_API_KEY; do
  gcloud secrets add-iam-policy-binding $SECRET \
    --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor"
done
```

---

## 🗄️ Banco de Dados: Verificar Conectividade

### 1. Testar conexão localmente (se possível)

```bash
# Se tiver psql instalado
psql "postgresql://user:password@host:5432/database" -c "SELECT 1;"
```

### 2. Verificar que o banco permite conexões do Cloud Run

- ✅ Se usando **Cloud SQL**: Certifique-se de que o Cloud Run tem permissão via Cloud SQL Proxy
- ✅ Se usando **banco externo**: Libere o IP do Cloud Run no firewall

---

## 🏗️ Build e Deploy

### Opção 1: Deploy Manual via Cloud Build

```bash
# Na raiz do projeto
gcloud builds submit --config cloudbuild.yaml
```

### Opção 2: Deploy via Git (se CI/CD configurado)

```bash
git add .
git commit -m "fix: Resolver erro de inicialização do container no Cloud Run"
git push origin main
```

---

## 🔍 Pós-Deploy: Verificação

### 1. Verificar se o deploy foi bem-sucedido

```bash
gcloud run services describe fincontrol-ai --region=us-central1 --format="value(status.url)"
```

**Esperado:** URL do serviço (ex: `https://fincontrol-ai-xyz-uc.a.run.app`)

### 2. Testar o endpoint da API

```bash
SERVICE_URL=$(gcloud run services describe fincontrol-ai --region=us-central1 --format="value(status.url)")
curl $SERVICE_URL/api/
```

**Esperado:**
```json
{"message":"FinControl AI API is running"}
```

### 3. Verificar logs em tempo real

```bash
gcloud run services logs tail fincontrol-ai --region=us-central1
```

**O que procurar:**
- ✅ `"Step 1: Initializing database tables..."`
- ✅ `"✓ Database initialization completed successfully"`
- ✅ `"Step 2: Starting FastAPI backend on port 8000..."`
- ✅ `"✓ FastAPI backend process started"`
- ✅ `"Step 3: Waiting for backend to be ready..."`
- ✅ `"✓ Backend is ready and responding!"`
- ✅ `"Step 4: Starting Nginx on port 8080..."`
- ✅ `"Container is ready to receive requests!"`

### 4. Testar autenticação (se necessário)

```bash
# Registrar usuário de teste
curl -X POST $SERVICE_URL/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123!","name":"Test User"}'
```

**Esperado:** Token de autenticação

---

## ❌ Se Algo Falhar

### Erro: "Container failed to start"

**1. Verificar logs completos:**
```bash
gcloud run services logs read fincontrol-ai --region=us-central1 --limit=100
```

**2. Procurar por:**
- `"ERROR: DATABASE_URL environment variable is not set"` → Secret não configurada
- `"ERROR: Database initialization failed"` → Problema de conexão com banco
- `"ERROR: Backend process died unexpectedly"` → Erro no código Python
- `"ERROR: Backend failed to start after 60 attempts"` → Timeout (banco muito lento)

### Erro: "502 Bad Gateway"

**Causa:** Nginx rodando mas backend não respondendo

**Verificar:**
```bash
# Logs do Uvicorn
gcloud run services logs read fincontrol-ai --region=us-central1 | grep -i uvicorn
```

### Erro: "Secret not found"

**Resolver:**
```bash
# Verificar qual secret está faltando no log, depois criar:
echo "value" | gcloud secrets create SECRET_NAME --data-file=-
```

---

## 🔄 Rollback (Se Necessário)

```bash
# Listar revisões
gcloud run revisions list --service=fincontrol-ai --region=us-central1

# Reverter para revisão anterior
gcloud run services update-traffic fincontrol-ai \
  --region=us-central1 \
  --to-revisions=fincontrol-ai-00XXX=100
```

---

## 📊 Monitoramento Contínuo

### Ver métricas de saúde

```bash
gcloud run services describe fincontrol-ai --region=us-central1 --format="yaml(status)"
```

### Configurar alertas (recomendado)

1. Acesse **Cloud Console → Cloud Run → fincontrol-ai → Metrics**
2. Configure alertas para:
   - ✅ Request latency > 5s
   - ✅ Error rate > 5%
   - ✅ Container instance count = 0

---

## 📝 Notas Importantes

- ⚡ **Cold Start:** Primeira requisição pode demorar até 120s (health check period)
- 🔄 **Auto-scaling:** Min instances = 0, Max instances = 10
- 💾 **Memory:** 1Gi alocado por container
- 🖥️ **CPU:** 1 vCPU + startup boost
- ⏱️ **Timeout:** 300 segundos (5 minutos)

---

**✅ Após passar por este checklist, seu deploy deve funcionar corretamente!**

Se precisar de ajuda, revise o arquivo [DEPLOY_FIX_SUMMARY.md](DEPLOY_FIX_SUMMARY.md) para detalhes técnicos das correções aplicadas.
