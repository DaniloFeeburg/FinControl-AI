# ⚡ Guia Rápido - Deploy Automático do FinControl-AI

> Este guia resume os passos essenciais para fazer o primeiro deploy com Cloud Build automático.

---

## 🎯 Objetivo

Configurar o projeto para que **cada `git push origin main` faça deploy automático** no Google Cloud Run.

---

## 📋 Pré-requisitos

- [ ] Projeto no Google Cloud criado
- [ ] Faturamento ativado
- [ ] Google Cloud CLI instalado
- [ ] Banco de dados PostgreSQL (Supabase ou Cloud SQL)

---

## 🚀 Passo a Passo (5 minutos)

### 1️⃣ Autenticar e Configurar Projeto

```bash
gcloud auth login
gcloud config set project SEU_PROJECT_ID
```

### 2️⃣ Habilitar APIs

```bash
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable artifactregistry.googleapis.com
gcloud services enable secretmanager.googleapis.com
```

### 3️⃣ Criar Secrets

```bash
# 1. DATABASE_URL
echo -n "postgresql://user:password@host:5432/database" | \
  gcloud secrets create DATABASE_URL --data-file=-

# 2. SECRET_KEY (gere uma chave primeiro)
python -c 'import secrets; print(secrets.token_urlsafe(32))'
echo -n "COLE_A_CHAVE_GERADA_AQUI" | \
  gcloud secrets create SECRET_KEY --data-file=-

# 3. ALLOWED_ORIGINS (use localhost por enquanto)
echo -n "http://localhost:3000" | \
  gcloud secrets create ALLOWED_ORIGINS --data-file=-

# 4. GEMINI_API_KEY (vazio se não usar IA)
echo -n "" | \
  gcloud secrets create GEMINI_API_KEY --data-file=-
```

### 4️⃣ Configurar Permissões do Cloud Build

```bash
PROJECT_NUMBER=$(gcloud projects describe $(gcloud config get-value project) --format="value(projectNumber)")

# Acesso aos secrets
gcloud projects add-iam-policy-binding $(gcloud config get-value project) \
  --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

# Deploy no Cloud Run
gcloud projects add-iam-policy-binding $(gcloud config get-value project) \
  --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
  --role="roles/run.admin"

# Usar service account
gcloud iam service-accounts add-iam-policy-binding \
  ${PROJECT_NUMBER}-compute@developer.gserviceaccount.com \
  --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser"
```

### 5️⃣ Conectar GitHub ao Cloud Build

**Opção A - Via Console (Mais Fácil):**
1. Acesse: https://console.cloud.google.com/cloud-build/triggers
2. Clique em **"Criar Gatilho"**
3. Selecione **GitHub** → Conectar repositório
4. Configure:
   - **Nome:** `fincontrol-ai-deploy`
   - **Repositório:** `seu-usuario/FinControl-AI`
   - **Branch:** `^main$`
   - **Tipo:** Cloud Build configuration file
   - **Localização:** `cloudbuild.yaml`
5. Salvar

**Opção B - Via CLI:**
```bash
gcloud builds triggers create github \
  --repo-name=FinControl-AI \
  --repo-owner=SEU_USUARIO_GITHUB \
  --branch-pattern="^main$" \
  --build-config=cloudbuild.yaml \
  --name=fincontrol-ai-deploy
```

### 6️⃣ Fazer o Primeiro Deploy

```bash
git add .
git commit -m "Configuração inicial - Deploy automático"
git push origin main
```

### 7️⃣ Acompanhar o Build

```bash
# Ver builds em tempo real
gcloud builds list --ongoing

# Ver logs
gcloud builds log $(gcloud builds list --limit=1 --format="value(id)")

# Ou acesse: https://console.cloud.google.com/cloud-build/builds
```

### 8️⃣ Obter URL da Aplicação

```bash
gcloud run services describe fincontrol-ai \
  --region us-central1 \
  --format 'value(status.url)'
```

**Exemplo de saída:** `https://fincontrol-ai-abc123-uc.a.run.app`

### 9️⃣ Atualizar ALLOWED_ORIGINS

Após obter a URL, atualize o secret:

```bash
# Substitua pela URL real do Cloud Run
echo -n "https://fincontrol-ai-abc123-uc.a.run.app" | \
  gcloud secrets versions add ALLOWED_ORIGINS --data-file=-

# Fazer novo deploy
git commit --allow-empty -m "Atualizar CORS"
git push origin main
```

---

## ✅ Checklist de Validação

Após o deploy, teste:

- [ ] Aplicação abre: `https://SEU_URL/`
- [ ] Health check: `https://SEU_URL/api/`
- [ ] Registro de usuário funciona
- [ ] Login funciona

---

## 🔄 Próximos Deploys

Após a configuração inicial, basta:

```bash
# Fazer alterações no código
git add .
git commit -m "Sua mensagem"
git push origin main

# Deploy acontece automaticamente!
```

---

## 📂 Arquivos Importantes

- [cloudbuild.yaml](cloudbuild.yaml) - Configuração do Cloud Build
- [SETUP_SECRETS.md](SETUP_SECRETS.md) - Guia detalhado de secrets
- [DEPLOYMENT.md](DEPLOYMENT.md) - Guia completo de deploy
- [env.example](env.example) - Template de variáveis

---

## 🆘 Troubleshooting Rápido

### Build falha com "Secret not found"
```bash
# Verificar se todos os secrets existem
gcloud secrets list

# Devem aparecer: DATABASE_URL, SECRET_KEY, ALLOWED_ORIGINS, GEMINI_API_KEY
```

### Build falha com "Permission denied"
```bash
# Reexecutar os comandos de permissão do Passo 4
```

### Aplicação não inicia
```bash
# Ver logs do Cloud Run
gcloud run logs tail fincontrol-ai --region us-central1

# Erros comuns:
# - DATABASE_URL inválida
# - SECRET_KEY com menos de 32 caracteres
```

### Aplicar índices no banco
```bash
# Conectar ao banco e executar
python -m backend.add_indexes
```

---

## 💰 Custos Estimados

- **Cloud Build:** 120 minutos/dia grátis
- **Cloud Run:** 2 milhões de requisições/mês grátis
- **Secrets Manager:** 6 secrets grátis
- **Artifact Registry:** 0.5GB grátis

**Custo mensal estimado:** $0-5 USD (dentro do free tier para startups)

---

## 📞 Documentação Completa

Para mais detalhes:
- **Secrets:** Ver [SETUP_SECRETS.md](SETUP_SECRETS.md)
- **Deploy:** Ver [DEPLOYMENT.md](DEPLOYMENT.md)
- **Alterações:** Ver [CHANGELOG.md](CHANGELOG.md)

---

**Última atualização:** Dezembro 2025
**Status:** ✅ Pronto para deploy automático
