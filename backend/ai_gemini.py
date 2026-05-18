import os
import time
import asyncio
import logging
from typing import Optional, List, Tuple

logger = logging.getLogger(__name__)

GEMINI_MODEL = "gemini-2.0-flash"

GEMINI_FREE_RPM = 15
GEMINI_FREE_RPD = 1500
RATE_WINDOW_SECONDS = 60


class _RateLimiter:
    def __init__(self, rpm: int = GEMINI_FREE_RPM):
        self._rpm = rpm
        self._min_interval = RATE_WINDOW_SECONDS / rpm
        self._lock = asyncio.Lock()
        self._last_request_time = 0.0

    async def acquire(self):
        async with self._lock:
            now = time.monotonic()
            elapsed = now - self._last_request_time
            wait = self._min_interval - elapsed

            if wait > 0:
                logger.debug(f"[Gemini RateLimiter] Aguardando {wait:.2f}s")
                await asyncio.sleep(wait)

            self._last_request_time = time.monotonic()


_rate_limiter = _RateLimiter(GEMINI_FREE_RPM)


def configure_rate_limit(rpm: int):
    global _rate_limiter
    _rate_limiter = _RateLimiter(rpm)
    logger.info(f"[Gemini] Rate limiter configurado para {rpm} RPM")


def _configure_genai(api_key: Optional[str] = None):
    from google import generativeai as genai

    key = api_key or os.getenv("GEMINI_API_KEY", "")
    key = key.strip().replace("\r", "").replace("\n", "")

    if not key:
        return None

    genai.configure(api_key=key)
    return genai.GenerativeModel(GEMINI_MODEL)


async def suggest_category(
    description: str,
    amount: float,
    categories: List[dict],
    previous_transactions: List[dict] = [],
    gemini_api_key: Optional[str] = None,
    timeout_seconds: int = 20,
    max_retries: int = 3,
) -> Tuple[Optional[str], float]:
    model = _configure_genai(gemini_api_key)

    if not model or not categories:
        return None, 0.0

    amount_in_cents = amount
    transaction_type = "INCOME" if amount_in_cents > 0 else "EXPENSE"

    relevant_categories = [c for c in categories if c["type"] == transaction_type]

    if not relevant_categories:
        logger.warning(f"[Gemini] Nenhuma categoria do tipo {transaction_type} disponível")
        return None, 0.0

    categories_text = "\n".join([f"{c['id']}: {c['name']}" for c in relevant_categories])

    examples_text = ""
    if previous_transactions:
        examples_list = []
        for txn in previous_transactions:
            examples_list.append(f"- \"{txn['description']}\" -> {txn['category_name']}")

        if examples_list:
            examples_text = "\n\nExemplos de categorizações anteriores deste usuário:\n" + "\n".join(
                examples_list
            )

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
            await _rate_limiter.acquire()

            def _call_ai():
                response = model.generate_content(
                    prompt,
                    generation_config={
                        "temperature": 0.1,
                        "max_output_tokens": 50,
                    },
                )
                return response.text

            loop = asyncio.get_event_loop()
            result = await asyncio.wait_for(
                loop.run_in_executor(None, _call_ai),
                timeout=timeout_seconds,
            )

            result = result.strip()
            logger.debug(f"[Gemini] Descrição: {description[:50]}, Resposta: {result}")

            if "|" in result:
                parts = result.split("|")
                if len(parts) >= 2:
                    category_id = parts[0].strip()
                    try:
                        confidence = float(parts[1].strip())
                    except ValueError:
                        confidence = 0.0

                    if category_id != "none" and category_id in [c["id"] for c in relevant_categories]:
                        return category_id, confidence

            logger.warning("[Gemini] Resposta inválida ou categoria não encontrada")
            return None, 0.0

        except asyncio.TimeoutError:
            last_error = "Timeout"
            if attempt < max_retries - 1:
                await asyncio.sleep(1)
                continue
        except Exception as e:
            error_str = str(e).lower()
            last_error = str(e)

            if "429" in error_str or "quota" in error_str or "rate" in error_str or "resource_exhausted" in error_str:
                if attempt < max_retries - 1:
                    wait_time = (2**attempt) * 5
                    logger.warning(
                        f"[Gemini] Rate limit (429). Aguardando {wait_time}s (tentativa {attempt + 1}/{max_retries})"
                    )
                    await asyncio.sleep(wait_time)
                    continue

            logger.error(f"[Gemini] Erro: {str(e)}")
            if attempt < max_retries - 1:
                await asyncio.sleep(1)
                continue

    logger.error(f"[Gemini] Falha após {max_retries} tentativas: {last_error}")
    return None, 0.0


async def get_financial_analysis(
    balance: float,
    monthly_income: float,
    monthly_expenses: float,
    reserves_total: float,
    context: Optional[str] = None,
    gemini_api_key: Optional[str] = None,
    timeout_seconds: int = 45,
) -> str:
    model = _configure_genai(gemini_api_key)

    if not model:
        return "Configure a variável GEMINI_API_KEY para habilitar análises inteligentes."

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
        await _rate_limiter.acquire()

        def _call_ai():
            response = model.generate_content(
                prompt,
                generation_config={
                    "temperature": 0.7,
                    "max_output_tokens": 1024,
                },
            )
            return response.text

        loop = asyncio.get_event_loop()
        result = await asyncio.wait_for(
            loop.run_in_executor(None, _call_ai),
            timeout=timeout_seconds,
        )

        return result

    except asyncio.TimeoutError:
        return "Timeout ao gerar análise. Tente novamente."
    except Exception as e:
        logger.error(f"[Gemini] Erro ao gerar análise: {str(e)}")
        return f"Erro ao conectar com serviço de IA: {str(e)}"
