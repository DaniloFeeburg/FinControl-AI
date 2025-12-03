from fastapi import FastAPI, Depends, HTTPException, Body, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from . import models, schemas, crud, auth
from .database import engine, get_db

models.Base.metadata.create_all(bind=engine)

app = FastAPI()

@app.get("/")
def root():
    return {"message": "FinControl AI API is running"}

@app.get("/config")
def get_config():
    """Endpoint para fornecer configurações públicas ao frontend"""
    import os
    return {
        "gemini_api_key": os.getenv("GEMINI_API_KEY", "")
    }

# Allow CORS for frontend (assuming localhost or same origin)
origins = [
    "http://localhost",
    "http://localhost:3000",
    "http://localhost:8080",
    "*" # Relaxed for now
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Auth Endpoints
@app.post("/auth/register", response_model=schemas.Token)
def register(user: schemas.UserCreate, db: Session = Depends(get_db)):
    db_user = crud.get_user_by_email(db, email=user.email)
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    crud.create_user(db=db, user=user)
    access_token = auth.create_access_token(data={"sub": user.email})
    return {"access_token": access_token, "token_type": "bearer"}

@app.post("/auth/login", response_model=schemas.Token)
def login(user_login: schemas.UserLogin, db: Session = Depends(get_db)):
    user = crud.get_user_by_email(db, email=user_login.email)
    if not user or not auth.verify_password(user_login.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token = auth.create_access_token(data={"sub": user.email})
    return {"access_token": access_token, "token_type": "bearer"}

@app.post("/auth/me", response_model=schemas.User)
def read_users_me(current_user: schemas.User = Depends(auth.get_current_user)):
    return current_user

# Protected Endpoints

@app.get("/categories", response_model=List[schemas.Category])
def read_categories(db: Session = Depends(get_db), current_user: schemas.User = Depends(auth.get_current_user)):
    return crud.get_categories(db, user_id=current_user.id)

@app.post("/categories", response_model=schemas.Category)
def create_category(category: schemas.CategoryCreate, db: Session = Depends(get_db), current_user: schemas.User = Depends(auth.get_current_user)):
    return crud.create_category(db, category, user_id=current_user.id)

@app.put("/categories/{category_id}", response_model=schemas.Category)
def update_category(category_id: str, category: schemas.CategoryCreate, db: Session = Depends(get_db), current_user: schemas.User = Depends(auth.get_current_user)):
    return crud.update_category(db, category_id, category, user_id=current_user.id)

@app.delete("/categories/{category_id}")
def delete_category(category_id: str, db: Session = Depends(get_db), current_user: schemas.User = Depends(auth.get_current_user)):
    crud.delete_category(db, category_id, user_id=current_user.id)
    return {"ok": True}

@app.get("/transactions", response_model=List[schemas.Transaction])
def read_transactions(db: Session = Depends(get_db), current_user: schemas.User = Depends(auth.get_current_user)):
    return crud.get_transactions(db, user_id=current_user.id)

@app.post("/transactions", response_model=schemas.Transaction)
def create_transaction(transaction: schemas.TransactionCreate, db: Session = Depends(get_db), current_user: schemas.User = Depends(auth.get_current_user)):
    return crud.create_transaction(db, transaction, user_id=current_user.id)

@app.put("/transactions/{transaction_id}", response_model=schemas.Transaction)
def update_transaction(transaction_id: str, transaction: schemas.TransactionCreate, db: Session = Depends(get_db), current_user: schemas.User = Depends(auth.get_current_user)):
    return crud.update_transaction(db, transaction_id, transaction, user_id=current_user.id)

@app.delete("/transactions/{transaction_id}")
def delete_transaction(transaction_id: str, db: Session = Depends(get_db), current_user: schemas.User = Depends(auth.get_current_user)):
    crud.delete_transaction(db, transaction_id, user_id=current_user.id)
    return {"ok": True}

@app.get("/recurring_rules", response_model=List[schemas.RecurringRule])
def read_recurring_rules(db: Session = Depends(get_db), current_user: schemas.User = Depends(auth.get_current_user)):
    return crud.get_recurring_rules(db, user_id=current_user.id)

@app.post("/recurring_rules", response_model=schemas.RecurringRule)
def create_recurring_rule(rule: schemas.RecurringRuleCreate, db: Session = Depends(get_db), current_user: schemas.User = Depends(auth.get_current_user)):
    return crud.create_recurring_rule(db, rule, user_id=current_user.id)

@app.get("/reserves", response_model=List[schemas.Reserve])
def read_reserves(db: Session = Depends(get_db), current_user: schemas.User = Depends(auth.get_current_user)):
    return crud.get_reserves(db, user_id=current_user.id)

@app.post("/reserves", response_model=schemas.Reserve)
def create_reserve(reserve: schemas.ReserveCreate, db: Session = Depends(get_db), current_user: schemas.User = Depends(auth.get_current_user)):
    return crud.create_reserve(db, reserve, user_id=current_user.id)

@app.put("/reserves/{reserve_id}", response_model=schemas.Reserve)
def update_reserve(reserve_id: str, reserve: schemas.ReserveCreate, db: Session = Depends(get_db), current_user: schemas.User = Depends(auth.get_current_user)):
    return crud.update_reserve(db, reserve_id, reserve, user_id=current_user.id)

@app.delete("/reserves/{reserve_id}")
def delete_reserve(reserve_id: str, db: Session = Depends(get_db), current_user: schemas.User = Depends(auth.get_current_user)):
    crud.delete_reserve(db, reserve_id, user_id=current_user.id)
    return {"ok": True}

class ReserveTransactionRequest(BaseModel):
    amount: float
    type: str

@app.post("/reserves/{reserve_id}/transactions", response_model=schemas.Reserve)
def create_reserve_transaction(reserve_id: str, request: ReserveTransactionRequest, db: Session = Depends(get_db), current_user: schemas.User = Depends(auth.get_current_user)):
    return crud.create_reserve_history(db, reserve_id, request.amount, request.type, user_id=current_user.id)
