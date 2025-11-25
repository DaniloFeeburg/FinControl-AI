from sqlalchemy.orm import Session
from . import models, schemas
import uuid
from datetime import datetime

# Categories
def get_categories(db: Session):
    return db.query(models.Category).all()

def create_category(db: Session, category: schemas.CategoryCreate):
    db_category = models.Category(id=str(uuid.uuid4()), **category.dict())
    db.add(db_category)
    db.commit()
    db.refresh(db_category)
    return db_category

def update_category(db: Session, category_id: str, category: schemas.CategoryCreate): # Using create schema for update as partial isn't defined
    db_category = db.query(models.Category).filter(models.Category.id == category_id).first()
    if db_category:
        for key, value in category.dict().items():
            setattr(db_category, key, value)
        db.commit()
        db.refresh(db_category)
    return db_category

def delete_category(db: Session, category_id: str):
    db_category = db.query(models.Category).filter(models.Category.id == category_id).first()
    if db_category:
        db.delete(db_category)
        db.commit()
    return db_category

# Transactions
def get_transactions(db: Session):
    # Sort by date descending
    return db.query(models.Transaction).order_by(models.Transaction.date.desc()).all()

def create_transaction(db: Session, transaction: schemas.TransactionCreate):
    created_at = datetime.now().isoformat()
    db_transaction = models.Transaction(id=str(uuid.uuid4()), created_at=created_at, **transaction.dict())
    db.add(db_transaction)
    db.commit()
    db.refresh(db_transaction)
    return db_transaction

def update_transaction(db: Session, transaction_id: str, transaction: schemas.TransactionCreate):
    db_transaction = db.query(models.Transaction).filter(models.Transaction.id == transaction_id).first()
    if db_transaction:
        for key, value in transaction.dict().items():
            setattr(db_transaction, key, value)
        db.commit()
        db.refresh(db_transaction)
    return db_transaction

def delete_transaction(db: Session, transaction_id: str):
    db_transaction = db.query(models.Transaction).filter(models.Transaction.id == transaction_id).first()
    if db_transaction:
        db.delete(db_transaction)
        db.commit()
    return db_transaction

# Recurring Rules
def get_recurring_rules(db: Session):
    return db.query(models.RecurringRule).all()

def create_recurring_rule(db: Session, rule: schemas.RecurringRuleCreate):
    db_rule = models.RecurringRule(id=str(uuid.uuid4()), **rule.dict())
    db.add(db_rule)
    db.commit()
    db.refresh(db_rule)
    return db_rule

# Reserves
def get_reserves(db: Session):
    return db.query(models.Reserve).all()

def create_reserve(db: Session, reserve: schemas.ReserveCreate):
    db_reserve = models.Reserve(id=str(uuid.uuid4()), **reserve.dict())
    db.add(db_reserve)
    db.commit()
    db.refresh(db_reserve)
    return db_reserve

def update_reserve(db: Session, reserve_id: str, reserve: schemas.ReserveCreate):
    db_reserve = db.query(models.Reserve).filter(models.Reserve.id == reserve_id).first()
    if db_reserve:
        for key, value in reserve.dict().items():
            setattr(db_reserve, key, value)
        db.commit()
        db.refresh(db_reserve)
    return db_reserve

def delete_reserve(db: Session, reserve_id: str):
    db_reserve = db.query(models.Reserve).filter(models.Reserve.id == reserve_id).first()
    if db_reserve:
        db.delete(db_reserve)
        db.commit()
    return db_reserve

def create_reserve_history(db: Session, reserve_id: str, amount: float, type: str):
    # This logic was handled in frontend "addReserveTransaction"
    # Update reserve current_amount
    db_reserve = db.query(models.Reserve).filter(models.Reserve.id == reserve_id).first()
    if not db_reserve:
        return None

    if type == 'DEPOSIT':
        db_reserve.current_amount += amount
    else:
        db_reserve.current_amount -= amount

    db_history = models.ReserveHistory(
        id=str(uuid.uuid4()),
        reserve_id=reserve_id,
        date=datetime.now().isoformat(),
        amount=amount,
        type=type
    )
    db.add(db_history)
    db.commit()
    db.refresh(db_reserve)
    return db_reserve
