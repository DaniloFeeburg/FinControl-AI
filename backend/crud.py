from sqlalchemy.orm import Session
from . import models, schemas, auth
import uuid
from datetime import datetime

# User
def get_user_by_email(db: Session, email: str):
    return db.query(models.User).filter(models.User.email == email).first()

def create_user(db: Session, user: schemas.UserCreate):
    hashed_password = auth.hash_password(user.password)
    db_user = models.User(
        id=str(uuid.uuid4()),
        email=user.email,
        hashed_password=hashed_password,
        name=user.name,
        created_at=datetime.now().isoformat()
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

# Categories
def get_categories(db: Session, user_id: str):
    return db.query(models.Category).filter(models.Category.user_id == user_id).all()

def create_category(db: Session, category: schemas.CategoryCreate, user_id: str):
    db_category = models.Category(id=str(uuid.uuid4()), user_id=user_id, **category.dict())
    db.add(db_category)
    db.commit()
    db.refresh(db_category)
    return db_category

def update_category(db: Session, category_id: str, category: schemas.CategoryCreate, user_id: str):
    db_category = db.query(models.Category).filter(models.Category.id == category_id, models.Category.user_id == user_id).first()
    if db_category:
        for key, value in category.dict().items():
            setattr(db_category, key, value)
        db.commit()
        db.refresh(db_category)
    return db_category

def delete_category(db: Session, category_id: str, user_id: str):
    db_category = db.query(models.Category).filter(models.Category.id == category_id, models.Category.user_id == user_id).first()
    if db_category:
        db.delete(db_category)
        db.commit()
    return db_category

# Transactions
def get_transactions(db: Session, user_id: str):
    return db.query(models.Transaction).filter(models.Transaction.user_id == user_id).order_by(models.Transaction.date.desc()).all()

def create_transaction(db: Session, transaction: schemas.TransactionCreate, user_id: str):
    created_at = datetime.now().isoformat()
    db_transaction = models.Transaction(id=str(uuid.uuid4()), user_id=user_id, created_at=created_at, **transaction.dict())
    db.add(db_transaction)
    db.commit()
    db.refresh(db_transaction)
    return db_transaction

def update_transaction(db: Session, transaction_id: str, transaction: schemas.TransactionCreate, user_id: str):
    db_transaction = db.query(models.Transaction).filter(models.Transaction.id == transaction_id, models.Transaction.user_id == user_id).first()
    if db_transaction:
        for key, value in transaction.dict().items():
            setattr(db_transaction, key, value)
        db.commit()
        db.refresh(db_transaction)
    return db_transaction

def delete_transaction(db: Session, transaction_id: str, user_id: str):
    db_transaction = db.query(models.Transaction).filter(models.Transaction.id == transaction_id, models.Transaction.user_id == user_id).first()
    if db_transaction:
        db.delete(db_transaction)
        db.commit()
    return db_transaction

# Recurring Rules
def get_recurring_rules(db: Session, user_id: str):
    return db.query(models.RecurringRule).filter(models.RecurringRule.user_id == user_id).all()

def create_recurring_rule(db: Session, rule: schemas.RecurringRuleCreate, user_id: str):
    db_rule = models.RecurringRule(id=str(uuid.uuid4()), user_id=user_id, **rule.dict())
    db.add(db_rule)
    db.commit()
    db.refresh(db_rule)
    return db_rule

# Reserves
def get_reserves(db: Session, user_id: str):
    return db.query(models.Reserve).filter(models.Reserve.user_id == user_id).all()

def create_reserve(db: Session, reserve: schemas.ReserveCreate, user_id: str):
    db_reserve = models.Reserve(id=str(uuid.uuid4()), user_id=user_id, **reserve.dict())
    db.add(db_reserve)
    db.commit()
    db.refresh(db_reserve)
    return db_reserve

# Credit Cards
def get_credit_cards(db: Session, user_id: str):
    return db.query(models.CreditCard).filter(models.CreditCard.user_id == user_id).all()

def create_credit_card(db: Session, credit_card: schemas.CreditCardCreate, user_id: str):
    db_credit_card = models.CreditCard(id=str(uuid.uuid4()), user_id=user_id, **credit_card.dict())
    db.add(db_credit_card)
    db.commit()
    db.refresh(db_credit_card)
    return db_credit_card

def update_credit_card(db: Session, credit_card_id: str, credit_card: schemas.CreditCardCreate, user_id: str):
    db_credit_card = db.query(models.CreditCard).filter(models.CreditCard.id == credit_card_id, models.CreditCard.user_id == user_id).first()
    if db_credit_card:
        for key, value in credit_card.dict().items():
            setattr(db_credit_card, key, value)
        db.commit()
        db.refresh(db_credit_card)
    return db_credit_card

def delete_credit_card(db: Session, credit_card_id: str, user_id: str):
    db_credit_card = db.query(models.CreditCard).filter(models.CreditCard.id == credit_card_id, models.CreditCard.user_id == user_id).first()
    if db_credit_card:
        db.delete(db_credit_card)
        db.commit()
    return db_credit_card

def update_reserve(db: Session, reserve_id: str, reserve: schemas.ReserveCreate, user_id: str):
    db_reserve = db.query(models.Reserve).filter(models.Reserve.id == reserve_id, models.Reserve.user_id == user_id).first()
    if db_reserve:
        for key, value in reserve.dict().items():
            setattr(db_reserve, key, value)
        db.commit()
        db.refresh(db_reserve)
    return db_reserve

def delete_reserve(db: Session, reserve_id: str, user_id: str):
    db_reserve = db.query(models.Reserve).filter(models.Reserve.id == reserve_id, models.Reserve.user_id == user_id).first()
    if db_reserve:
        db.delete(db_reserve)
        db.commit()
    return db_reserve

def create_reserve_history(db: Session, reserve_id: str, amount: float, type: str, user_id: str):
    # Ensure the reserve belongs to the user
    db_reserve = db.query(models.Reserve).filter(models.Reserve.id == reserve_id, models.Reserve.user_id == user_id).first()
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
