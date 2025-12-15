from fastapi import FastAPI, Depends, HTTPException, Body, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from . import models, schemas, crud, auth
from .database import engine, get_db
from contextlib import asynccontextmanager
import asyncio
from .scheduler import start_scheduler_loop

models.Base.metadata.create_all(bind=engine)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Start the scheduler loop in the background
    asyncio.create_task(start_scheduler_loop())
    yield

app = FastAPI(lifespan=lifespan)

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

# PUT - Atualizar Regra Recorrente
@app.put("/recurring_rules/{rule_id}", response_model=schemas.RecurringRule)
def update_recurring_rule(
    rule_id: str,
    rule: schemas.RecurringRuleCreate,
    db: Session = Depends(get_db),
    current_user: schemas.User = Depends(auth.get_current_user)
):
    db_rule = db.query(models.RecurringRule).filter(
        models.RecurringRule.id == rule_id,
        models.RecurringRule.user_id == current_user.id
    ).first()

    if not db_rule:
        raise HTTPException(status_code=404, detail="Rule not found")

    for key, value in rule.dict().items():
        setattr(db_rule, key, value)

    db.commit()
    db.refresh(db_rule)
    return db_rule

# DELETE - Excluir Regra Recorrente
@app.delete("/recurring_rules/{rule_id}")
def delete_recurring_rule(
    rule_id: str,
    db: Session = Depends(get_db),
    current_user: schemas.User = Depends(auth.get_current_user)
):
    db_rule = db.query(models.RecurringRule).filter(
        models.RecurringRule.id == rule_id,
        models.RecurringRule.user_id == current_user.id
    ).first()

    if not db_rule:
        raise HTTPException(status_code=404, detail="Rule not found")

    db.delete(db_rule)
    db.commit()
    return {"ok": True}

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

# Credit Cards Endpoints

@app.get("/credit_cards", response_model=List[schemas.CreditCard])
def read_credit_cards(db: Session = Depends(get_db), current_user: schemas.User = Depends(auth.get_current_user)):
    return crud.get_credit_cards(db, user_id=current_user.id)

@app.post("/credit_cards", response_model=schemas.CreditCard)
def create_credit_card(card: schemas.CreditCardCreate, db: Session = Depends(get_db), current_user: schemas.User = Depends(auth.get_current_user)):
    return crud.create_credit_card(db, card, user_id=current_user.id)

@app.put("/credit_cards/{card_id}", response_model=schemas.CreditCard)
def update_credit_card(card_id: str, card: schemas.CreditCardCreate, db: Session = Depends(get_db), current_user: schemas.User = Depends(auth.get_current_user)):
    return crud.update_credit_card(db, card_id, card, user_id=current_user.id)

@app.delete("/credit_cards/{card_id}")
def delete_credit_card(card_id: str, db: Session = Depends(get_db), current_user: schemas.User = Depends(auth.get_current_user)):
    crud.delete_credit_card(db, card_id, user_id=current_user.id)
    return {"ok": True}

