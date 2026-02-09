2026-02-08 21:38:13.580 BRT
[OFX] Total: 44 transações, Categorizando: 20 (limite: 20)
2026-02-08 21:38:13.580 BRT
[OpenRouter] Primary model (mistralai/mistral-small-3.1-24b-instruct:free): latency=0.83s, error=None
2026-02-08 21:38:13.580 BRT
[OpenRouter] Primary: JSON inválido
2026-02-08 21:38:13.580 BRT
[OpenRouter] Primary model (mistralai/mistral-small-3.1-24b-instruct:free): latency=0.91s, error=None
2026-02-08 21:38:13.580 BRT
[OpenRouter] Primary: JSON inválido
2026-02-08 21:38:13.580 BRT
[OpenRouter] Primary model (mistralai/mistral-small-3.1-24b-instruct:free): latency=1.02s, error=None
2026-02-08 21:38:13.580 BRT
[OpenRouter] Primary: JSON inválido
2026-02-08 21:38:13.580 BRT
[OpenRouter] Primary model (mistralai/mistral-small-3.1-24b-instruct:free): latency=1.11s, error=None
2026-02-08 21:38:13.580 BRT
[OpenRouter] Primary: JSON inválido
2026-02-08 21:38:13.580 BRT
[OpenRouter] Primary model (mistralai/mistral-small-3.1-24b-instruct:free): latency=1.20s, error=None

### Solução Implementada

#### Problema Identificado (log.txt)
O modelo primário `mistralai/mistral-small-3.1-24b-instruct:free` estava retornando JSON inválido, mas a função `suggest_category` **não tentava reparar o JSON** antes de usar o fallback, resultando em poucas transações categorizadas.

```
[OpenRouter] Primary: JSON inválido
[OpenRouter] Primary: JSON inválido
... (repete 5 vezes)
```

#### Solução 1: Rate Limiting (main.py)
Alterações em [main.py](file:///c:/GitHub/FinControl-AI/backend/main.py#L762-L816):

1. **Redução de MAX_AI_CATEGORIZATIONS**: De 50 para 20 transações por importação
2. **Rate Limiting de 20 chamadas/minuto**:
   - Batches de 5 transações processadas em paralelo
   - Delay de 3 segundos entre batches (batch_delay = 3.0)
   - Log informativo ao aguardar próximo batch
3. **Atualização de comentários**: Removidas referências ao Groq, foco em rate limiting OpenRouter

#### Solução 2: Reparo de JSON (ai_openrouter.py)
Alterações em [ai_openrouter.py](file:///c:/GitHub/FinControl-AI/backend/ai_openrouter.py#L344-L386):

1. **Adicionado reparo de JSON no modelo primário**:
   - Quando JSON é inválido, tenta reparar antes de usar fallback
   - Remove ```json``` e ``` do conteúdo
   - Valida categoria após reparo

2. **Adicionado reparo de JSON no modelo fallback**:
   - Mesma lógica de reparo aplicada ao fallback
   - Aumenta chances de sucesso mesmo com modelos problemáticos

#### Código Modificado:
```python
# Primary model com reparo
if is_valid and isinstance(json_data, dict):
    category_id = json_data.get("category_id")
    confidence = json_data.get("confidence", 0.0)
    
    if category_id and category_id in [c['id'] for c in relevant_categories]:
        print(f"[OpenRouter] Primary: categoria={category_id}, confidence={confidence}")
        return category_id, confidence
else:
    print(f"[OpenRouter] Primary: JSON inválido, tentando reparar...")
    repaired = _try_repair_json(primary_content)
    if repaired and isinstance(repaired, dict):
        category_id = repaired.get("category_id")
        confidence = repaired.get("confidence", 0.0)
        
        if category_id and category_id in [c['id'] for c in relevant_categories]:
            print(f"[OpenRouter] Primary: JSON reparado com sucesso, categoria={category_id}, confidence={confidence}")
            return category_id, confidence
        else:
            print(f"[OpenRouter] Primary: JSON reparado mas categoria inválida")
    else:
        print(f"[OpenRouter] Primary: Reparo falhou, usando fallback")
```

#### Benefícios:
- ✅ Evita HTTP 429 (Too Many Requests) com rate limiting
- ✅ Repara JSON inválido automaticamente antes de usar fallback
- ✅ Aumenta taxa de categorização bem-sucedida
- ✅ Mantém processamento em paralelo (5 transações simultâneas)
- ✅ Previsível: 20 transações categorizadas em ~12 segundos (4 batches × 3s)
- ✅ Melhor experiência do usuário com categorização estável

#### Trade-offs:
- Menos transações categorizadas automaticamente por importação (20 vs 50)
- Tempo total de processamento mais longo devido aos delays
- Transações além do limite precisam de categorização manual