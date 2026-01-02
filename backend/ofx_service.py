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

            # Converte o valor para float de forma robusta
            amount_value = txn.amount
            if isinstance(amount_value, str):
                # Tenta detectar formato
                clean_val = amount_value.strip()
                
                # Caso 1: Formato PT-BR explícito (tem ponto e vírgula, vírgula é decimal)
                # Ex: 1.234,56
                if '.' in clean_val and ',' in clean_val:
                    if clean_val.find(',') > clean_val.find('.'):
                        amount_value = clean_val.replace('.', '').replace(',', '.')
                    else:
                        # Ex: 1,234.56 (US invertido/misturado?) -> Assume US
                        amount_value = clean_val.replace(',', '')
                
                # Caso 2: Apenas vírgula (Ex: 1234,56 ou 12,34) -> Assume PT-BR se não for confuso
                elif ',' in clean_val:
                    amount_value = clean_val.replace(',', '.')
                
                # Caso 3: Apenas ponto (Ex: 1234.56) -> Assume US (padrão OFX)
                # O código anterior removia o ponto, causando erro (9.98 -> 998.0)
                # Mantemos o ponto como decimal
                pass
            
            # Garante float
            try:
                final_amount = float(amount_value)
            except ValueError:
                # Fallback para o comportamento antigo se falhar
                val_str = str(txn.amount).replace('.', '').replace(',', '.')
                final_amount = float(val_str)

            # IMPORTANTE: O sistema armazena valores em CENTAVOS no banco de dados.
            # O frontend espera receber 1000.0 para exibir R$ 10,00.
            # Portanto, precisamos multiplicar o valor em reais do OFX por 100.
            final_amount_cents = final_amount * 100

            transactions.append(OFXTransactionParsed(
                payee=str(payee).strip(),
                amount=final_amount_cents,
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
    previous_transactions: List[dict] = [],
    gemini_api_key: str = "",  # Mantido para compatibilidade
    timeout_seconds: int = 15,
    max_retries: int = 3,
    openrouter_api_key: str = ""
) -> Tuple[Optional[str], float]:
    """
    Sugere categoria baseado na descrição usando IA.
    Usa apenas OpenRouter (Xiaomi MiMo, gratuito) como provedor principal.
    """
    import asyncio
    import os
    
    # Obtém API key do OpenRouter
    openrouter_key = openrouter_api_key or os.getenv("OPENROUTER_API_KEY", "")
    
    if not categories:
        return None, 0.0
    
    if openrouter_key:
        try:
            from .ai_openrouter import suggest_category
            
            category_id, confidence = await suggest_category(
                description=description,
                amount=amount,
                categories=categories,
                previous_transactions=previous_transactions,
                openrouter_api_key=openrouter_key,
                timeout_seconds=timeout_seconds,
                max_retries=max_retries
            )
            
            return category_id, confidence
                
        except Exception as e:
            print(f"[IA-OpenRouter] Erro ao sugerir categoria: {str(e)}")
            return None, 0.0
    
    # Nenhum provedor configurado
    print("[IA] OPENROUTER_API_KEY não configurada")
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
