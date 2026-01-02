"""
Serviço para parsing e processamento de arquivos OFX
"""
from ofxparse import OfxParser
from datetime import datetime
from typing import List, Optional, Tuple
import base64
import io
from sqlalchemy.orm import Session

from .schemas import (
    OFXTransactionParsed,
    OFXAccountInfo,
    OFXParseResponse,
    ImportTransactionPreview
)
from . import crud


def parse_ofx_file(file_content: str) -> OFXParseResponse:
    """
    Parse arquivo OFX e retorna dados estruturados

    Args:
        file_content: Conteúdo do arquivo OFX em base64

    Returns:
        OFXParseResponse com informações da conta e transações
    """
    try:
        # Decodifica de base64
        ofx_bytes = base64.b64decode(file_content)

        # Tenta decodificar com diferentes encodings para lidar com caracteres especiais
        ofx_text = None
        for encoding in ['utf-8', 'latin-1', 'iso-8859-1', 'cp1252']:
            try:
                ofx_text = ofx_bytes.decode(encoding)
                break
            except UnicodeDecodeError:
                continue

        if ofx_text is None:
            raise ValueError("Não foi possível decodificar o arquivo OFX. Encoding não suportado.")

        # Re-encode para UTF-8 e cria o BytesIO
        ofx_file = io.BytesIO(ofx_text.encode('utf-8'))

        # Parse do arquivo OFX
        ofx = OfxParser.parse(ofx_file)

        # Pega a primeira conta (a maioria dos OFX tem apenas uma)
        account = ofx.account

        # Determina o tipo de conta
        account_type = "CHECKING"  # Padrão
        if hasattr(account, 'account_type'):
            account_type = account.account_type.upper()
        elif hasattr(ofx, 'account') and hasattr(ofx.account, 'type'):
            account_type = ofx.account.type.upper()

        # Informações da conta
        account_info = OFXAccountInfo(
            account_id=str(account.account_id) if hasattr(account, 'account_id') else "N/A",
            routing_number=str(account.routing_number) if hasattr(account, 'routing_number') else None,
            account_type=account_type,
            currency=str(account.statement.currency) if hasattr(account.statement, 'currency') else "BRL",
            bank_id=str(account.institution.fid) if hasattr(account, 'institution') and hasattr(account.institution, 'fid') else None
        )

        # Parse das transações
        transactions = []
        for txn in account.statement.transactions:
            # Formata a data
            txn_date = txn.date.strftime('%Y-%m-%d') if hasattr(txn.date, 'strftime') else str(txn.date)[:10]

            # Descrição (payee pode ser None em alguns bancos)
            payee = txn.payee if txn.payee else (txn.memo if txn.memo else "Transação sem descrição")

            # Converte o valor para float (alguns bancos brasileiros podem usar vírgula)
            amount_value = txn.amount
            if isinstance(amount_value, str):
                # Remove pontos de milhares e substitui vírgula por ponto
                amount_value = amount_value.replace('.', '').replace(',', '.')

            transactions.append(OFXTransactionParsed(
                payee=str(payee).strip(),
                amount=float(amount_value),
                date=txn_date,
                memo=str(txn.memo).strip() if txn.memo else None,
                fitid=str(txn.id) if hasattr(txn, 'id') else None,
                check_num=str(txn.checknum) if hasattr(txn, 'checknum') and txn.checknum else None
            ))

        # Datas do extrato
        start_date = account.statement.start_date.strftime('%Y-%m-%d') if hasattr(account.statement.start_date, 'strftime') else str(account.statement.start_date)[:10]
        end_date = account.statement.end_date.strftime('%Y-%m-%d') if hasattr(account.statement.end_date, 'strftime') else str(account.statement.end_date)[:10]

        # Saldo final
        balance = float(account.statement.balance) if hasattr(account.statement, 'balance') else None

        return OFXParseResponse(
            account_info=account_info,
            transactions=transactions,
            start_date=start_date,
            end_date=end_date,
            balance=balance
        )

    except Exception as e:
        raise ValueError(f"Erro ao processar arquivo OFX: {str(e)}")