@app.get("/credit_cards/{card_id}/statement")
def get_credit_card_statement(
    card_id: str,
    month: str, # YYYY-MM
    db: Session = Depends(get_db),
    current_user: schemas.User = Depends(auth.get_current_user)
):
    import datetime
    from dateutil.relativedelta import relativedelta

    # 1. Get the credit card
    card = db.query(models.CreditCard).filter(
        models.CreditCard.id == card_id,
        models.CreditCard.user_id == current_user.id
    ).first()

    if not card:
        raise HTTPException(status_code=404, detail="Card not found")

    # 2. Calculate period range
    # Period logic: closing_day of previous month to closing_day of current month (exclusive of end date usually, but depends on logic)
    # Requeriment: "Entre dia de fechamento anterior e dia de fechamento atual"
    # Example: Closing day 10. Statement for Nov (2023-11).
    # Range: 2023-10-10 to 2023-11-09 (assuming closing day is the day the invoice closes, so transactions on that day might be next month or this month.
    # Usually, closing day means transactions UP TO that day are in the invoice. Or closing day starts the NEW invoice?
    # Common behavior: Closing day 10. Transactions up to day 10 (or 9) are in the closed invoice.
    # Let's interpret: "Entre dia de fechamento anterior e dia de fechamento atual"
    # Fatura de 10/Nov a 09/Dez -> This sounds like closing day is 10.

    try:
        target_date = datetime.datetime.strptime(month, "%Y-%m")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid month format. Use YYYY-MM")

    closing_day = card.closing_day

    # Calculate start date (previous month closing day)
    # If target is 2023-11, and closing day is 10.
    # Start: 2023-10-10. End: 2023-11-09.

    # Handling months with fewer days than closing_day
    # logic to clamp day?

    def get_date_safe(year, month, day):
        try:
            return datetime.date(year, month, day)
        except ValueError:
            # If day is out of range for month (e.g. 31 in Feb), return last day of month
            import calendar
            last_day = calendar.monthrange(year, month)[1]
            return datetime.date(year, month, last_day)

    # Current Statement Month: target_date (YYYY-MM)
    # The statement "belongs" to YYYY-MM usually means it is DUE in YYYY-MM or closes in YYYY-MM.
    # If due day is 15th and closing is 10th.
    # Nov invoice: Closes Nov 10. Due Nov 15. Range: Oct 10 - Nov 09.

    # Let's assume the 'month' param refers to the month where the invoice closes.

    current_month_date = target_date
    prev_month_date = target_date - relativedelta(months=1)

    start_date = get_date_safe(prev_month_date.year, prev_month_date.month, closing_day)
    end_date = get_date_safe(current_month_date.year, current_month_date.month, closing_day)

    # The requirement says "Exemplo: Fechamento dia 10 -> Fatura de 10/Nov a 09/Dez"
    # This implies the invoice CLOSES on Dec 10 (or around there) covers Nov 10 to Dec 09.
    # If the user selects "December", they want to see the invoice closing in December?
    # Or if they select "November", they want to see what they spent in November?
    # Credit Card statements are usually referred by their Due Month or Closing Month.
    # Let's assume Closing Month.

    # Adjusted Logic based on "Fechamento dia 10 -> Fatura de 10/Nov a 09/Dez"
    # This range (Nov 10 - Dec 09) usually results in an invoice closing on Dec 10.
    # So if I request month=2023-12, I expect transactions from 2023-11-10 to 2023-12-09.

    start_date_str = start_date.strftime("%Y-%m-%d")
    end_date_str = end_date.strftime("%Y-%m-%d")

    # Query transactions
    transactions = db.query(models.Transaction).filter(
        models.Transaction.user_id == current_user.id,
        models.Transaction.credit_card_id == card_id,
        models.Transaction.date >= start_date_str,
        models.Transaction.date < end_date_str
    ).order_by(models.Transaction.date.desc()).all()

    statement_items = []
    total_invoice = 0.0

    for t in transactions:
        total_invoice += t.amount
        statement_items.append(t)

    # RECURRING RULES PROJECTION
    # Find rules linked to this card
    rules = db.query(models.RecurringRule).filter(
        models.RecurringRule.user_id == current_user.id,
        models.RecurringRule.credit_card_id == card_id,
        models.RecurringRule.active == True
    ).all()

    for rule in rules:
        # Check if rule executes within start_date and end_date
        # Simple RRule parsing (Assuming FREQ=MONTHLY;BYMONTHDAY=X)
        import re
        match = re.search(r"BYMONTHDAY=(\d+)", rule.rrule)
        if match:
            day = int(match.group(1))

            # Check if this day exists in the period months
            # Period spans across two months usually (e.g. 10 Oct - 10 Nov)
            # Check candidate dates

            # Candidate 1: In the start_date's month
            try:
                candidate1 = datetime.date(start_date.year, start_date.month, day)
            except ValueError:
                candidate1 = None # Invalid date (e.g. Feb 30)

            # Candidate 2: In the end_date's month
            # Note: end_date month might be same as start_date month if closing day is 1st and we look at same month?
            # Usually period spans 2 months.
            try:
                candidate2 = datetime.date(end_date.year, end_date.month, day)
            except ValueError:
                candidate2 = None

            candidates = []
            if candidate1: candidates.append(candidate1)
            # Avoid adding same date twice if months are same (unlikely for standard statement logic but safe)
            if candidate2 and (not candidate1 or candidate2 != candidate1): candidates.append(candidate2)

            for d in candidates:
                # Check if d is within [start_date, end_date)
                # And check end_date of rule
                rule_end = datetime.datetime.strptime(rule.end_date, "%Y-%m-%d").date() if rule.end_date else None

                if start_date <= d < end_date:
                    if rule_end and d > rule_end:
                        continue

                    # Check if a real transaction already exists for this rule on this date
                    # To avoid duplication if the rule already executed
                    # We check if there is a transaction with this recurring_rule_id around this date
                    # Or simply trust that if it's in `transactions` list (fetched above), we shouldn't add it.
                    # But transactions list is filtered by date.
                    # If the scheduler ran, the transaction exists and has credit_card_id. It is in `transactions`.
                    # So we just need to check if we already have it in `statement_items`?
                    # But `statement_items` are raw Transaction objects.
                    # We need to check if any t in statement_items has recurring_rule_id == rule.id and date == d

                    already_exists = any(
                        t.recurring_rule_id == rule.id and
                        t.date == d.strftime("%Y-%m-%d")
                        for t in statement_items
                    )

                    if not already_exists:
                        # Create a "virtual" transaction for display
                        # We use a dict or a mocked object. Pydantic schema is fine if we return list of schemas.
                        # But we are returning a dict with "transactions": [objects].
                        # Let's create a temporary object or dict.
                        # Frontend expects Transaction interface.
                        virtual_t = {
                            "id": f"virtual-{rule.id}-{d}",
                            "category_id": rule.category_id,
                            "credit_card_id": card_id,
                            "recurring_rule_id": rule.id,
                            "amount": rule.amount,
                            "date": d.strftime("%Y-%m-%d"),
                            "description": f"{rule.description} (Recorrente)",
                            "status": "PENDING", # Projected
                            "created_at": datetime.datetime.now().isoformat()
                        }
                        statement_items.append(virtual_t)
                        total_invoice += rule.amount

    # Sort items by date
    statement_items.sort(key=lambda x: x['date'] if isinstance(x, dict) else x.date, reverse=True)

    status = "OPEN"
    today = datetime.date.today()
    if today >= end_date:
        status = "CLOSED"
        due_date = get_date_safe(current_month_date.year, current_month_date.month, card.due_day)
        if today > due_date:
            status = "OVERDUE"

    return {
        "period": {"start": start_date_str, "end": end_date_str},
        "transactions": statement_items,
        "total": total_invoice,
        "status": status,
        "due_date": get_date_safe(current_month_date.year, current_month_date.month, card.due_day).strftime("%Y-%m-%d")
    }

