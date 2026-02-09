# Logs de Execução - OpenRouter (2026-02-08)

## Problema Identificado: Rate Limiting (HTTP 429)

Os logs abaixo mostram que o sistema está enfrentando problemas de rate limiting do OpenRouter ao processar múltiplas transações simultâneas.

```
2026-02-08 20:41:00.255 BRT
[OpenRouter] Fallback model (qwen/qwen3-next-80b-a3b-instruct:free): latency=0.15s, error=Request error: 429 Client Error: Too Many Requests for url: https://openrouter.ai/api/v1/chat/completions
2026-02-08 20:41:00.255 BRT
[OpenRouter] Falha completa: primary_error=Request error: 429 Client Error: Too Many Requests for url: https://openrouter.ai/api/v1/chat/completions, fallback_error=Request error: 429 Client Error: Too Many Requests for url: https://openrouter.ai/api/v1/chat/completions
2026-02-08 20:41:00.255 BRT
[OpenRouter] Fallback model (qwen/qwen3-next-80b-a3b-instruct:free): latency=0.17s, error=Request error: 429 Client Error: Too Many Requests for url: https://openrouter.ai/api/v1/chat/completions
2026-02-08 20:41:00.255 BRT
[OpenRouter] Falha completa: primary_error=Request error: 429 Client Error: Too Many Requests for url: https://openrouter.ai/api/v1/chat/completions, fallback_error=Request error: 429 Client Error: Too Many Requests for url: https://openrouter.ai/api/v1/chat/completions
2026-02-08 20:41:00.255 BRT
[OpenRouter] Fallback model (qwen/qwen3-next-80b-a3b-instruct:free): latency=0.15s, error=Request error: 429 Client Error: Too Many Requests for url: https://openrouter.ai/api/v1/chat/completions
2026-02-08 20:41:00.255 BRT
[OpenRouter] Falha completa: primary_error=Request error: 429 Client Error: Too Many Requests for url: https://openrouter.ai/api/v1/chat/completions, fallback_error=Request error: 429 Client Error: Too Many Requests for url: https://openrouter.ai/api/v1/chat/completions
2026-02-08 20:41:00.255 BRT
[OpenRouter] Fallback model (qwen/qwen3-next-80b-a3b-instruct:free): latency=0.22s, error=Request error: 429 Client Error: Too Many Requests for url: https://openrouter.ai/api/v1/chat/completions
2026-02-08 20:41:00.255 BRT
[OpenRouter] Falha completa: primary_error=Request error: 429 Client Error: Too Many Requests for url: https://openrouter.ai/api/v1/chat/completions, fallback_error=Request error: 429 Client Error: Too Many Requests for url: https://openrouter.ai/api/v1/chat/completions
2026-02-08 20:41:00.255 BRT
[OpenRouter] Primary model (mistralai/mistral-small-3.1-24b-instruct:free): latency=0.14s, error=Request error: 429 Client Error: Too Many Requests for url: https://openrouter.ai/api/v1/chat/completions
2026-02-08 20:41:00.255 BRT
[OpenRouter] Primary model (mistralai/mistral-small-3.1-24b-instruct:free): latency=0.15s, error=Request error: 429 Client Error: Too Many Requests for url: https://openrouter.ai/api/v1/chat/completions
2026-02-08 20:41:00.255 BRT
[OpenRouter] Primary model (mistralai/mistral-small-3.1-24b-instruct:free): latency=0.16s, error=Request error: 429 Client Error: Too Many Requests for url: https://openrouter.ai/api/v1/chat/completions
2026-02-08 20:41:00.255 BRT
[OpenRouter] Primary model (mistralai/mistral-small-3.1-24b-instruct:free): latency=0.21s, error=Request error: 429 Client Error: Too Many Requests for url: https://openrouter.ai/api/v1/chat/completions
2026-02-08 20:41:00.255 BRT
[OpenRouter] Fallback model (qwen/qwen3-next-80b-a3b-instruct:free): latency=0.23s, error=Request error: 429 Client Error: Too Many Requests for url: https://openrouter.ai/api/v1/chat/completions
2026-02-08 20:41:00.255 BRT
[OpenRouter] Falha completa: primary_error=Request error: 429 Client Error: Too Many Requests for url: https://openrouter.ai/api/v1/chat/completions, fallback_error=Request error: 429 Client Error: Too Many Requests for url: https://openrouter.ai/api/v1/chat/completions
2026-02-08 20:41:00.255 BRT
[OpenRouter] Fallback model (qwen/qwen3-next-80b-a3b-instruct:free): latency=0.23s, error=Request error: 429 Client Error: Too Many Requests for url: https://openrouter.ai/api/v1/chat/completions
2026-02-08 20:41:00.255 BRT
[OpenRouter] Falha completa: primary_error=Request error: 429 Client Error: Too Many Requests for url: https://openrouter.ai/api/v1/chat/completions, fallback_error=Request error: 429 Client Error: Too Many Requests for url: https://openrouter.ai/api/v1/chat/completions
2026-02-08 20:41:00.256 BRT
[OpenRouter] Fallback model (qwen/qwen3-next-80b-a3b-instruct:free): latency=0.26s, error=Request error: 429 Client Error: Too Many Requests for url: https://openrouter.ai/api/v1/chat/completions
2026-02-08 20:41:00.256 BRT
[OpenRouter] Falha completa: primary_error=Request error: 429 Client Error: Too Many Requests for url: https://openrouter.ai/api/v1/chat/completions, fallback_error=Request error: 429 Client Error: Too Many Requests for url: https://openrouter.ai/api/v1/chat/completions
2026-02-08 20:41:00.256 BRT
[OpenRouter] Fallback model (qwen/qwen3-next-80b-a3b-instruct:free): latency=0.22s, error=Request error: 429 Client Error: Too Many Requests for url: https://openrouter.ai/api/v1/chat/completions
2026-02-08 20:41:00.256 BRT
[OpenRouter] Falha completa: primary_error=Request error: 429 Client Error: Too Many Requests for url: https://openrouter.ai/api/v1/chat/completions, fallback_error=Request error: 429 Client Error: Too Many Requests for url: https://openrouter.ai/api/v1/chat/completions
2026-02-08 20:41:00.256 BRT
INFO: 169.254.169.126:0 - "POST /import/ofx/preview HTTP/1.1" 200 OK
2026-02-08 20:41:00.256 BRT
169.254.169.126 - - [08/Feb/2026:23:41:00 +0000] "POST /api/import/ofx/preview HTTP/1.1" 200 16551 "https://fincontrol-ai-220533997232.us-central1.run.app/" "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebK
```