def clean_description(description: str, memo: Optional[str] = None) -> str:
    """
    Limpa e formata a descrição da transação

    Args:
        description: Descrição principal (payee)
        memo: Informações adicionais

    Returns:
        Descrição limpa e formatada
    """
    # Remove espaços extras
    cleaned = " ".join(description.split())

    # Se tiver memo e for diferente da descrição, adiciona
    if memo and memo.strip() and memo.strip() != cleaned:
        memo_clean = " ".join(memo.split())
        if memo_clean not in cleaned:
            cleaned = f"{cleaned} - {memo_clean}"

    # Limita tamanho
    if len(cleaned) > 200:
        cleaned = cleaned[:197] + "..."

    return cleaned


def detect_duplicate(
    db: Session,
    user_id: str,
    amount: float,
    date: str,
    description: str,
    fitid: Optional[str] = None
) -> Tuple[bool, Optional[str]]:
    """
    Detecta se uma transação já existe no sistema

    Args:
        db: Sessão do banco de dados
        user_id: ID do usuário
        amount: Valor da transação
        date: Data da transação
        description: Descrição da transação
        fitid: ID único da transação no banco (se disponível)

    Returns:
        Tuple (is_duplicate, transaction_id)
    """
    # Busca transações do usuário na mesma data
    existing = crud.get_transactions(
        db=db,
        user_id=user_id,
        skip=0,
        limit=1000,  # Limite alto para verificar todas as transações do dia
        start_date=date,
        end_date=date
    )

    # Verifica por FITID exato (mais confiável)
    if fitid:
        for txn in existing:
            # Aqui você precisaria armazenar o FITID no banco para comparação
            # Por enquanto, vamos apenas comparar valor e descrição
            pass

    # Verifica por valor e descrição similares
    for txn in existing:
        # Mesma data, mesmo valor (com tolerância de 0.01)
        if abs(float(txn.amount) - amount) < 0.01:
            # Descrição similar (contém ou é contida)
            txn_desc = txn.description.lower()
            check_desc = description.lower()

            if txn_desc in check_desc or check_desc in txn_desc:
                return True, txn.id

    return False, None


