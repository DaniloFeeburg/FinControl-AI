from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os
import sys

# Connection string must be provided via environment variable
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL")

if not SQLALCHEMY_DATABASE_URL:
    print("=" * 80)
    print("ERRO CRÍTICO: Variável de ambiente DATABASE_URL não configurada!")
    print("=" * 80)
    print("")
    print("A aplicação não pode iniciar sem a conexão ao banco de dados.")
    print("")
    print("Para resolver:")
    print("  1. Configure a secret DATABASE_URL no Google Cloud Secret Manager")
    print("  2. Verifique se o cloudbuild.yaml inclui --set-secrets=DATABASE_URL=...")
    print("  3. Em ambiente local, defina: export DATABASE_URL='postgresql://...'")
    print("")
    print("=" * 80)
    sys.exit(1)

try:
    engine = create_engine(
        SQLALCHEMY_DATABASE_URL,
        pool_pre_ping=True,  # Verify connections before using
        pool_recycle=3600,   # Recycle connections after 1 hour
        connect_args={"connect_timeout": 10}
    )
except Exception as e:
    print("=" * 80)
    print("ERRO: Falha ao criar engine do banco de dados")
    print("=" * 80)
    print(f"Detalhes: {str(e)}")
    print("")
    print("Verifique se a DATABASE_URL está correta e o banco está acessível.")
    print("=" * 80)
    sys.exit(1)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
