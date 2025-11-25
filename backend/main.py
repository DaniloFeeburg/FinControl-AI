from fastapi import FastAPI, Depends, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from . import models, schemas, crud
from .database import engine, get_db

models.Base.metadata.create_all(bind=engine)

app = FastAPI()

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

@app.get("/categories", response_model=List[schemas.Category])
def read_categories(db: Session = Depends(get_db)):
    return crud.get_categories(db)

@app.post("/categories", response_model=schemas.Category)
def create_category(category: schemas.CategoryCreate, db: Session = Depends(get_db)):
    return crud.create_category(db, category)

@app.put("/categories/{category_id}", response_model=schemas.Category)
def update_category(category_id: str, category: schemas.CategoryCreate, db: Session = Depends(get_db)):
    return crud.update_category(db, category_id, category)

@app.delete("/categories/{category_id}")
def delete_category(category_id: str, db: Session = Depends(get_db)):
    crud.delete_category(db, category_id)
    return {"ok": True}

@app.get("/transactions", response_model=List[schemas.Transaction])
def read_transactions(db: Session = Depends(get_db)):
    return crud.get_transactions(db)

@app.post("/transactions", response_model=schemas.Transaction)
def create_transaction(transaction: schemas.TransactionCreate, db: Session = Depends(get_db)):
    return crud.create_transaction(db, transaction)

@app.put("/transactions/{transaction_id}", response_model=schemas.Transaction)
def update_transaction(transaction_id: str, transaction: schemas.TransactionCreate, db: Session = Depends(get_db)):
    return crud.update_transaction(db, transaction_id, transaction)

@app.delete("/transactions/{transaction_id}")
def delete_transaction(transaction_id: str, db: Session = Depends(get_db)):
    crud.delete_transaction(db, transaction_id)
    return {"ok": True}

@app.get("/recurring_rules", response_model=List[schemas.RecurringRule])
def read_recurring_rules(db: Session = Depends(get_db)):
    return crud.get_recurring_rules(db)

@app.post("/recurring_rules", response_model=schemas.RecurringRule)
def create_recurring_rule(rule: schemas.RecurringRuleCreate, db: Session = Depends(get_db)):
    return crud.create_recurring_rule(db, rule)

@app.get("/reserves", response_model=List[schemas.Reserve])
def read_reserves(db: Session = Depends(get_db)):
    return crud.get_reserves(db)

@app.post("/reserves", response_model=schemas.Reserve)
def create_reserve(reserve: schemas.ReserveCreate, db: Session = Depends(get_db)):
    return crud.create_reserve(db, reserve)

@app.put("/reserves/{reserve_id}", response_model=schemas.Reserve)
def update_reserve(reserve_id: str, reserve: schemas.ReserveCreate, db: Session = Depends(get_db)):
    return crud.update_reserve(db, reserve_id, reserve)

@app.delete("/reserves/{reserve_id}")
def delete_reserve(reserve_id: str, db: Session = Depends(get_db)):
    crud.delete_reserve(db, reserve_id)
    return {"ok": True}

class ReserveTransactionRequest(BaseModel):
    amount: float
    type: str

@app.post("/reserves/{reserve_id}/transactions", response_model=schemas.Reserve)
def create_reserve_transaction(reserve_id: str, request: ReserveTransactionRequest, db: Session = Depends(get_db)):
    return crud.create_reserve_history(db, reserve_id, request.amount, request.type)
