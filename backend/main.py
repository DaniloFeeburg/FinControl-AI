from fastapi import FastAPI, Depends, HTTPException, Body, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from . import models, schemas, crud, auth, ofx_service
from .database import engine, get_db
from contextlib import asynccontextmanager
import asyncio
import os
from .scheduler import start_scheduler_loop

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize database tables
    # Moved here from module level to avoid import-time failures
    models.Base.metadata.create_all(bind=engine)

    # Start the scheduler loop in the background
    asyncio.create_task(start_scheduler_loop())
    yield

app = FastAPI(lifespan=lifespan)

@app.get("/")
def root():
    return {"message": "FinControl AI API is running"}

# Allow CORS for frontend (configure via environment variable)
allowed_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:8080")
origins = [origin.strip() for origin in allowed_origins.split(",")]

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
def read_transactions(
    skip: int = 0,
    limit: int = 100,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    category_id: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: schemas.User = Depends(auth.get_current_user)
):
    """
    Lista transações com suporte a paginação e filtros.
    
    - **skip**: Número de registros a pular (padrão: 0)
    - **limit**: Número máximo de registros (padrão: 100, máximo: 500)
    - **start_date**: Data inicial (YYYY-MM-DD)
    - **end_date**: Data final (YYYY-MM-DD)
    - **category_id**: Filtrar por categoria
    - **status**: Filtrar por status (PAID/PENDING)
    """
    if limit > 500:
        limit = 500
    
    return crud.get_transactions(
        db, 
        user_id=current_user.id,
        skip=skip,
        limit=limit,
        start_date=start_date,
        end_date=end_date,
        category_id=category_id,
        status=status
    )

