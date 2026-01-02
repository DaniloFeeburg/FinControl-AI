"""
Serviço de IA usando Groq (GRATUITO e RÁPIDO)
Substitui o Google Gemini para análises financeiras e categorização

Limites Groq (Free Tier):
- 30 requests/min
- 14,400 requests/dia
- Modelos: llama-3.3-70b-versatile, mixtral-8x7b, etc.
"""
import os
import asyncio
import httpx
from typing import Optional, List, Tuple

GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
DEFAULT_MODEL = "llama-3.3-70b-versatile"  # Modelo gratuito e poderoso


async def get_financial_analysis(
    balance: float,
    monthly_income: float,
    monthly_expenses: float,
    reserves_total: float,
    context: Optional[str] = None,
    groq_api_key: Optional[str] = None,
    timeout_seconds: int = 30
) -> str:
    """
    Gera análise financeira usando Groq (LLaMA 3.3 70B)
    TOTALMENTE GRATUITO com 30 req/min
    
    Args:
        balance: Saldo total em reais
        monthly_income: Receita mensal em reais
        monthly_expenses: Despesas mensais em reais
        reserves_total: Total em reservas em reais
        context: Contexto adicional opcional
        groq_api_key: Chave da API Groq
        timeout_seconds: Timeout da requisição
    
    Returns:
        Texto da análise financeira
    """
    api_key = groq_api_key or os.getenv("GROQ_API_KEY")
    
    if not api_key:
        return "Configure a variável GROQ_API_KEY para habilitar análises inteligentes."

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

Seja direto, prático e empático. Máximo 300 palavras."""

    try:
        async with httpx.AsyncClient(timeout=timeout_seconds) as client:
            response = await client.post(
                GROQ_API_URL,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": DEFAULT_MODEL,
                    "messages": [
                        {
                            "role": "system",
                            "content": "Você é um consultor financeiro brasileiro especializado em finanças pessoais. Responda sempre em português brasileiro."
                        },
                        {
                            "role": "user",
                            "content": prompt
                        }
                    ],
                    "temperature": 0.7,
                    "max_tokens": 1024,
                    "top_p": 1
                }
            )

            if response.status_code == 429:
                return "Limite de requisições atingido. Tente novamente em alguns segundos."
            
            if response.status_code != 200:
                print(f"[GROQ] Erro HTTP {response.status_code}: {response.text}")
                return f"Erro ao gerar análise. Código: {response.status_code}"

            data = response.json()
            return data["choices"][0]["message"]["content"]

    except httpx.TimeoutException:
        return "Timeout ao gerar análise. Tente novamente."
    except Exception as e:
        print(f"[GROQ] Erro ao conectar: {str(e)}")
        return f"Erro ao conectar com serviço de IA: {str(e)}"


async def suggest_category(
    description: str,
    amount: float,
    categories: List[dict],
    groq_api_key: Optional[str] = None,
    timeout_seconds: int = 10,
    max_retries: int = 3
) -> Tuple[Optional[str], float]:
    """
    Sugere categoria usando Groq com retry e backoff
    
    Args:
        description: Descrição da transação
        amount: Valor da transação (negativo = despesa, positivo = receita)
        categories: Lista de categorias [{id, name, type}]
        groq_api_key: Chave da API Groq
        timeout_seconds: Timeout por tentativa
        max_retries: Número máximo de tentativas
    
    Returns:
        Tuple (category_id, confidence_score)
    """
    api_key = groq_api_key or os.getenv("GROQ_API_KEY")
    
    if not api_key or not categories:
        return None, 0.0

    transaction_type = "INCOME" if amount > 0 else "EXPENSE"
    relevant_categories = [c for c in categories if c['type'] == transaction_type]

    if not relevant_categories:
        print(f"[GROQ] Nenhuma categoria do tipo {transaction_type} disponível")
        return None, 0.0

    categories_text = "\n".join([f"{c['id']}: {c['name']}" for c in relevant_categories])

    prompt = f"""Categorize esta transação financeira brasileira.

Transação: "{description}"
Valor: R$ {abs(amount):.2f} ({'receita' if amount > 0 else 'despesa'})

Categorias disponíveis:
{categories_text}

Responda EXATAMENTE neste formato: ID_DA_CATEGORIA|CONFIANCA
Exemplo: abc123|0.85

Se não tiver certeza, responda: none|0.0"""

    last_error = None
    
    for attempt in range(max_retries):
        try:
            async with httpx.AsyncClient(timeout=timeout_seconds) as client:
                response = await client.post(
                    GROQ_API_URL,
                    headers={
                        "Authorization": f"Bearer {api_key}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "model": DEFAULT_MODEL,
                        "messages": [
                            {
                                "role": "system", 
                                "content": "Você é um assistente de categorização financeira. Responda apenas no formato solicitado."
                            },
                            {
                                "role": "user", 
                                "content": prompt
                            }
                        ],
                        "temperature": 0.3,
                        "max_tokens": 50
                    }
                )

                # Rate limit - aguarda e tenta novamente
                if response.status_code == 429:
                    if attempt < max_retries - 1:
                        wait_time = (2 ** attempt) * 1.0
                        print(f"[GROQ] ⚠ Rate limit. Aguardando {wait_time}s (tentativa {attempt + 1}/{max_retries})")
                        await asyncio.sleep(wait_time)
                        continue
                    else:
                        print(f"[GROQ] ⚠ Rate limit excedido após {max_retries} tentativas")
                        return None, 0.0

                if response.status_code != 200:
                    print(f"[GROQ] Erro HTTP {response.status_code}: {response.text}")
                    return None, 0.0

                data = response.json()
                result = data["choices"][0]["message"]["content"].strip()

                print(f"[GROQ] Descrição: {description[:50]}, Resposta: {result}")

                if '|' in result:
                    parts = result.split('|')
                    if len(parts) >= 2:
                        category_id = parts[0].strip()
                        try:
                            confidence = float(parts[1].strip())
                        except ValueError:
                            confidence = 0.0

                        if category_id != 'none' and category_id in [c['id'] for c in relevant_categories]:
                            print(f"[GROQ] ✓ Categoria sugerida: {category_id} (confiança: {confidence})")
                            return category_id, confidence

                print(f"[GROQ] ✗ Resposta inválida ou categoria não encontrada")
                return None, 0.0

        except httpx.TimeoutException:
            last_error = "Timeout"
            if attempt < max_retries - 1:
                await asyncio.sleep(1)
                continue
        except Exception as e:
            last_error = str(e)
            print(f"[GROQ] Erro: {str(e)}")
            if attempt < max_retries - 1:
                await asyncio.sleep(1)
                continue

    print(f"[GROQ] ⏱ Falha após {max_retries} tentativas: {last_error}")
    return None, 0.0
