"""
Serviço de IA usando OpenRouter
Primary: mistralai/mistral-small-3.1-24b-instruct:free
Fallback: qwen/qwen3-next-80b-a3b-instruct:free

Configuração:
- OPENROUTER_API_KEY (obrigatório)
- OPENROUTER_MODEL (opcional, default: mistralai/mistral-small-3.1-24b-instruct:free)
- OPENROUTER_SITE_URL (opcional)
- OPENROUTER_APP_NAME (opcional)
"""
import os
import asyncio
import json
import time
from typing import Optional, List, Tuple, Dict, Any

OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
PRIMARY_MODEL = "mistralai/mistral-small-3.1-24b-instruct:free"
FALLBACK_MODEL = "qwen/qwen3-next-80b-a3b-instruct:free"

def _get_headers(openrouter_api_key: str) -> Dict[str, str]:
    headers = {
        "Authorization": f"Bearer {openrouter_api_key}",
        "Content-Type": "application/json",
    }
    
    site_url = os.getenv("OPENROUTER_SITE_URL", "")
    app_name = os.getenv("OPENROUTER_APP_NAME", "")
    
    if site_url:
        headers["HTTP-Referer"] = site_url
    if app_name:
        headers["X-Title"] = app_name
    
    return headers

def _validate_json(text: str) -> Tuple[bool, Optional[Dict[str, Any]]]:
    try:
        json_data = json.loads(text)
        return True, json_data
    except json.JSONDecodeError:
        return False, None

def _try_repair_json(text: str) -> Optional[Dict[str, Any]]:
    try:
        cleaned = text.strip()
        
        if cleaned.startswith("```json"):
            cleaned = cleaned[7:]
        elif cleaned.startswith("```"):
            cleaned = cleaned[3:]
        
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]
        
        cleaned = cleaned.strip()
        
        return json.loads(cleaned)
    except:
        return None

async def _call_openrouter(
    openrouter_api_key: str,
    model: str,
    messages: List[Dict[str, str]],
    temperature: float = 0.7,
    max_tokens: int = 1024,
    timeout_seconds: int = 30,
    function_call: Optional[Dict[str, Any]] = None
) -> Tuple[Optional[str], Optional[str], float]:
    import requests
    
    headers = _get_headers(openrouter_api_key)
    
    payload = {
        "model": model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }
    
    if function_call:
        payload["functions"] = function_call["functions"]
        payload["function_call"] = function_call["function_call"]
    
    start_time = time.time()
    
    try:
        loop = asyncio.get_event_loop()
        
        def _make_request():
            response = requests.post(
                f"{OPENROUTER_BASE_URL}/chat/completions",
                headers=headers,
                json=payload,
                timeout=timeout_seconds
            )
            response.raise_for_status()
            return response.json()
        
        result = await asyncio.wait_for(
            loop.run_in_executor(None, _make_request),
            timeout=timeout_seconds
        )
        
        latency = time.time() - start_time
        
        if "choices" in result and len(result["choices"]) > 0:
            content = result["choices"][0].get("message", {}).get("content", "")
            return content, None, latency
        
        return None, "No content in response", latency
        
    except asyncio.TimeoutError:
        latency = time.time() - start_time
        return None, "Timeout", latency
    except requests.exceptions.RequestException as e:
        latency = time.time() - start_time
        return None, f"Request error: {str(e)}", latency
    except Exception as e:
        latency = time.time() - start_time
        return None, f"Unexpected error: {str(e)}", latency

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
        Texto da análise financeira em formato JSON
    """
    api_key = openrouter_api_key or os.getenv("OPENROUTER_API_KEY", "")
    api_key = api_key.strip().replace('\r', '').replace('\n', '')
    
    if not api_key:
        return json.dumps({
            "error": "Configure OPENROUTER_API_KEY",
            "diagnosis": "",
            "alerts": [],
            "recommendations": [],
            "goals": []
        })
    
    model = os.getenv("OPENROUTER_MODEL", PRIMARY_MODEL)
    
    prompt = f"""Analise os dados financeiros abaixo e forneça insights em JSON.

**Dados Financeiros:**
- Saldo Total: R$ {balance:.2f}
- Receita Mensal: R$ {monthly_income:.2f}
- Despesas Mensais: R$ {monthly_expenses:.2f}
- Total em Reservas: R$ {reserves_total:.2f}
{f"**Contexto adicional:** {context}" if context else ""}