@app.get("/credit_cards/{card_id}/projection")
def get_credit_card_projection(
    card_id: str,
    db: Session = Depends(get_db),
    current_user: schemas.User = Depends(auth.get_current_user)
):
    import datetime
    from dateutil.relativedelta import relativedelta
    import re

    card = db.query(models.CreditCard).filter(
        models.CreditCard.id == card_id,
        models.CreditCard.user_id == current_user.id
    ).first()

    if not card:
        raise HTTPException(status_code=404, detail="Card not found")

    projections = []
    today = datetime.date.today()

    # Project next 12 months
    # For each month, calculate the statement total (Projected)

    for i in range(12):
        target_date = today + relativedelta(months=i)
        # We need to align target_date to the statement month.
        # If today is Dec 15. i=0 -> Dec. i=1 -> Jan.
        # We want the statement that "closes" in that month? Or is "due" in that month?
        # Typically "Jan Invoice".

        # Reuse logic slightly:
        # Statement Month X: Range [Prev Month Closing, Month X Closing)

        closing_day = card.closing_day

        def get_date_safe(year, month, day):
            try:
                return datetime.date(year, month, day)
            except ValueError:
                import calendar
                last_day = calendar.monthrange(year, month)[1]
                return datetime.date(year, month, last_day)

        current_month_date = target_date
        prev_month_date = target_date - relativedelta(months=1)

        start_date = get_date_safe(prev_month_date.year, prev_month_date.month, closing_day)
        end_date = get_date_safe(current_month_date.year, current_month_date.month, closing_day)

        start_date_str = start_date.strftime("%Y-%m-%d")
        end_date_str = end_date.strftime("%Y-%m-%d")

        # 1. Existing Transactions
        # (Only relevant for near future, usually i=0 or i=1)
        txns = db.query(models.Transaction).filter(
            models.Transaction.user_id == current_user.id,
            models.Transaction.credit_card_id == card_id,
            models.Transaction.date >= start_date_str,
            models.Transaction.date < end_date_str
        ).all()

        month_total = sum(t.amount for t in txns)

        # 2. Recurring Rules
        rules = db.query(models.RecurringRule).filter(
            models.RecurringRule.user_id == current_user.id,
            models.RecurringRule.credit_card_id == card_id,
            models.RecurringRule.active == True
        ).all()

        for rule in rules:
            match = re.search(r"BYMONTHDAY=(\d+)", rule.rrule)
            if match:
                day = int(match.group(1))
                # Check if day falls in period [start_date, end_date)

                candidates = []
                try:
                    c1 = datetime.date(start_date.year, start_date.month, day)
                    candidates.append(c1)
                except ValueError: pass

                try:
                    c2 = datetime.date(end_date.year, end_date.month, day)
                    candidates.append(c2)
                except ValueError: pass

                added = False
                for d in candidates:
                    rule_end = datetime.datetime.strptime(rule.end_date, "%Y-%m-%d").date() if rule.end_date else None
                    if start_date <= d < end_date:
                        if rule_end and d > rule_end:
                            continue

                        # Avoid double counting if transaction already exists
                        already_exists = any(
                            t.recurring_rule_id == rule.id and
                            t.date == d.strftime("%Y-%m-%d")
                            for t in txns
                        )

                        if not already_exists and not added:
                            month_total += rule.amount
                            added = True # Rule triggers once per period usually

        projections.append({
            "month": target_date.strftime("%Y-%m"),
            "total": month_total,
            "due_date": get_date_safe(current_month_date.year, current_month_date.month, card.due_day).strftime("%Y-%m-%d")
        })

    return projections

