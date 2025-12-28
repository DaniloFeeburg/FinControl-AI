# 🔐 Configuração de Secrets - FinControl-AI

Este guia explica como configurar os secrets necessários para o deploy automático via Google Cloud Build.

## ⚠️ IMPORTANTE

Os secrets devem ser criados **ANTES** do primeiro `git push` para a branch `main`, pois o Cloud Build tentará injetá-los durante o deploy.

---

## 📋 Secrets Obrigatórios

### 1. DATABASE_URL
String de conexão do PostgreSQL (Supabase ou Cloud SQL).

```bash
# Formato: postgresql://usuario:senha@host:porta/database
echo -n "postgresql://user:password@host.supabase.co:5432/postgres" | \
  gcloud secrets create DATABASE_URL --data-file=-
```

### 2. SECRET_KEY
Chave secreta para JWT (mínimo 32 caracteres).

```bash
# Gerar chave segura
python -c 'import secrets; print(secrets.token_urlsafe(32))'

# Criar secret (substitua pela chave gerada acima)
echo -n "SUA_CHAVE_GERADA_AQUI" | \
  gcloud secrets create SECRET_KEY --data-file=-
```

### 3. ALLOWED_ORIGINS
URLs permitidas para CORS.

**Se você NÃO tem domínio próprio:**

```bash
# Opção 1: Usar URL do Cloud Run (você precisará atualizar depois do primeiro deploy)
# Primeiro, faça o deploy inicial com localhost, depois atualize
echo -n "http://localhost:3000,http://localhost:8080" | \
  gcloud secrets create ALLOWED_ORIGINS --data-file=-

# Depois do primeiro deploy, pegue a URL do Cloud Run e atualize:
# Exemplo: https://fincontrol-ai-abc123-uc.a.run.app
echo -n "https://fincontrol-ai-abc123-uc.a.run.app" | \
  gcloud secrets versions add ALLOWED_ORIGINS --data-file=-
```

**Se você TEM domínio próprio:**

```bash
# Usar seus domínios
echo -n "https://seu-dominio.com,https://www.seu-dominio.com" | \
  gcloud secrets create ALLOWED_ORIGINS --data-file=-
```

### 4. GEMINI_API_KEY (Opcional)
Chave da API do Google Gemini para análise inteligente de IA.

```bash
# Se você NÃO vai usar a funcionalidade de IA, crie um secret vazio
echo -n "" | \
  gcloud secrets create GEMINI_API_KEY --data-file=-

# Se você VAI usar, obtenha a chave em: https://makersuite.google.com/app/apikey
echo -n "SUA_GEMINI_API_KEY" | \
  gcloud secrets create GEMINI_API_KEY --data-file=-
```

---

## 🔄 Fluxo Completo de Configuração

### Passo 1: Autenticar no Google Cloud

```bash
gcloud auth login
gcloud config set project SEU_PROJECT_ID
```

### Passo 2: Criar TODOS os Secrets

Execute os comandos acima para criar os 4 secrets obrigatórios.

### Passo 3: Verificar Secrets Criados

```bash
gcloud secrets list
```

Você deve ver:
- DATABASE_URL
- SECRET_KEY
- ALLOWED_ORIGINS
- GEMINI_API_KEY

### Passo 4: Dar Permissão ao Cloud Build

```bash
# Obter o número do projeto
PROJECT_NUMBER=$(gcloud projects describe $(gcloud config get-value project) --format="value(projectNumber)")

# Dar permissão ao Cloud Build para acessar secrets
gcloud projects add-iam-policy-binding $(gcloud config get-value project) \
  --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

### Passo 5: Fazer o Primeiro Deploy

```bash
git add .
git commit -m "Configuração inicial de segurança"
git push origin main
```

O Cloud Build detectará o push e iniciará o deploy automaticamente.

---

## 🔍 Como Atualizar um Secret

Se você precisar atualizar um secret (ex: trocar a senha do banco):

```bash
# Atualizar DATABASE_URL
echo -n "nova_connection_string" | \
  gcloud secrets versions add DATABASE_URL --data-file=-

# Fazer novo deploy para aplicar
git commit --allow-empty -m "Atualizar secrets"
git push origin main
```

---

## 📝 Solução para ALLOWED_ORIGINS sem Domínio

Como você não tem domínio próprio, siga este fluxo:

### 1ª Deploy (Inicial):

```bash
# Criar secret com localhost para desenvolvimento
echo -n "http://localhost:3000" | \
  gcloud secrets create ALLOWED_ORIGINS --data-file=-
```

### Após o 1º Deploy:

```bash
# Obter URL do Cloud Run
gcloud run services describe fincontrol-ai \
  --region us-central1 \
  --format 'value(status.url)'

# Atualizar ALLOWED_ORIGINS com a URL real
# Exemplo: https://fincontrol-ai-abc123-uc.a.run.app
echo -n "https://fincontrol-ai-abc123-uc.a.run.app" | \
  gcloud secrets versions add ALLOWED_ORIGINS --data-file=-

# Fazer novo deploy
git commit --allow-empty -m "Atualizar CORS com URL do Cloud Run"
git push origin main
```

---

## ✅ Checklist Antes do Deploy

- [ ] `DATABASE_URL` criado
- [ ] `SECRET_KEY` criado (mínimo 32 caracteres)
- [ ] `ALLOWED_ORIGINS` criado
- [ ] `GEMINI_API_KEY` criado (mesmo que vazio)
- [ ] Permissões do Cloud Build configuradas
- [ ] Arquivo `cloudbuild.yaml` atualizado com todos os secrets

---

## 🆘 Troubleshooting

### Erro: "Secret not found"

```bash
# Verificar se o secret existe
gcloud secrets describe SECRET_NAME

# Se não existir, criar
echo -n "valor" | gcloud secrets create SECRET_NAME --data-file=-
```

### Erro: "Permission denied"

```bash
# Dar permissão ao Cloud Build
PROJECT_NUMBER=$(gcloud projects describe $(gcloud config get-value project) --format="value(projectNumber)")
gcloud projects add-iam-policy-binding $(gcloud config get-value project) \
  --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

### Erro: "Application failed to start - DATABASE_URL não configurada"

Verifique se o secret foi criado corretamente:

```bash
gcloud secrets versions access latest --secret=DATABASE_URL
```

---

## 📞 Resumo

1. **CRIE** os 4 secrets antes de fazer push
2. **CONFIGURE** permissões do Cloud Build
3. **FAÇA** o primeiro deploy
4. **ATUALIZE** ALLOWED_ORIGINS com a URL do Cloud Run após o deploy
5. **FAÇA** novo deploy para aplicar

**Última atualização:** Dezembro 2025
