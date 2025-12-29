# 🔧 Comandos de Debug - Cloud Run

Comandos úteis para diagnosticar problemas no deploy do FinControl AI.

---

## 📋 Informações do Serviço

### Ver detalhes completos do serviço
```bash
gcloud run services describe fincontrol-ai --region=us-central1
```

### Ver URL do serviço
```bash
gcloud run services describe fincontrol-ai --region=us-central1 --format="value(status.url)"
```

### Listar todas as revisões
```bash
gcloud run revisions list --service=fincontrol-ai --region=us-central1
```

### Ver detalhes de uma revisão específica
```bash
gcloud run revisions describe REVISION_NAME --region=us-central1
```

---

## 📝 Logs e Monitoramento

### Logs em tempo real (tail)
```bash
gcloud run services logs tail fincontrol-ai --region=us-central1
```

### Ler últimos 100 logs
```bash
gcloud run services logs read fincontrol-ai --region=us-central1 --limit=100
```

### Filtrar logs por severidade
```bash
# Apenas erros
gcloud run services logs read fincontrol-ai --region=us-central1 --format="table(severity,timestamp,textPayload)" | grep ERROR

# Apenas warnings
gcloud run services logs read fincontrol-ai --region=us-central1 --format="table(severity,timestamp,textPayload)" | grep WARNING
```

### Buscar por palavras-chave nos logs
```bash
# Buscar por "DATABASE"
gcloud run services logs read fincontrol-ai --region=us-central1 --limit=200 | grep -i database

# Buscar por "ERROR"
gcloud run services logs read fincontrol-ai --region=us-central1 --limit=200 | grep -i error

# Buscar por startup messages
gcloud run services logs read fincontrol-ai --region=us-central1 --limit=200 | grep -i "step [1-4]"
```

### Ver logs de um período específico
```bash
# Últimas 2 horas
gcloud run services logs read fincontrol-ai --region=us-central1 --limit=500 --freshness=2h

# Últimas 24 horas
gcloud run services logs read fincontrol-ai --region=us-central1 --limit=1000 --freshness=24h
```

---

## 🏗️ Cloud Build

### Listar últimos builds
```bash
gcloud builds list --limit=10
```

### Ver detalhes de um build específico
```bash
BUILD_ID="your-build-id"
gcloud builds describe $BUILD_ID
```

### Ver logs de um build
```bash
BUILD_ID="your-build-id"
gcloud builds log $BUILD_ID
```

### Seguir build em tempo real
```bash
gcloud builds submit --config cloudbuild.yaml --stream-logs
```

---

## 🔐 Secrets

### Listar todas as secrets
```bash
gcloud secrets list
```

### Ver detalhes de uma secret
```bash
gcloud secrets describe DATABASE_URL
```

### Ver versões de uma secret
```bash
gcloud secrets versions list DATABASE_URL
```

### Ver valor de uma secret (CUIDADO!)
```bash
# Apenas para debug - não compartilhe este output!
gcloud secrets versions access latest --secret=DATABASE_URL
```

### Testar se Cloud Run tem acesso à secret
```bash
# Verificar IAM binding
gcloud secrets get-iam-policy DATABASE_URL
```

---

## 🐳 Container e Imagens

### Listar imagens no Artifact Registry
```bash
gcloud artifacts docker images list us-central1-docker.pkg.dev/$(gcloud config get-value project)/fincontrol-repo/fincontrol-ai
```

### Ver tags de uma imagem
```bash
gcloud artifacts docker tags list us-central1-docker.pkg.dev/$(gcloud config get-value project)/fincontrol-repo/fincontrol-ai
```

---

## 🔍 Testes de Conectividade

### Testar endpoint raiz
```bash
SERVICE_URL=$(gcloud run services describe fincontrol-ai --region=us-central1 --format="value(status.url)")
curl -v $SERVICE_URL/
```

### Testar API endpoint
```bash
SERVICE_URL=$(gcloud run services describe fincontrol-ai --region=us-central1 --format="value(status.url)")
curl -v $SERVICE_URL/api/
```

### Testar OpenAPI docs
```bash
SERVICE_URL=$(gcloud run services describe fincontrol-ai --region=us-central1 --format="value(status.url)")
curl -v $SERVICE_URL/api/docs
```

### Testar com headers detalhados
```bash
SERVICE_URL=$(gcloud run services describe fincontrol-ai --region=us-central1 --format="value(status.url)")
curl -v -H "User-Agent: Debug/1.0" $SERVICE_URL/api/
```

---

## ⚡ Configuração e Updates

### Atualizar variável de ambiente
```bash
gcloud run services update fincontrol-ai \
  --region=us-central1 \
  --set-env-vars="ENVIRONMENT=production"
```

### Atualizar secret
```bash
# Criar nova versão da secret
echo "new-value" | gcloud secrets versions add SECRET_NAME --data-file=-

# Force redeploy para pegar nova versão
gcloud run services update fincontrol-ai --region=us-central1
```