Responda APENAS com JSON válido no seguinte formato:
{{
  "diagnosis": "Diagnóstico da situação financeira atual (máximo 100 palavras)",
  "alerts": ["Alerta 1", "Alerta 2"],
  "recommendations": ["Recomendação 1", "Recomendação 2"],
  "goals": ["Meta 1", "Meta 2"]
}}"""

    messages = [
        {
            "role": "system",
            "content": "Você é um consultor financeiro brasileiro. Responda sempre em português brasileiro. Responda APENAS com JSON válido, sem texto adicional."
        },
        {
            "role": "user",
            "content": prompt
        }
    ]
    
    def _call_with_fallback():
        primary_content, primary_error, primary_latency = asyncio.run(_call_openrouter(
            api_key, model, messages, temperature=0.7, max_tokens=1024, timeout_seconds=timeout_seconds
        ))
        
        print(f"[OpenRouter] Primary model ({model}): latency={primary_latency:.2f}s, error={primary_error}")
        
        if primary_content:
            is_valid, json_data = _validate_json(primary_content)
            if is_valid:
                print(f"[OpenRouter] Primary: JSON válido")
                return primary_content
            else:
                print(f"[OpenRouter] Primary: JSON inválido, tentando reparar...")
                repaired = _try_repair_json(primary_content)
                if repaired:
                    print(f"[OpenRouter] Primary: JSON reparado com sucesso")
                    return json.dumps(repaired)
                print(f"[OpenRouter] Primary: Reparo falhou, usando fallback")
        
        fallback_content, fallback_error, fallback_latency = asyncio.run(_call_openrouter(
            api_key, FALLBACK_MODEL, messages, temperature=0.7, max_tokens=1024, timeout_seconds=timeout_seconds
        ))
        
        print(f"[OpenRouter] Fallback model ({FALLBACK_MODEL}): latency={fallback_latency:.2f}s, error={fallback_error}")
        
        if fallback_content:
            is_valid, json_data = _validate_json(fallback_content)
            if is_valid:
                print(f"[OpenRouter] Fallback: JSON válido")
                return fallback_content
            else:
                print(f"[OpenRouter] Fallback: JSON inválido, tentando reparar...")
                repaired = _try_repair_json(fallback_content)
                if repaired:
                    print(f"[OpenRouter] Fallback: JSON reparado com sucesso")
                    return json.dumps(repaired)
        
        print(f"[OpenRouter] Falha completa: primary_error={primary_error}, fallback_error={fallback_error}")
        return json.dumps({
            "error": "Falha ao gerar análise",
            "diagnosis": "Serviço indisponível",
            "alerts": [],
            "recommendations": [],
            "goals": []
        })
    
    try:
        result = await asyncio.wait_for(
            asyncio.get_event_loop().run_in_executor(None, _call_with_fallback),
            timeout=timeout_seconds * 2
        )
        return result
    except asyncio.TimeoutError:
        print(f"[OpenRouter] Timeout total")
        return json.dumps({
            "error": "Timeout",
            "diagnosis": "Serviço de resposta lenta",
            "alerts": [],
            "recommendations": [],
            "goals": []
        })

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
    Sugere categoria usando OpenRouter
    
    Args:
        description: Descrição da transação
        amount: Valor da transação (em CENTAVOS)
        categories: Lista de categorias disponíveis
        previous_transactions: Exemplos para few-shot learning
        openrouter_api_key: Chave API
        timeout_seconds: Timeout
        max_retries: Tentativas
    
    Returns:
        Tupla (category_id, confidence)
    """
    api_key = openrouter_api_key or os.getenv("OPENROUTER_API_KEY", "")
    api_key = api_key.strip().replace('\r', '').replace('\n', '')
    
    if not api_key or not categories:
        return None, 0.0

    model = os.getenv("OPENROUTER_MODEL", PRIMARY_MODEL)
    
    amount_in_cents = amount
    transaction_type = "INCOME" if amount_in_cents > 0 else "EXPENSE"
    
    relevant_categories = [c for c in categories if c['type'] == transaction_type]

    if not relevant_categories:
        print(f"[OpenRouter] Nenhuma categoria do tipo {transaction_type} disponível")
        return None, 0.0

    categories_text = "\n".join([f"{c['id']}: {c['name']}" for c in relevant_categories])
    
    examples_text = ""
    if previous_transactions:
        examples_list = []
        for txn in previous_transactions:
             examples_list.append(f"- \"{txn['description']}\" -> {txn['category_name']}")
        
        if examples_list:
            examples_text = "\n\nExemplos de categorizações anteriores deste usuário:\n" + "\n".join(examples_list)

    messages = [
        {
            "role": "system",
            "content": "Você é um assistente de categorização financeira. Responda APENAS com JSON válido no formato especificado."
        },
        {
            "role": "user",
            "content": f"""Categorize esta transação financeira brasileira.

Transação: "{description}"
Valor: R$ {abs(amount_in_cents)/100:.2f} ({'receita' if amount_in_cents > 0 else 'despesa'})

Categorias disponíveis:
{categories_text}{examples_text}

Responda APENAS com JSON válido no seguinte formato:
{{
  "category_id": "ID_DA_CATEGORIA",
  "confidence": 0.85
}}

Se não tiver certeza, use confidence baixo (ex: 0.3)."""
        }
    ]
    
    def _call_with_fallback():
        primary_content, primary_error, primary_latency = asyncio.run(_call_openrouter(
            api_key, model, messages, temperature=0.1, max_tokens=100, timeout_seconds=timeout_seconds
        ))
        
        print(f"[OpenRouter] Primary model ({model}): latency={primary_latency:.2f}s, error={primary_error}")
        
        if primary_content:
            is_valid, json_data = _validate_json(primary_content)
            if is_valid and isinstance(json_data, dict):
                category_id = json_data.get("category_id")
                confidence = json_data.get("confidence", 0.0)
                
                if category_id and category_id in [c['id'] for c in relevant_categories]:
                    print(f"[OpenRouter] Primary: categoria={category_id}, confidence={confidence}")
                    return category_id, confidence
                else:
                    print(f"[OpenRouter] Primary: categoria inválida ou não encontrada")
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
        
        fallback_content, fallback_error, fallback_latency = asyncio.run(_call_openrouter(
            api_key, FALLBACK_MODEL, messages, temperature=0.1, max_tokens=100, timeout_seconds=timeout_seconds
        ))
        
        print(f"[OpenRouter] Fallback model ({FALLBACK_MODEL}): latency={fallback_latency:.2f}s, error={fallback_error}")
        
        if fallback_content:
            is_valid, json_data = _validate_json(fallback_content)
            if is_valid and isinstance(json_data, dict):
                category_id = json_data.get("category_id")
                confidence = json_data.get("confidence", 0.0)
                
                if category_id and category_id in [c['id'] for c in relevant_categories]:
                    print(f"[OpenRouter] Fallback: categoria={category_id}, confidence={confidence}")
                    return category_id, confidence
                else:
                    print(f"[OpenRouter] Fallback: categoria inválida ou não encontrada")
            else:
                print(f"[OpenRouter] Fallback: JSON inválido, tentando reparar...")
                repaired = _try_repair_json(fallback_content)
                if repaired and isinstance(repaired, dict):
                    category_id = repaired.get("category_id")
                    confidence = repaired.get("confidence", 0.0)
                    
                    if category_id and category_id in [c['id'] for c in relevant_categories]:
                        print(f"[OpenRouter] Fallback: JSON reparado com sucesso, categoria={category_id}, confidence={confidence}")
                        return category_id, confidence
                    else:
                        print(f"[OpenRouter] Fallback: JSON reparado mas categoria inválida")
                else:
                    print(f"[OpenRouter] Fallback: Reparo falhou")
        
        print(f"[OpenRouter] Falha completa: primary_error={primary_error}, fallback_error={fallback_error}")
        return None, 0.0
    
    last_error = None
    
    for attempt in range(max_retries):
        try:
            result = await asyncio.wait_for(
                asyncio.get_event_loop().run_in_executor(None, _call_with_fallback),
                timeout=timeout_seconds * 2
            )
            
            category_id, confidence = result
            if category_id:
                return category_id, confidence
            else:
                return None, 0.0
                
        except asyncio.TimeoutError:
            last_error = "Timeout"
            if attempt < max_retries - 1:
                await asyncio.sleep(1)
                continue
        except Exception as e:
            last_error = str(e)
            if attempt < max_retries - 1:
                await asyncio.sleep(1)
                continue
    
    print(f"[OpenRouter] ⏱ Falha após {max_retries} tentativas: {last_error}")
    return None, 0.0
