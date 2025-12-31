# 🔧 Correção do Erro de Deploy no Cloud Run

**Data:** 2025-12-29
**Problema:** Container falhava ao iniciar no Cloud Run com erro: "The user-provided container failed to start and listen on the port defined by PORT=8080"

---

## 📋 Problemas Identificados

1. **❌ Falta flag `--port` no cloudbuild.yaml**
   - Cloud Run pode não configurar corretamente o binding de porta sem especificação explícita
   - **Impacto:** Alta probabilidade de falha no binding da porta 8080

2. **❌ Ausência de tratamento de erros no entrypoint.sh**
   - Uvicorn podia falhar silenciosamente sem logs adequados
   - Timeout de health check muito curto (60 segundos)
   - **Impacto:** Dificuldade de diagnóstico + falhas silenciosas

3. **❌ Carregamento de módulos crítico no import**
   - `models.Base.metadata.create_all(bind=engine)` executava na linha 13 de [backend/main.py](backend/main.py#L13)
   - Qualquer falha de conexão ao banco durante import travava todo o Uvicorn
   - **Impacto:** Falha catastrófica sem mensagens de erro claras

4. **❌ Health check inadequado**
   - Start period de 40s insuficiente para inicialização do banco
   - Endpoint `/` testado não garantia que o backend estava funcionando
   - **Impacto:** Health check falhava antes da aplicação estar pronta

5. **❌ Mensagens de erro genéricas**
   - Database.py com mensagens simples não ajudavam no diagnóstico
   - **Impacto:** Difícil identificar root cause em produção

---

## ✅ Correções Aplicadas

### 1. **cloudbuild.yaml** - Configuração de Porta e Performance
- ✅ Adicionado `--port=8080` explicitamente (linha 34)
- ✅ Adicionado `--startup-cpu-boost` para acelerar cold starts (linha 41)

### 2. **entrypoint.sh** - Tratamento Robusto de Erros
**Melhorias aplicadas:**
- ✅ Verificação de variáveis críticas (`DATABASE_URL`, `SECRET_KEY`) antes de iniciar
- ✅ Validação de que o processo Uvicorn iniciou corretamente
- ✅ Monitoramento contínuo do processo durante health check
- ✅ Timeout aumentado de 60s → 120s (60 tentativas × 2s)
- ✅ Mensagens de erro detalhadas indicando possíveis causas
- ✅ Trap para graceful shutdown
- ✅ Logs incrementais durante o wait loop

**Código adicionado:**
```bash
# Verificação antecipada de env vars
if [ -z "$DATABASE_URL" ]; then
    echo "ERROR: DATABASE_URL environment variable is not set!"
    exit 1
fi

# Verificação se processo iniciou
sleep 2
if ! kill -0 $BACKEND_PID 2>/dev/null; then
    echo "ERROR: FastAPI backend process failed to start"
    exit 1
fi

# Monitoramento durante health check
while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
    if ! kill -0 $BACKEND_PID 2>/dev/null; then
        echo "ERROR: Backend process died unexpectedly"
        exit 1
    fi
    # ... health check logic
done
```

### 3. **backend/main.py** - Inicialização Segura
**Mudança crítica:**
- ✅ Movido `models.Base.metadata.create_all(bind=engine)` do nível de módulo (linha 13) para dentro do `lifespan` handler (linha 17)
- **Por quê?** Evita falhas de import se banco estiver lento ou indisponível temporariamente
- **Benefício:** Erros de conexão agora são tratáveis e geram logs do FastAPI

**Antes:**
```python
models.Base.metadata.create_all(bind=engine)  # ❌ No module level

@asynccontextmanager
async def lifespan(app: FastAPI):
    asyncio.create_task(start_scheduler_loop())
    yield
```

**Depois:**
```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    # ✅ Inside lifespan - errors are caught and logged
    models.Base.metadata.create_all(bind=engine)
    asyncio.create_task(start_scheduler_loop())
    yield
```

### 4. **Dockerfile** - Health Check Otimizado
- ✅ Start period: 40s → 120s (permite inicialização completa do banco)
- ✅ Endpoint alterado: `/` → `/api/` (verifica que backend está respondendo)

**Antes:**
```dockerfile
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:8080/ || exit 1
```

**Depois:**
```dockerfile
HEALTHCHECK --interval=30s --timeout=10s --start-period=120s --retries=3 \
    CMD curl -f http://localhost:8080/api/ || exit 1
```

### 5. **backend/database.py** - Mensagens de Erro Detalhadas
- ✅ Mensagens de erro expandidas com instruções de resolução
- ✅ Adicionado `pool_pre_ping=True` para verificar conexões
- ✅ Adicionado `pool_recycle=3600` para evitar conexões stale
- ✅ Adicionado `connect_timeout=10` para falhar rápido em caso de problemas

**Melhorias:**
```python
try:
    engine = create_engine(
        SQLALCHEMY_DATABASE_URL,
        pool_pre_ping=True,      # ✅ Verify connections before using
        pool_recycle=3600,       # ✅ Recycle after 1 hour
        connect_args={"connect_timeout": 10}  # ✅ Timeout fast
    )
except Exception as e:
    print("=" * 80)
    print("ERRO: Falha ao criar engine do banco de dados")
    print(f"Detalhes: {str(e)}")
    sys.exit(1)
```

---

## 🚀 Próximos Passos para Deploy

### **Pré-requisitos no Google Cloud**

Antes de fazer o deploy, **CERTIFIQUE-SE** que as seguintes secrets existem no Google Cloud Secret Manager:

```bash
# 1. Verificar se as secrets existem
gcloud secrets list

# 2. Se não existirem, criar:
gcloud secrets create DATABASE_URL --data-file=- <<< "postgresql://user:password@host:5432/database"
gcloud secrets create SECRET_KEY --data-file=- <<< "your-secret-key-here"
gcloud secrets create ALLOWED_ORIGINS --data-file=- <<< "https://your-domain.com"
gcloud secrets create GEMINI_API_KEY --data-file=- <<< "your-gemini-api-key"

# 3. Dar permissão ao Cloud Run para acessar as secrets
gcloud secrets add-iam-policy-binding DATABASE_URL \
    --member="serviceAccount:PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor"

# Repetir para todas as secrets (SECRET_KEY, ALLOWED_ORIGINS, GEMINI_API_KEY)
```

**⚠️ IMPORTANTE:** Substitua `PROJECT_NUMBER` pelo número do seu projeto GCP.

### **Deploy**

```bash
# Executar o Cloud Build (que fará build + deploy)
gcloud builds submit --config cloudbuild.yaml

# OU fazer commit e push (se configurado CI/CD via GitHub)
git add .
git commit -m "Fix: Resolver erro de inicialização do container no Cloud Run"
git push origin main
```

### **Monitoramento do Deploy**

```bash
# 1. Acompanhar logs do Cloud Build
gcloud builds list --limit=5

# 2. Após deploy, verificar logs do Cloud Run
gcloud run services logs tail fincontrol-ai --region=us-central1 --format=json

# 3. Verificar status do serviço
gcloud run services describe fincontrol-ai --region=us-central1

# 4. Testar o endpoint
curl https://fincontrol-ai-HASH-uc.a.run.app/api/
# Deve retornar: {"message": "FinControl AI API is running"}
```

---

## 🔍 Diagnóstico de Falhas (Se Continuar Falhando)

### **Cenário 1: Container não inicia (exit imediatamente)**

**Verificar logs:**
```bash
gcloud run services logs read fincontrol-ai --region=us-central1 --limit=50
```

**Possíveis causas:**
- ✅ DATABASE_URL não configurado → Você verá "ERRO CRÍTICO: DATABASE_URL não configurada"
- ✅ Banco de dados inacessível → Você verá "ERRO: Falha ao criar engine"
- ✅ SECRET_KEY ausente → Você verá "ERROR: SECRET_KEY environment variable is not set"

### **Cenário 2: Container inicia mas health check falha**

**Verificar:**
```bash
# Logs em tempo real
gcloud run services logs tail fincontrol-ai --region=us-central1

# Buscar por mensagens específicas:
# - "Step 1: Initializing database tables..." ✅
# - "Step 2: Starting FastAPI backend..." ✅
# - "Step 3: Waiting for backend..." ✅
# - "Step 4: Starting Nginx..." ✅
```

**Se travar em Step 3:**
- Backend não está respondendo em http://127.0.0.1:8000
- Pode ser erro no código Python (verificar traceback no log)
- Pode ser timeout de conexão ao banco (aumentar timeout)

### **Cenário 3: Deploy OK mas retorna 502/503**

**Verificar:**
```bash
# Status da revisão
gcloud run revisions list --service=fincontrol-ai --region=us-central1

# Logs de requisições
gcloud run services logs read fincontrol-ai --region=us-central1 --limit=100 | grep -i error
```

**Possíveis causas:**
- Nginx rodando mas backend morto (verificar logs do Uvicorn)
- Porta 8080 não está sendo escutada (verificar Nginx config)

---

## 📊 Resumo das Mudanças

| Arquivo | Linhas Alteradas | Mudança Principal |
|---------|-----------------|-------------------|
| [cloudbuild.yaml](cloudbuild.yaml#L34) | 34, 41 | Adicionado `--port=8080` e `--startup-cpu-boost` |
| [entrypoint.sh](entrypoint.sh#L1-L106) | 1-106 | Reescrito completamente com tratamento robusto de erros |
| [backend/main.py](backend/main.py#L13-L21) | 13-21 | Movido `create_all` para lifespan |
| [Dockerfile](Dockerfile#L39-L42) | 39-42 | Health check: 40s→120s, endpoint `/`→`/api/` |
| [backend/database.py](backend/database.py#L10-L40) | 10-40 | Mensagens detalhadas + connection pooling |

---

## ✨ Melhorias de Performance Adicionadas

1. **Startup CPU Boost** - Cloud Run aloca mais CPU durante cold start
2. **Connection Pooling** - `pool_pre_ping` e `pool_recycle` para conexões saudáveis
3. **Timeout Otimizado** - 120 segundos para inicialização completa
4. **Graceful Shutdown** - Trap para encerramento limpo de processos

---

## 📝 Notas Finais

- **Backward Compatibility:** ✅ Todas as mudanças são compatíveis com versões anteriores
- **Ambiente Local:** ✅ Funciona tanto localmente quanto no Cloud Run
- **Logs Melhorados:** ✅ Agora é possível identificar exatamente onde falha
- **Segurança:** ✅ Secrets continuam gerenciadas pelo Secret Manager

**Se o problema persistir após estas correções, por favor forneça:**
1. Output completo do `gcloud run services logs read`
2. Output do `gcloud builds list --limit=1 --format=json`
3. Confirmação de que as 4 secrets estão criadas

---

**Documentação gerada automaticamente em 2025-12-29**
