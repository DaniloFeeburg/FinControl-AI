import os
import sys
from sqlalchemy import text, inspect
from sqlalchemy.orm import Session
from backend.database import engine, SessionLocal, Base
from backend import models, crud, schemas

def check_and_migrate_table(conn, table_name, demo_user_id):
    """
    Verifica se a tabela possui a coluna user_id. Se não, adiciona a coluna,
    define o user_id do usuário demo para os registros existentes e cria a foreign key.
    """
    inspector = inspect(conn)
    columns = [col['name'] for col in inspector.get_columns(table_name)]

    if 'user_id' not in columns:
        print(f"Migrating table {table_name}: Adding user_id column...")
        # Adiciona coluna user_id permitindo NULL inicialmente
        conn.execute(text(f"ALTER TABLE {table_name} ADD COLUMN user_id VARCHAR"))

        # Atualiza registros existentes para pertencerem ao usuário demo
        if demo_user_id:
            print(f"Assigning existing records in {table_name} to demo user {demo_user_id}...")
            conn.execute(text(f"UPDATE {table_name} SET user_id = :uid"), {"uid": demo_user_id})

        # Adiciona constraint FK
        print(f"Adding foreign key constraint to {table_name}...")
        try:
            conn.execute(text(f"ALTER TABLE {table_name} ADD CONSTRAINT fk_{table_name}_user FOREIGN KEY (user_id) REFERENCES users(id)"))
        except Exception as e:
            print(f"Warning: Could not add FK constraint to {table_name} (might already allow inconsistent data): {e}")

        conn.commit()
        print(f"Table {table_name} migrated successfully.")
    else:
        print(f"Table {table_name} already has user_id.")

def init_db():
    print("Initializing database...")

    # DROP tables only if in DEV environment
    if os.getenv("ENVIRONMENT") == "dev":
        print("DEV environment detected. Dropping all tables...")
        Base.metadata.drop_all(bind=engine)

    # CREATE tables (cria apenas as que não existem, ex: users se for a primeira vez)
    print("Creating tables (if not exist)...")
    Base.metadata.create_all(bind=engine)
    print("Tables structure verification completed.")

    # Create Demo User & Migrate Data
    db = SessionLocal()
    try:
        # 1. Garantir que usuário demo existe (necessário para migração de dados orfãos)
        demo_email = "demo@fincontrol.ai"
        user = crud.get_user_by_email(db, email=demo_email)
        demo_user_id = None

        if not user:
            print(f"Creating demo user: {demo_email}")
            demo_user = schemas.UserCreate(
                email=demo_email,
                password="demo123",
                name="Demo User"
            )
            # Precisamos criar via crud, mas commitamos para ter o ID disponível
            created_user = crud.create_user(db, demo_user)
            demo_user_id = created_user.id
            print(f"Demo user created with ID: {demo_user_id}")
        else:
            demo_user_id = user.id
            print(f"Demo user already exists with ID: {demo_user_id}")

        # 2. Executar migrações de schema para tabelas antigas
        # Tabelas que precisam de user_id
        tables_to_migrate = ['categories', 'transactions', 'recurring_rules', 'reserves', 'credit_cards']

        with engine.connect() as conn:
            for table in tables_to_migrate:
                # Verifica se a tabela existe antes de tentar migrar
                inspector = inspect(conn)
                if inspector.has_table(table):
                    check_and_migrate_table(conn, table, demo_user_id)

            # Migrate recurring_rules (auto_create, last_execution, next_execution)
            inspector = inspect(conn)
            if inspector.has_table("recurring_rules"):
                cols = [c['name'] for c in inspector.get_columns("recurring_rules")]
                if "auto_create" not in cols:
                    print("Migrating recurring_rules: Adding auto_create, last_execution, next_execution...")
                    conn.execute(text("ALTER TABLE recurring_rules ADD COLUMN auto_create BOOLEAN DEFAULT FALSE"))
                    conn.execute(text("ALTER TABLE recurring_rules ADD COLUMN last_execution VARCHAR"))
                    conn.execute(text("ALTER TABLE recurring_rules ADD COLUMN next_execution VARCHAR"))
                    conn.commit()

                if "end_date" not in cols:
                    print("Migrating recurring_rules: Adding end_date column...")
                    conn.execute(text("ALTER TABLE recurring_rules ADD COLUMN end_date VARCHAR"))
                    conn.commit()

            # Migrate transactions (credit_card_id)
            if inspector.has_table("transactions"):
                cols = [c['name'] for c in inspector.get_columns("transactions")]
                if "credit_card_id" not in cols:
                    print("Migrating transactions: Adding credit_card_id column...")
                    conn.execute(text("ALTER TABLE transactions ADD COLUMN credit_card_id VARCHAR REFERENCES credit_cards(id)"))
                    conn.commit()
                if "recurring_rule_id" not in cols:
                    print("Migrating transactions: Adding recurring_rule_id column...")
                    conn.execute(text("ALTER TABLE transactions ADD COLUMN recurring_rule_id VARCHAR REFERENCES recurring_rules(id)"))
                    conn.commit()

            if inspector.has_table("recurring_rules"):
                cols = [c['name'] for c in inspector.get_columns("recurring_rules")]
                if "credit_card_id" not in cols:
                    print("Migrating recurring_rules: Adding credit_card_id column...")
                    conn.execute(text("ALTER TABLE recurring_rules ADD COLUMN credit_card_id VARCHAR REFERENCES credit_cards(id)"))
                    conn.commit()

    except Exception as e:
        print(f"Error initializing/migrating data: {e}")
        # Importante: não crashar o container se a migração falhar parcialmente,
        # mas logar erro crítico.
    finally:
        db.close()

if __name__ == "__main__":
    init_db()