### Atualizar recursos (CPU/Memory)
```bash
gcloud run services update fincontrol-ai \
  --region=us-central1 \
  --memory=2Gi \
  --cpu=2
```

### Atualizar scaling
```bash
gcloud run services update fincontrol-ai \
  --region=us-central1 \
  --min-instances=1 \
  --max-instances=20
```

---

## 🔄 Rollback e Traffic Management

### Redirecionar 100% do tráfego para revisão específica
```bash
gcloud run services update-traffic fincontrol-ai \
  --region=us-central1 \
  --to-revisions=fincontrol-ai-00001=100
```

### Split de tráfego (canary deployment)
```bash
gcloud run services update-traffic fincontrol-ai \
  --region=us-central1 \
  --to-revisions=fincontrol-ai-00002=20,fincontrol-ai-00001=80
```

### Deletar revisão antiga
```bash
gcloud run revisions delete REVISION_NAME --region=us-central1
```

---

## 🗄️ Database Debug

### Testar conexão ao banco via Cloud Shell
```bash
# Obter DATABASE_URL
DATABASE_URL=$(gcloud secrets versions access latest --secret=DATABASE_URL)

# Se for PostgreSQL
psql "$DATABASE_URL" -c "SELECT version();"

# Testar conectividade
psql "$DATABASE_URL" -c "\dt"
```

### Ver tabelas do banco
```bash
DATABASE_URL=$(gcloud secrets versions access latest --secret=DATABASE_URL)
psql "$DATABASE_URL" -c "\dt"
```

---

## 📊 Métricas e Performance

### Ver métricas de CPU
```bash
gcloud monitoring time-series list \
  --filter='resource.type="cloud_run_revision" AND resource.labels.service_name="fincontrol-ai"' \
  --format=json
```

### Executar uma requisição e medir latência
```bash
SERVICE_URL=$(gcloud run services describe fincontrol-ai --region=us-central1 --format="value(status.url)")
time curl -s $SERVICE_URL/api/ > /dev/null
```

---

## 🧪 Debug Local (Docker)

### Build local da imagem
```bash
docker build -t fincontrol-ai:local .
```

### Rodar container localmente
```bash
docker run -p 8080:8080 \
  -e DATABASE_URL="postgresql://..." \
  -e SECRET_KEY="test-key" \
  -e ALLOWED_ORIGINS="http://localhost:8080" \
  fincontrol-ai:local
```

### Entrar no container em execução
```bash
docker exec -it CONTAINER_ID /bin/bash
```

### Ver logs do container local
```bash
docker logs CONTAINER_ID -f
```

---

## 🚨 Comandos de Emergência

### Forçar novo deploy (mesmo sem mudanças)
```bash
gcloud run services update fincontrol-ai \
  --region=us-central1 \
  --update-labels=deployed-at=$(date +%s)
```

### Deletar serviço completamente
```bash
gcloud run services delete fincontrol-ai --region=us-central1
```

### Recriar serviço do zero
```bash
gcloud builds submit --config cloudbuild.yaml
```

---

## 📋 Checklist de Debug Sistemático

Quando o deploy falhar, execute estes comandos nesta ordem:

```bash
# 1. Ver status atual
gcloud run services describe fincontrol-ai --region=us-central1

# 2. Ver últimos logs
gcloud run services logs read fincontrol-ai --region=us-central1 --limit=100

# 3. Procurar por erros
gcloud run services logs read fincontrol-ai --region=us-central1 --limit=200 | grep -i error

# 4. Verificar secrets
gcloud secrets list --filter="name:(DATABASE_URL OR SECRET_KEY)"

# 5. Verificar último build
gcloud builds list --limit=1

# 6. Testar endpoint
SERVICE_URL=$(gcloud run services describe fincontrol-ai --region=us-central1 --format="value(status.url)")
curl -v $SERVICE_URL/api/
```

---

## 💡 Dicas Úteis

1. **Sempre use `--region=us-central1`** - região do deploy
2. **Salve logs em arquivo** para análise detalhada:
   ```bash
   gcloud run services logs read fincontrol-ai --region=us-central1 --limit=500 > logs.txt
   ```
3. **Use `jq` para formatar JSON**:
   ```bash
   gcloud run services describe fincontrol-ai --region=us-central1 --format=json | jq
   ```
4. **Configure alias** para comandos frequentes:
   ```bash
   alias gcr-logs="gcloud run services logs tail fincontrol-ai --region=us-central1"
   alias gcr-status="gcloud run services describe fincontrol-ai --region=us-central1"
   ```

---

**📖 Para mais informações, consulte:**
- [DEPLOY_FIX_SUMMARY.md](DEPLOY_FIX_SUMMARY.md) - Detalhes das correções
- [DEPLOY_CHECKLIST.md](DEPLOY_CHECKLIST.md) - Checklist de deploy
