import os
import sys
from sqlalchemy.orm import Session
from backend.database import engine, SessionLocal, Base
from backend import models, crud, schemas

def init_db():
    print("Initializing database...")

    # DROP tables only if in DEV environment
    # User requested to drop tables (dev only)
    if os.getenv("ENVIRONMENT") == "dev":
        print("DEV environment detected. Dropping all tables...")
        Base.metadata.drop_all(bind=engine)

    # CREATE tables
    print("Creating tables...")
    Base.metadata.create_all(bind=engine)
    print("Tables created successfully.")

    # Create Demo User
    db = SessionLocal()
    try:
        demo_email = "demo@fincontrol.ai"
        user = crud.get_user_by_email(db, email=demo_email)
        if not user:
            print(f"Creating demo user: {demo_email}")
            demo_user = schemas.UserCreate(
                email=demo_email,
                password="demo123",
                name="Demo User"
            )
            crud.create_user(db, demo_user)
            print("Demo user created.")
        else:
            print("Demo user already exists.")
    except Exception as e:
        print(f"Error initializing data: {e}")
        # We don't exit here to allow the app to start even if seed fails,
        # but for a critical init script maybe we should?
        # The user didn't specify error handling behavior strictly.
    finally:
        db.close()

if __name__ == "__main__":
    init_db()
