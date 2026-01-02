# Migração de IA: Google Gemini → Groq

## ✅ Status: IMPLEMENTADO

A migração foi implementada com sucesso. O sistema agora usa **Groq como provedor principal** (gratuito) com **fallback para Gemini**.

---

## 📋 Resumo das Alterações

### Arquivos Criados

| Arquivo              | Descrição                          |
| -------------------- | ---------------------------------- |
| `backend/ai_groq.py` | Novo serviço de IA usando Groq API |

### Arquivos Modificados

| Arquivo                    | Alteração                                       |
| -------------------------- | ----------------------------------------------- |
| `backend/main.py`          | Endpoint `/ai/analysis` agora usa Groq primeiro |
| `backend/ofx_service.py`   | Categorização usa Groq como provedor principal  |
| `backend/requirements.txt` | Adicionado `httpx==0.27.0`                      |
| `cloudbuild.yaml`          | Adicionado secret `GROQ_API_KEY`                |
| `.env.example`             | Adicionada configuração `GROQ_API_KEY`          |
| `env.example`              | Adicionada configuração `GROQ_API_KEY`          |

---

## 🚀 Como Ativar

### 1. Obter Chave da API Groq (GRATUITO)

1. Acesse: https://console.groq.com/keys
2. Crie uma conta (gratuita)
3. Gere uma nova API Key
4. A chave começa com `gsk_`

### 2. Configurar no Google Cloud (Produção)

```bash
# Criar o secret no Google Cloud
echo -n "gsk_SUA_CHAVE_AQUI" | gcloud secrets create GROQ_API_KEY --data-file=-

# OU atualizar se já existir
echo -n "gsk_SUA_CHAVE_AQUI" | gcloud secrets versions add GROQ_API_KEY --data-file=-
```

### 3. Fazer Deploy

```bash
git add .
git commit -m "feat: migração de IA para Groq (gratuito)"
git push origin main
```

---

## 📊 Comparativo: Groq vs Gemini

| Característica | Groq (Novo)           | Gemini (Anterior)     |
| -------------- | --------------------- | --------------------- |
| **Preço**      | ✅ GRATUITO           | ⚠️ Limite muito baixo |
| **Limite**     | 30 req/min, 14.4k/dia | 15 req/min (free)     |
| **Velocidade** | ⚡ Muito rápido       | Moderado              |
| **Modelo**     | LLaMA 3.3 70B         | Gemini Pro            |
| **Qualidade**  | Excelente             | Excelente             |

---

## 🔧 Arquitetura Implementada

```
Requisição de IA
       │
       ▼
┌─────────────────┐
│ GROQ_API_KEY    │
│ configurada?    │
└────────┬────────┘
         │
    ┌────┴────┐
    │ Sim     │ Não
    ▼         ▼
┌───────┐  ┌────────────────┐
│ Groq  │  │ GEMINI_API_KEY │
│ API   │  │ configurada?   │
└───┬───┘  └───────┬────────┘
    │              │
    │         ┌────┴────┐
    │         │ Sim     │ Não
    │         ▼         ▼
    │     ┌───────┐  ┌───────┐
    │     │Gemini │  │ Erro  │
    │     │ API   │  │ 503   │
    │     └───┬───┘  └───────┘
    │         │
    ▼         ▼
┌─────────────────┐
│   Resposta IA   │
└─────────────────┘
```

---

## 🧪 Testando Localmente

```bash
# Configurar variável de ambiente
set GROQ_API_KEY=gsk_sua_chave_aqui

# Rodar backend
cd backend
uvicorn main:app --reload

# Testar endpoint de análise
curl -X POST http://localhost:8000/ai/analysis \
  -H "Authorization: Bearer SEU_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"balance": 5000, "monthly_income": 8000, "monthly_expenses": 6000, "reserves_total": 10000}'
```

---

## ⚠️ Notas Importantes

1. **Fallback automático**: Se Groq falhar, o sistema tenta Gemini automaticamente
2. **Retry com backoff**: Implementado para lidar com rate limits
3. **Compatibilidade**: Código antigo continua funcionando com Gemini
4. **Logs**: Prefixo `[GROQ]` ou `[IA-Gemini]` nos logs para identificar provedor

---

## 📁 Código Original (Referência)

Os códigos originais propostos estão abaixo para referência. A implementação final foi ajustada para:

- Corrigir divisão por 100 (valores já eram em reais)
- Adicionar retry com backoff exponencial
- Manter compatibilidade com código existente
- Implementar fallback automático para Gemini

<details>
<summary>Código original proposto (clique para expandir)</summary>

```python
# ai_groq.py (original)
# ... código original aqui ...
```

</details>
