"""
Script para adicionar índices ao banco de dados existente.
Execute este script após o deploy para melhorar a performance.

Uso:
    python -m backend.add_indexes
"""
from sqlalchemy import text
from .database import engine
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def add_indexes():
    """Adiciona índices de forma segura (IF NOT EXISTS para PostgreSQL)"""
    
    indexes = [
        # Transaction indexes
        "CREATE INDEX IF NOT EXISTS idx_transaction_user_date ON transactions (user_id, date)",
        "CREATE INDEX IF NOT EXISTS idx_transaction_user_category ON transactions (user_id, category_id)",
        "CREATE INDEX IF NOT EXISTS idx_transaction_user_card ON transactions (user_id, credit_card_id)",
        "CREATE INDEX IF NOT EXISTS idx_transaction_user_status ON transactions (user_id, status)",
        
        # Category indexes
        "CREATE INDEX IF NOT EXISTS idx_category_user_type ON categories (user_id, type)",
        
        # RecurringRule indexes
        "CREATE INDEX IF NOT EXISTS idx_recurring_user_active ON recurring_rules (user_id, active)",
        "CREATE INDEX IF NOT EXISTS idx_recurring_user_card ON recurring_rules (user_id, credit_card_id)",
        
        # CreditCard indexes
        "CREATE INDEX IF NOT EXISTS idx_creditcard_user_active ON credit_cards (user_id, active)",
    ]
    
    with engine.connect() as conn:
        for idx_sql in indexes:
            try:
                logger.info(f"Executando: {idx_sql}")
                conn.execute(text(idx_sql))
                conn.commit()
                logger.info("✓ Índice criado com sucesso")
            except Exception as e:
                logger.error(f"✗ Erro ao criar índice: {e}")
                conn.rollback()
    
    logger.info("Processo de criação de índices concluído!")

if __name__ == "__main__":
    logger.info("Iniciando adição de índices...")
    add_indexes()


