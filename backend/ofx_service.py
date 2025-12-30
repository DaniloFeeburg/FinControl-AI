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
        ofx_file = io.BytesIO(ofx_bytes)

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
    gemini_api_key: str
) -> Tuple[Optional[str], float]:
    """
    Usa Google Gemini para sugerir categoria baseado na descrição

    Args:
        description: Descrição da transação
        amount: Valor da transação (negativo = despesa, positivo = receita)
        categories: Lista de categorias disponíveis [{id, name, type}]
        gemini_api_key: Chave da API do Gemini

    Returns:
        Tuple (category_id, confidence_score)
    """
    from google import genai
    from google.genai import types

    if not gemini_api_key or not categories:
        return None, 0.0

    try:
        # Inicializa o cliente com a API key
        client = genai.Client(api_key=gemini_api_key)

        # Filtra categorias por tipo (receita ou despesa)
        transaction_type = "INCOME" if amount > 0 else "EXPENSE"
        relevant_categories = [c for c in categories if c['type'] == transaction_type]

        if not relevant_categories:
            print(f"[IA] Nenhuma categoria do tipo {transaction_type} disponível")
            return None, 0.0

        # Prepara o prompt - SIMPLIFICADO para melhor parsing
        categories_text = "\n".join([f"{c['id']}: {c['name']}" for c in relevant_categories])

        prompt = f"""Categorize esta transação financeira brasileira.

Transação: "{description}"
Valor: R$ {abs(amount):.2f} ({'receita' if amount > 0 else 'despesa'})

Categorias disponíveis:
{categories_text}

Responda EXATAMENTE neste formato: ID_DA_CATEGORIA|CONFIANCA
Exemplo: abc123|0.85

Se não tiver certeza, responda: none|0.0"""

        # Usa o modelo gemini-2.5-flash (modelo atualizado e disponível)
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt
        )

        result = response.text.strip()

        print(f"[IA] Descrição: {description[:50]}, Resposta: {result}")

        # Parse da resposta com tratamento robusto
        if '|' in result:
            parts = result.split('|')
            if len(parts) >= 2:
                category_id = parts[0].strip()
                try:
                    confidence = float(parts[1].strip())
                except:
                    confidence = 0.0

                # Valida se o category_id existe
                if category_id != 'none' and category_id in [c['id'] for c in relevant_categories]:
                    print(f"[IA] ✓ Categoria sugerida: {category_id} (confiança: {confidence})")
                    return category_id, confidence

        print(f"[IA] ✗ Resposta inválida ou categoria não encontrada")
        return None, 0.0

    except Exception as e:
        print(f"[IA] ERRO ao sugerir categoria: {str(e)}")
        import traceback
        traceback.print_exc()
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
