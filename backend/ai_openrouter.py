"""
Serviço de IA usando OpenRouter (Xiaomi MiMo, etc.)
Substitui Groq/Gemini como provedor principal.

Configuração:
- Modelo: xiaomi/mimo-v2-flash:free (Gratuito, Rápido)
- Roteamento: Prioriza latência, permite fallbacks
"""
import os
import asyncio
from typing import Optional, List, Tuple

# Constantes do OpenRouter
OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
DEFAULT_MODEL = "xiaomi/mimo-v2-flash:free"

def _get_client(api_key: Optional[str] = None):
    """
    Cria cliente OpenAI configurado para OpenRouter
    """
    from openai import OpenAI
    
    key = api_key or os.getenv("OPENROUTER_API_KEY", "")
    # Remove caracteres inválidos
    key = key.strip().replace('\r', '').replace('\n', '')
    
    if not key:
        return None
    
    return OpenAI(
        base_url=OPENROUTER_BASE_URL,
        api_key=key
    )

async def get_financial_analysis(
    balance: float,
    monthly_income: float,
    monthly_expenses: float,
    reserves_total: float,
    context: Optional[str] = None,
    openrouter_api_key: Optional[str] = None,
    timeout_seconds: int = 45
) -> str:
    """
    Gera análise financeira usando OpenRouter
    
    Args:
        balance: Saldo total em reais (float)
        monthly_income: Receita mensal em reais (float)
        monthly_expenses: Despesas mensais em reais (float)
        reserves_total: Total em reservas em reais (float)
        context: Contexto adicional opcional
        openrouter_api_key: Chave da API OpenRouter
        timeout_seconds: Timeout da requisição
    
    Returns:
        Texto da análise financeira
    """
    client = _get_client(openrouter_api_key)
    
    if not client:
        return "Configure a variável OPENROUTER_API_KEY para habilitar análises inteligentes."

    prompt = f"""Você é um consultor financeiro experiente. Analise os dados abaixo e forneça insights práticos.

**Dados Financeiros:**
- Saldo Total: R$ {balance:.2f}
- Receita Mensal: R$ {monthly_income:.2f}
- Despesas Mensais: R$ {monthly_expenses:.2f}
- Total em Reservas: R$ {reserves_total:.2f}

{f"**Contexto adicional:** {context}" if context else ""}

Forneça uma análise com:
1. Diagnóstico da situação financeira atual
2. Pontos de atenção e alertas
3. Recomendações práticas e acionáveis
4. Sugestões de metas financeiras

Seja direto, prático e empático. Máximo 400 palavras."""

    try:
        def _call_ai():
            response = client.chat.completions.create(
                model=DEFAULT_MODEL,
                messages=[
                    {
                        "role": "system",
                        "content": "Você é um consultor financeiro brasileiro especializado em finanças pessoais. Responda sempre em português brasileiro."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                temperature=0.7,
                max_tokens=1024,
                top_p=1,
                # Parâmetros específicos do OpenRouter
                extra_body={
                    "provider": {
                        "sort": "latency",
                        "allow_fallbacks": True
                    }
                },
                extra_headers={
                    "HTTP-Referer": "https://github.com/DaniloFeeburg/FinControl-AI",
                    "X-Title": "FinControl-AI"
                }
            )
            return response.choices[0].message.content

        loop = asyncio.get_event_loop()
        result = await asyncio.wait_for(
            loop.run_in_executor(None, _call_ai),
            timeout=timeout_seconds
        )
        
        return result

    except asyncio.TimeoutError:
        return "Timeout ao gerar análise. Tente novamente."
    except Exception as e:
        print(f"[OpenRouter] Erro ao conectar: {str(e)}")
        return f"Erro ao conectar com serviço de IA: {str(e)}"


async def suggest_category(
    description: str,
    amount: float,
    categories: List[dict],
    previous_transactions: List[dict] = [],
    openrouter_api_key: Optional[str] = None,
    timeout_seconds: int = 20,
    max_retries: int = 3
) -> Tuple[Optional[str], float]:
    """
    Sugere categoria usando OpenRouter (Xiaomi MiMo)
    
    Args:
        description: Descrição da transação
        amount: Valor da transação (em CENTAVOS, será convertido para reais no prompt)
        categories: Lista de categorias disponíveis
        previous_transactions: Exemplos para few-shot learning
        openrouter_api_key: Chave API
        timeout_seconds: Timeout
        max_retries: Tentativas
    """
    client = _get_client(openrouter_api_key)
    
    if not client or not categories:
        return None, 0.0

    # amount vem em centavos, converter para float
    amount_in_cents = amount
    transaction_type = "INCOME" if amount_in_cents > 0 else "EXPENSE"
    
    relevant_categories = [c for c in categories if c['type'] == transaction_type]

    if not relevant_categories:
        print(f"[OpenRouter] Nenhuma categoria do tipo {transaction_type} disponível")
        return None, 0.0

    categories_text = "\n".join([f"{c['id']}: {c['name']}" for c in relevant_categories])
    
    # Prepara exemplos do histórico
    examples_text = ""
    if previous_transactions:
        examples_list = []
        for txn in previous_transactions:
             examples_list.append(f"- \"{txn['description']}\" -> {txn['category_name']}")
        
        if examples_list:
            examples_text = "\n\nExemplos de categorizações anteriores deste usuário:\n" + "\n".join(examples_list)

    # Prompt
    # Importante: amount_in_cents / 100 para exibir em Reais
    prompt = f"""Categorize esta transação financeira brasileira.

Transação: "{description}"
Valor: R$ {abs(amount_in_cents)/100:.2f} ({'receita' if amount_in_cents > 0 else 'despesa'})

Categorias disponíveis:
{categories_text}{examples_text}

Responda EXATAMENTE neste formato: ID_DA_CATEGORIA|CONFIANCA
Exemplo: abc123|0.85

Se não tiver certeza, responda: none|0.0"""

    last_error = None
    
    for attempt in range(max_retries):
        try:
            def _call_ai():
                response = client.chat.completions.create(
                    model=DEFAULT_MODEL,
                    messages=[
                        {
                            "role": "system", 
                            "content": "Você é um assistente de categorização financeira. Responda apenas no formato solicitado."
                        },
                        {
                            "role": "user", 
                            "content": prompt
                        }
                    ],
                    temperature=0.1, # Temperatura baixa para consistência
                    max_tokens=50,
                    extra_body={
                        "provider": {
                            "sort": "latency",
                            "allow_fallbacks": True
                        }
                    },
                    extra_headers={
                        "HTTP-Referer": "https://github.com/DaniloFeeburg/FinControl-AI",
                        "X-Title": "FinControl-AI"
                    }
                )
                return response.choices[0].message.content

            loop = asyncio.get_event_loop()
            result = await asyncio.wait_for(
                loop.run_in_executor(None, _call_ai),
                timeout=timeout_seconds
            )
            
            result = result.strip()
            print(f"[OpenRouter] Descrição: {description[:50]}, Resposta: {result}")

            if '|' in result:
                parts = result.split('|')
                if len(parts) >= 2:
                    category_id = parts[0].strip()
                    try:
                        confidence = float(parts[1].strip())
                    except ValueError:
                        confidence = 0.0

                    if category_id != 'none' and category_id in [c['id'] for c in relevant_categories]:
                        # print(f"[OpenRouter] ✓ Categoria sugerida: {category_id} (confiança: {confidence})")
                        return category_id, confidence

            print(f"[OpenRouter] ✗ Resposta inválida ou categoria não encontrada")
            return None, 0.0

        except asyncio.TimeoutError:
            last_error = "Timeout"
            if attempt < max_retries - 1:
                await asyncio.sleep(1)
                continue
        except Exception as e:
            error_str = str(e).lower()
            last_error = str(e)
            
            # Rate limit - aguarda e tenta novamente
            if 'rate' in error_str or '429' in error_str:
                if attempt < max_retries - 1:
                    wait_time = (2 ** attempt) * 1.5
                    print(f"[OpenRouter] ⚠ Rate limit. Aguardando {wait_time}s (tentativa {attempt + 1}/{max_retries})")
                    await asyncio.sleep(wait_time)
                    continue
            
            print(f"[OpenRouter] Erro: {str(e)}")
            if attempt < max_retries - 1:
                await asyncio.sleep(1)
                continue

    print(f"[OpenRouter] ⏱ Falha após {max_retries} tentativas: {last_error}")
    return None, 0.0