@app.get("/transactions/count")
def count_transactions(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    category_id: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: schemas.User = Depends(auth.get_current_user)
):
    """Retorna o total de transações do usuário (útil para paginação)"""
    return {"count": crud.count_transactions(
        db,
        user_id=current_user.id,
        start_date=start_date,
        end_date=end_date,
        category_id=category_id,
        status=status
    )}

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
        # Use simple parsing similar to other parts, but robust enough for monthly
        import re
        match = re.search(r"BYMONTHDAY=(\d+)", rule.rrule)
        if match:
            day = int(match.group(1))

            # Generate candidates: day in start_date's month and day in end_date's month
            candidates = []

            # Month 1
            try:
                candidates.append(datetime.date(start_date.year, start_date.month, day))
            except ValueError:
                pass # Invalid date

            # Month 2 (if different)
            if end_date.month != start_date.month or end_date.year != start_date.year:
                try:
                    candidates.append(datetime.date(end_date.year, end_date.month, day))
                except ValueError:
                    pass

            for d in candidates:
                # Check bounds: [start_date, end_date)
                if not (start_date <= d < end_date):
                    continue

                # Check rule end date
                if rule.end_date:
                    rule_end = datetime.datetime.strptime(rule.end_date, "%Y-%m-%d").date()
                    if d > rule_end:
                        continue

                # Check duplication
                # Note: statement_items contains mixed types (SQLAlchemy objects and Dicts)
                # We need to access attributes safely
                already_exists = False
                for t in statement_items:
                    t_rule_id = getattr(t, 'recurring_rule_id', None) or (t.get('recurring_rule_id') if isinstance(t, dict) else None)
                    t_date = getattr(t, 'date', None) or (t.get('date') if isinstance(t, dict) else None)

                    if t_rule_id == rule.id and str(t_date) == d.strftime("%Y-%m-%d"):
                        already_exists = True
                        break

                if not already_exists:
                    virtual_t = {
                        "id": f"virtual-{rule.id}-{d}",
                        "category_id": rule.category_id,
                        "credit_card_id": card_id,
                        "recurring_rule_id": rule.id,
                        "amount": rule.amount,
                        "date": d.strftime("%Y-%m-%d"),
                        "description": f"{rule.description} (Recorrente)",
                        "status": "PENDING",
                        "created_at": datetime.datetime.now().isoformat()
                    }
                    statement_items.append(virtual_t)
                    total_invoice += rule.amount

    # Normalize transactions to list of dicts to ensure consistent serialization
    normalized_items = []
    for item in statement_items:
        if isinstance(item, dict):
            normalized_items.append(item)
        else:
            # SQLAlchemy Object -> Dict
            normalized_items.append({
                "id": item.id,
                "category_id": item.category_id,
                "credit_card_id": item.credit_card_id,
                "recurring_rule_id": item.recurring_rule_id,
                "amount": item.amount,
                "date": item.date,
                "description": item.description,
                "status": item.status,
                "created_at": item.created_at.isoformat() if hasattr(item.created_at, 'isoformat') else str(item.created_at)
            })

    # Sort items by date
    normalized_items.sort(key=lambda x: x['date'], reverse=True)

    status = "OPEN"
    today = datetime.date.today()
    if today >= end_date:
        status = "CLOSED"
        due_date = get_date_safe(current_month_date.year, current_month_date.month, card.due_day)
        if today > due_date:
            status = "OVERDUE"

    return {
        "period": {"start": start_date_str, "end": end_date_str},
        "transactions": normalized_items,
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

# AI Analysis Endpoint (Protected)
class AIAnalysisRequest(BaseModel):
    balance: float
    monthly_income: float
    monthly_expenses: float
    reserves_total: float
    context: Optional[str] = None

@app.post("/ai/analysis")
async def get_ai_analysis(
    request: AIAnalysisRequest,
    current_user: schemas.User = Depends(auth.get_current_user)
):
    """
    Endpoint protegido para análise financeira com IA.
    A chave da API do Gemini fica apenas no backend.
    """
    gemini_api_key = os.getenv("GEMINI_API_KEY")
    
    if not gemini_api_key:
        raise HTTPException(
            status_code=503, 
            detail="Serviço de IA não configurado"
        )
    
    try:
        from google import generativeai as genai
        
        genai.configure(api_key=gemini_api_key)
        model = genai.GenerativeModel('gemini-pro')
        
        prompt = f"""
Você é um consultor financeiro experiente. Analise os dados financeiros abaixo e forneça insights práticos e personalizados.

**Dados Financeiros:**
- Saldo Total: R$ {request.balance:.2f}
- Receita Mensal: R$ {request.monthly_income:.2f}
- Despesas Mensais: R$ {request.monthly_expenses:.2f}
- Total em Reservas: R$ {request.reserves_total:.2f}

{f"**Contexto adicional:** {request.context}" if request.context else ""}

Forneça uma análise com:
1. Diagnóstico da situação financeira atual
2. Pontos de atenção e alertas
3. Recomendações práticas e acionáveis
4. Sugestões de metas financeiras

Seja direto, prático e empático. Máximo 300 palavras.
"""
        
        response = model.generate_content(prompt)
        
        return {
            "analysis": response.text,
            "timestamp": asyncio.get_event_loop().time()
        }
        
    except ImportError:
        raise HTTPException(
            status_code=503,
            detail="Biblioteca do Google Generative AI não instalada"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Erro ao gerar análise: {str(e)}"
        )

# OFX Import Endpoints
@app.post("/import/ofx/preview", response_model=schemas.ImportPreviewResponse)
async def preview_ofx_import(
    request: schemas.ImportPreviewRequest,
    current_user: schemas.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    """
    Parse arquivo OFX e retorna preview das transações com sugestões de categorias
    """
    try:
        # Parse do arquivo OFX
        ofx_data = ofx_service.parse_ofx_file(request.file_content)

        # Busca categorias do usuário
        user_categories = crud.get_categories(db, user_id=current_user.id)
        categories_for_ai = [
            {"id": cat.id, "name": cat.name, "type": cat.type}
            for cat in user_categories
        ]

        # Pega a chave da API do Gemini
        gemini_api_key = os.getenv("GEMINI_API_KEY", "")

        # Processa cada transação
        previews = []
        duplicate_count = 0
        new_count = 0

        for ofx_txn in ofx_data.transactions:
            # Detecta duplicatas
            is_duplicate, duplicate_id = ofx_service.detect_duplicate(
                db=db,
                user_id=current_user.id,
                amount=ofx_txn.amount,
                date=ofx_txn.date,
                description=ofx_txn.payee,
                fitid=ofx_txn.fitid
            )

            if is_duplicate:
                duplicate_count += 1
            else:
                new_count += 1

            # Sugere categoria com IA
            suggested_category_id, confidence = await ofx_service.suggest_category_with_ai(
                description=ofx_txn.payee,
                amount=ofx_txn.amount,
                categories=categories_for_ai,
                gemini_api_key=gemini_api_key
            )

            # Cria preview
            preview = ofx_service.create_import_preview(
                ofx_transaction=ofx_txn,
                is_duplicate=is_duplicate,
                duplicate_id=duplicate_id,
                suggested_category_id=suggested_category_id,
                confidence_score=confidence
            )

            previews.append(preview)

        return schemas.ImportPreviewResponse(
            account_info=ofx_data.account_info,
            transactions=previews,
            total_transactions=len(previews),
            duplicate_count=duplicate_count,
            new_count=new_count
        )

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Erro ao processar arquivo OFX: {str(e)}"
        )


@app.post("/import/ofx/confirm", response_model=schemas.ImportConfirmationResponse)
async def confirm_ofx_import(
    request: schemas.ImportConfirmationRequest,
    current_user: schemas.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    """
    Confirma e executa a importação das transações OFX
    """
    try:
        imported_count = 0
        skipped_count = 0
        failed_count = 0
        transaction_ids = []

        for txn_data in request.transactions:
            try:
                # Verifica se deve pular duplicatas
                if request.skip_duplicates and txn_data.get('is_duplicate', False):
                    skipped_count += 1
                    continue

                # Cria a transação
                transaction_create = schemas.TransactionCreate(
                    category_id=txn_data.get('category_id'),
                    credit_card_id=request.credit_card_id if request.credit_card_id else txn_data.get('credit_card_id'),
                    amount=float(txn_data['amount']),
                    date=txn_data['date'],
                    description=txn_data['description'],
                    status=txn_data.get('status', 'PAID')
                )

                # Cria no banco de dados
                created_txn = crud.create_transaction(
                    db=db,
                    transaction=transaction_create,
                    user_id=current_user.id
                )

                imported_count += 1
                transaction_ids.append(created_txn.id)

            except Exception as e:
                print(f"Erro ao importar transação: {str(e)}")
                failed_count += 1
                continue

        return schemas.ImportConfirmationResponse(
            imported_count=imported_count,
            skipped_count=skipped_count,
            failed_count=failed_count,
            transaction_ids=transaction_ids
        )

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Erro ao confirmar importação: {str(e)}"
        )
