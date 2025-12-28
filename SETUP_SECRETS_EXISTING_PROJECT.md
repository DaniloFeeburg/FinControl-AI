# 🔐 Configuração de Secrets - Projeto Existente

> Para projetos que já estão em produção no Cloud Run

---

## ⚡ Situação Atual

Seu projeto **já está rodando** no Cloud Run, então você:
- ✅ Já tem a URL do serviço
- ✅ Já tem o trigger do Cloud Build configurado
- ✅ Já tem `DATABASE_URL` e `GEMINI_API_KEY` (provavelmente)
- ❌ Faltam apenas: `SECRET_KEY` e `ALLOWED_ORIGINS`

---

## 📋 Passo a Passo Simplificado

### 1️⃣ Verificar Secrets Existentes

```bash
gcloud auth login
gcloud config set project SEU_PROJECT_ID

# Listar secrets atuais
gcloud secrets list
```

**Você deve ver:**
- `DATABASE_URL` ✅ (já existe)
- `GEMINI_API_KEY` ✅ (já existe, pode estar vazio)
- `SECRET_KEY` ❌ (precisa criar)
- `ALLOWED_ORIGINS` ❌ (precisa criar)

---

### 2️⃣ Obter a URL Atual do Cloud Run

```bash
gcloud run services describe fincontrol-ai \
  --region us-central1 \
  --format 'value(status.url)'
```

**Copie essa URL!** Exemplo: `https://fincontrol-ai-abc123-uc.a.run.app`

---

### 3️⃣ Criar os Secrets Faltantes

#### A) Criar SECRET_KEY

```bash
# Gerar chave segura
python -c 'import secrets; print(secrets.token_urlsafe(32))'

# Copie a saída e crie o secret (substitua pela chave gerada)
echo -n "COLE_A_CHAVE_GERADA_AQUI" | \
  gcloud secrets create SECRET_KEY --data-file=-
```

#### B) Criar ALLOWED_ORIGINS

```bash
# Use a URL que você copiou no Passo 2
# Exemplo: https://fincontrol-ai-abc123-uc.a.run.app

echo -n "https://fincontrol-ai-abc123-uc.a.run.app" | \
  gcloud secrets create ALLOWED_ORIGINS --data-file=-
```

> **Dica:** Se você tem domínio customizado, use ele no lugar da URL do Cloud Run

---

### 4️⃣ Verificar Permissões do Cloud Build

Como o projeto já está rodando, provavelmente as permissões já estão OK, mas confirme:

```bash
PROJECT_NUMBER=$(gcloud projects describe $(gcloud config get-value project) --format="value(projectNumber)")

# Permissão para acessar secrets
gcloud projects add-iam-policy-binding $(gcloud config get-value project) \
  --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

---

### 5️⃣ Fazer Deploy das Alterações

Agora é só commitar as alterações e fazer push:

```bash
git add .
git commit -m "Adicionar validações de segurança e novos secrets"
git push origin main
```

O Cloud Build irá:
1. Detectar o push
2. Build da nova imagem com as alterações
3. Deploy automático com **todos os 4 secrets**

---

### 6️⃣ Acompanhar o Deploy

```bash
# Ver builds em tempo real
gcloud builds list --ongoing

# Ver logs do último build
gcloud builds log $(gcloud builds list --limit=1 --format="value(id)")

# Ou acesse o console
# https://console.cloud.google.com/cloud-build/builds
```

---

### 7️⃣ Validar Após Deploy

```bash
# Ver logs do Cloud Run
gcloud run logs tail fincontrol-ai --region us-central1

# Buscar por possíveis erros
gcloud run logs tail fincontrol-ai --region us-central1 | grep ERROR
```

**Teste na aplicação:**
- [ ] Aplicação abre normalmente
- [ ] Login funciona
- [ ] Não há erros de CORS
- [ ] Análise de IA funciona (se configurada)

---

## 🔍 Se Houver Problemas

### Erro: "SECRET_KEY não configurada"

O secret foi criado mas não está sendo injetado. Verifique se o `cloudbuild.yaml` foi atualizado:

```bash
cat cloudbuild.yaml | grep SECRET_KEY
```

Deve aparecer:
```
--set-secrets=DATABASE_URL=DATABASE_URL:latest,SECRET_KEY=SECRET_KEY:latest,ALLOWED_ORIGINS=ALLOWED_ORIGINS:latest,GEMINI_API_KEY=GEMINI_API_KEY:latest
```

### Erro de CORS

Se aparecer erro de CORS no frontend, verifique o valor do ALLOWED_ORIGINS:

```bash
gcloud secrets versions access latest --secret=ALLOWED_ORIGINS
```

Deve mostrar a URL correta do seu Cloud Run ou domínio customizado.

**Para atualizar:**
```bash
echo -n "https://SUA_URL_CORRETA" | \
  gcloud secrets versions add ALLOWED_ORIGINS --data-file=-

# Fazer novo deploy
git commit --allow-empty -m "Atualizar CORS"
git push origin main
```

### Aplicação não inicia

Veja os logs detalhados:
```bash
gcloud run logs tail fincontrol-ai --region us-central1 --limit=100
```

Procure por:
- `DATABASE_URL não configurada` → Verificar secret
- `SECRET_KEY deve ter pelo menos 32 caracteres` → Gerar nova chave maior
- `Connection refused` → Problema com banco de dados

---

## 🎯 Resumo (TL;DR)

Para um projeto que já está rodando:

```bash
# 1. Gerar SECRET_KEY
python -c 'import secrets; print(secrets.token_urlsafe(32))'

# 2. Obter URL do Cloud Run
gcloud run services describe fincontrol-ai --region us-central1 --format 'value(status.url)'

# 3. Criar secrets
echo -n "CHAVE_GERADA" | gcloud secrets create SECRET_KEY --data-file=-
echo -n "URL_DO_CLOUD_RUN" | gcloud secrets create ALLOWED_ORIGINS --data-file=-

# 4. Deploy
git add .
git commit -m "Melhorias de segurança"
git push origin main

# 5. Validar
gcloud run logs tail fincontrol-ai --region us-central1
```

---

## 📝 Checklist

Antes do push:
- [ ] SECRET_KEY criado (32+ caracteres)
- [ ] ALLOWED_ORIGINS criado com URL correta
- [ ] cloudbuild.yaml atualizado (já está ✅)
- [ ] Permissões do Cloud Build OK

Após o deploy:
- [ ] Build completou sem erros
- [ ] Aplicação reiniciou
- [ ] Login funciona
- [ ] Sem erros de CORS

---

## 💡 Observação Importante

Como o projeto já está em produção:

1. **O deploy substituirá a versão atual** - os usuários verão as mudanças imediatamente
2. **Pode haver alguns segundos de downtime** durante o deploy (Cloud Run faz rolling update)
3. **Usuários logados continuarão logados** (o SECRET_KEY novo só afeta novos logins)

**Se quiser evitar impacto:**
- Faça o deploy fora do horário de pico
- Ou teste primeiro em uma branch de staging

---

**Última atualização:** Dezembro 2025