async def suggest_category_with_ai(
    description: str,
    amount: float,
    categories: List[dict],
    gemini_api_key: str = "",  # Mantido para compatibilidade, mas Groq é preferido
    timeout_seconds: int = 10,
    max_retries: int = 3,
    groq_api_key: str = ""
) -> Tuple[Optional[str], float]:
    """
    Sugere categoria baseado na descrição usando IA.
    Usa Groq (gratuito) como provedor principal, com fallback para Gemini.

    Args:
        description: Descrição da transação
        amount: Valor da transação (negativo = despesa, positivo = receita)
        categories: Lista de categorias disponíveis [{id, name, type}]
        gemini_api_key: Chave da API do Gemini (fallback)
        timeout_seconds: Timeout em segundos para a chamada da API (padrão: 10s)
        max_retries: Número máximo de tentativas em caso de erro (padrão: 3)
        groq_api_key: Chave da API do Groq (preferido)

    Returns:
        Tuple (category_id, confidence_score)
    """
    import asyncio
    import os
    
    # Obtém API keys das variáveis de ambiente se não fornecidas
    groq_key = groq_api_key or os.getenv("GROQ_API_KEY", "")
    gemini_key = gemini_api_key or os.getenv("GEMINI_API_KEY", "")
    
    if not categories:
        return None, 0.0
    
    # Tenta Groq primeiro (gratuito e rápido)
    if groq_key:
        try:
            from .ai_groq import suggest_category
            
            category_id, confidence = await suggest_category(
                description=description,
                amount=amount,
                categories=categories,
                groq_api_key=groq_key,
                timeout_seconds=timeout_seconds,
                max_retries=max_retries
            )
            
            if category_id:
                return category_id, confidence
                
        except Exception as e:
            print(f"[IA] Erro com Groq, tentando Gemini: {str(e)}")
    
    # Fallback: Gemini
    if gemini_key:
        try:
            import time
            from google import genai

            # Filtra categorias por tipo (receita ou despesa)
            transaction_type = "INCOME" if amount > 0 else "EXPENSE"
            relevant_categories = [c for c in categories if c['type'] == transaction_type]

            if not relevant_categories:
                print(f"[IA] Nenhuma categoria do tipo {transaction_type} disponível")
                return None, 0.0

            # Prepara o prompt
            categories_text = "\n".join([f"{c['id']}: {c['name']}" for c in relevant_categories])

            prompt = f"""Categorize esta transação financeira brasileira.

Transação: "{description}"
Valor: R$ {abs(amount):.2f} ({'receita' if amount > 0 else 'despesa'})

Categorias disponíveis:
{categories_text}

Responda EXATAMENTE neste formato: ID_DA_CATEGORIA|CONFIANCA
Exemplo: abc123|0.85

Se não tiver certeza, responda: none|0.0"""

            # Função interna para fazer a chamada síncrona com retry
            def _call_gemini_with_retry():
                client = genai.Client(api_key=gemini_key)
                last_exception = None
                
                for attempt in range(max_retries):
                    try:
                        response = client.models.generate_content(
                            model='gemini-2.5-flash',
                            contents=prompt
                        )
                        return response.text.strip()
                    except Exception as e:
                        last_exception = e
                        error_str = str(e).lower()
                        
                        is_rate_limit = (
                            '429' in error_str or 
                            'rate' in error_str or 
                            'quota' in error_str or
                            'resource_exhausted' in error_str or
                            'too many requests' in error_str
                        )
                        
                        if is_rate_limit and attempt < max_retries - 1:
                            wait_time = (2 ** attempt) * 1.0
                            print(f"[IA-Gemini] ⚠ Rate limit. Aguardando {wait_time}s (tentativa {attempt + 1}/{max_retries})")
                            time.sleep(wait_time)
                        elif not is_rate_limit:
                            raise e
                
                if last_exception:
                    raise last_exception
                return None

            # Executa em thread separada com timeout
            loop = asyncio.get_event_loop()
            result = await asyncio.wait_for(
                loop.run_in_executor(None, _call_gemini_with_retry),
                timeout=timeout_seconds * max_retries
            )

            if result is None:
                return None, 0.0

            print(f"[IA-Gemini] Descrição: {description[:50]}, Resposta: {result}")

            if '|' in result:
                parts = result.split('|')
                if len(parts) >= 2:
                    category_id = parts[0].strip()
                    try:
                        confidence = float(parts[1].strip())
                    except:
                        confidence = 0.0

                    if category_id != 'none' and category_id in [c['id'] for c in relevant_categories]:
                        print(f"[IA-Gemini] ✓ Categoria sugerida: {category_id} (confiança: {confidence})")
                        return category_id, confidence

            print(f"[IA-Gemini] ✗ Resposta inválida ou categoria não encontrada")
            return None, 0.0

        except asyncio.TimeoutError:
            print(f"[IA-Gemini] ⏱ Timeout ao categorizar: {description[:50]}")
            return None, 0.0
        except Exception as e:
            error_str = str(e).lower()
            if '429' in error_str or 'rate' in error_str or 'quota' in error_str:
                print(f"[IA-Gemini] ⚠ Rate limit excedido: {description[:50]}")
            else:
                print(f"[IA-Gemini] ERRO ao sugerir categoria: {str(e)}")
            return None, 0.0
    
    # Nenhum provedor configurado
    print("[IA] Nenhum provedor de IA configurado (GROQ_API_KEY ou GEMINI_API_KEY)")
    return None, 0.0


def create_import_preview(
    ofx_transaction: OFXTransactionParsed,
    is_duplicate: bool,
    duplicate_id: Optional[str],
    suggested_category_id: Optional[str],
    confidence_score: float
) -> ImportTransactionPreview:
    """
    Cria um preview de transação para importação

    Args:
        ofx_transaction: Dados da transação do OFX
        is_duplicate: Se é duplicata
        duplicate_id: ID da transação duplicada
        suggested_category_id: Categoria sugerida pela IA
        confidence_score: Confiança da sugestão

    Returns:
        ImportTransactionPreview
    """
    # Limpa a descrição
    cleaned_desc = clean_description(ofx_transaction.payee, ofx_transaction.memo)

    return ImportTransactionPreview(
        ofx_data=ofx_transaction,
        suggested_category_id=suggested_category_id,
        suggested_description=cleaned_desc,
        amount=ofx_transaction.amount,
        date=ofx_transaction.date,
        status="PAID",  # OFX geralmente contém transações já realizadas
        is_duplicate=is_duplicate,
        duplicate_transaction_id=duplicate_id,
        confidence_score=confidence_score
    )