@app.post("/credit_cards/{card_id}/pay_invoice")
def pay_credit_card_invoice(
    card_id: str,
    month: str, # YYYY-MM
    db: Session = Depends(get_db),
    current_user: schemas.User = Depends(auth.get_current_user)
):
    # Reuse logic to find transactions for the period
    # Ideally refactor period logic to a helper, but for now duplicate to ensure safety
    import datetime
    from dateutil.relativedelta import relativedelta

    card = db.query(models.CreditCard).filter(
        models.CreditCard.id == card_id,
        models.CreditCard.user_id == current_user.id
    ).first()

    if not card:
        raise HTTPException(status_code=404, detail="Card not found")

    try:
        target_date = datetime.datetime.strptime(month, "%Y-%m")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid month format")

    closing_day = card.closing_day

    def get_date_safe(year, month, day):
        try:
            return datetime.date(year, month, day)
        except ValueError:
            import calendar
            last_day = calendar.monthrange(year, month)[1]
            return datetime.date(year, month, last_day)

    current_month_date = target_date
    prev_month_date = target_date - relativedelta(months=1)

    start_date = get_date_safe(prev_month_date.year, prev_month_date.month, closing_day)
    end_date = get_date_safe(current_month_date.year, current_month_date.month, closing_day)

    start_date_str = start_date.strftime("%Y-%m-%d")
    end_date_str = end_date.strftime("%Y-%m-%d")

    transactions = db.query(models.Transaction).filter(
        models.Transaction.user_id == current_user.id,
        models.Transaction.credit_card_id == card_id,
        models.Transaction.date >= start_date_str,
        models.Transaction.date < end_date_str,
        models.Transaction.status == 'PENDING'
    ).all()

    count = 0
    for t in transactions:
        t.status = 'PAID'
        count += 1

    db.commit()

    return {"message": f"{count} transactions marked as paid", "count": count}