## Análise do Problema

### Causa Raiz
O erro **HTTP 429 (Too Many Requests)** indica que o sistema está excedendo o limite de taxa de requisições do OpenRouter. Isso acontece quando:

1. **Processamento em Paralelo**: O sistema está processando múltiplas transações simultaneamente (via `asyncio.gather`) sem limitação de taxa
2. **Alto Volume**: Ao importar um arquivo OFX com muitas transações, o sistema tenta categorizar todas de uma vez (até 50 transações por limite configurado)
3. **Modelos Gratuitos**: Os modelos gratuitos do OpenRouter têm limites mais restritivos de rate limiting

### Impacto
- Todas as requisições de categorização falham
- As transações não são categorizadas automaticamente
- O usuário precisa categorizar manualmente
- A experiência do usuário é prejudicada

### Soluções Sugeridas

1. **Implementar Rate Limiting Local**: Adicionar um delay entre as requisições sequenciais
2. **Reduzir Paralelismo**: Processar as transações em batches menores (ex: 5-10 simultâneas)
3. **Exponential Backoff**: Implementar retry com delay crescente após erro 429
4. **Cache Local**: Armazenar transações similares para evitar requisições repetidas
5. **Aumentar MAX_AI_CATEGORIZATIONS**: Reduzir o limite de 50 para algo mais conservador (ex: 10-20)
6. **Upgrade de Plano**: Considerar um plano pago no OpenRouter com limites mais altos

### Solução Implementada

#### Alterações em [main.py](file:///c:/GitHub/FinControl-AI/backend/main.py#L762-L816)

1. **Redução de MAX_AI_CATEGORIZATIONS**: De 50 para 20 transações por importação
2. **Rate Limiting de 20 chamadas/minuto**:
   - Batches de 5 transações processadas em paralelo
   - Delay de 3 segundos entre batches (batch_delay = 3.0)
   - Log informativo ao aguardar próximo batch
3. **Atualização de comentários**: Removidas referências ao Groq, foco em rate limiting OpenRouter

#### Código Modificado:
```python
# Limita categorização por IA para evitar timeout e rate limiting
MAX_AI_CATEGORIZATIONS = 20

# Rate limiter: 20 chamadas por minuto (1 chamada a cada 3 segundos)
# Executa em lotes de 5 com delay de 3 segundos entre batches
batch_size = 5
batch_delay = 3.0

# Delay entre batches para respeitar rate limit (20 req/min)
if i + batch_size < len(transactions_to_categorize):
    print(f"[OFX] Aguardando {batch_delay}s antes do próximo batch...")
    await asyncio.sleep(batch_delay)
```

#### Benefícios:
- Evita HTTP 429 (Too Many Requests)
- Mantém processamento em paralelo (5 transações simultâneas)
- Previsível: 20 transações categorizadas em ~12 segundos (4 batches × 3s)
- Melhor experiência do usuário com categorização estável

#### Trade-offs:
- Menos transações categorizadas automaticamente por importação (20 vs 50)
- Tempo total de processamento mais longo devido aos delays
- Transações além do limite precisam de categorização manual
