# Guia de Integração Avançada: Xiaomi MiMo-V2-Flash (Free) via OpenRouter

Este guia atualizado inclui instruções sobre como utilizar os recursos de **roteamento e seleção de provedores** do OpenRouter para garantir a melhor performance e disponibilidade para o modelo **Xiaomi: MiMo-V2-Flash (free)** no projeto FinControl-AI.

## 1. Configuração Básica

Certifique-se de ter sua `OPENROUTER_API_KEY` configurada no seu arquivo `.env`.

## 2. Roteamento e Seleção de Provedores

O OpenRouter permite personalizar como suas requisições são roteadas através do objeto `provider` no corpo da requisição. Isso é útil para priorizar provedores específicos ou configurar fallbacks.

### Parâmetros de Roteamento Principais:

| Campo                | Tipo       | Descrição                                                                                   |
| :------------------- | :--------- | :------------------------------------------------------------------------------------------ |
| `order`              | `string[]` | Lista de slugs de provedores para tentar em ordem (ex: `["xiaomi", "novita"]`).             |
| `sort`               | `string`   | Ordenar provedores por `"price"`, `"throughput"` ou `"latency"`.                            |
| `allow_fallbacks`    | `boolean`  | Se deve permitir provedores de backup se o principal estiver indisponível (padrão: `true`). |
| `require_parameters` | `boolean`  | Usar apenas provedores que suportam todos os parâmetros da sua requisição.                  |

## 3. Implementação no Código (`backend/ofx_service.py`)

Abaixo está a implementação atualizada utilizando a biblioteca `openai` com suporte a parâmetros extras do OpenRouter.

```python
import os
from openai import OpenAI

def suggest_category_with_openrouter(description, amount, categories):
    client = OpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=os.getenv("OPENROUTER_API_KEY"),
    )

    # Prompt de categorização
    prompt = f"Categorize a transação: {description}..."

    # Chamada com configurações de roteamento
    response = client.chat.completions.create(
        model="xiaomi/mimo-v2-flash:free",
        messages=[
            {"role": "system", "content": "Você é um assistente financeiro especializado em categorização."},
            {"role": "user", "content": prompt}
        ],
        # Parâmetros extras específicos do OpenRouter
        extra_body={
            "provider": {
                "sort": "latency", # Prioriza a menor latência entre os provedores do modelo
                "allow_fallbacks": True, # Permite fallback para outros provedores se necessário
            }
        },
        extra_headers={
            "HTTP-Referer": "https://github.com/DaniloFeeburg/FinControl-AI",
            "X-Title": "FinControl-AI",
        }
    )

    return response.choices[0].message.content.strip()
```

## 4. Atalhos de Roteamento (Shortcuts)

O OpenRouter oferece atalhos que podem ser anexados ao slug do modelo:

- **`:nitro`**: Atalho para `sort: "throughput"`. Exemplo: `xiaomi/mimo-v2-flash:free:nitro`
- **`:floor`**: Atalho para `sort: "price"`. Exemplo: `xiaomi/mimo-v2-flash:free:floor`

## 5. Melhores Práticas para o FinControl-AI

1.  **Uso de Fallbacks:** Mantenha `allow_fallbacks: True` para garantir que, se o provedor principal da Xiaomi estiver fora do ar, o OpenRouter tente outro que ofereça o mesmo modelo (se disponível).
2.  **Identificação da App:** Sempre envie os headers `HTTP-Referer` e `X-Title`. Isso ajuda o OpenRouter a listar sua aplicação no ranking e pode dar visibilidade ao seu projeto.
3.  **Temperatura Baixa:** Para categorização financeira, use `temperature=0.1` ou `0.0` para garantir que a IA não "invente" categorias e seja consistente.

---

**Referências:**

- [OpenRouter Provider Selection Documentation](https://openrouter.ai/docs/guides/routing/provider-selection)
- [Xiaomi MiMo-V2-Flash Model Page](https://openrouter.ai/xiaomi/mimo-v2-flash:free)
