from pydantic import BaseModel, field_validator
from typing import List, Optional
import re

# Auth Schemas
class UserBase(BaseModel):
    email: str
    name: str

    @field_validator('email')
    def validate_email(cls, v):
        # Basic regex for email validation
        email_regex = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        if not re.match(email_regex, v):
            raise ValueError('Email inválido')
        return v

class UserCreate(UserBase):
    password: str

    @field_validator('password')
    def validate_password(cls, v):
        if len(v) < 6:
            raise ValueError('A senha deve ter pelo menos 6 caracteres')
        return v

class UserLogin(BaseModel):
    email: str
    password: str

class User(UserBase):
    id: str

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None

# Existing Schemas
class CategoryBase(BaseModel):
    name: str
    type: str
    is_fixed: bool
    color: str
    icon: str

class CategoryCreate(CategoryBase):
    pass

class Category(CategoryBase):
    id: str
    user_id: str

    class Config:
        from_attributes = True

# Credit Card Schemas
class CreditCardBase(BaseModel):
    name: str
    brand: str
    credit_limit: float
    due_day: int
    closing_day: int
    color: str
    active: bool = True

    @field_validator('due_day', 'closing_day')
    def validate_days(cls, v):
        if not (1 <= v <= 31):
            raise ValueError('Dia deve ser entre 1 e 31')
        return v

    @field_validator('credit_limit')
    def validate_limit(cls, v):
        if v <= 0:
            raise ValueError('Limite deve ser maior que zero')
        return v
    
    @field_validator('due_day')
    def validate_due_after_closing(cls, v, info):
        closing_day = info.data.get('closing_day')
        if closing_day and v <= closing_day:
            raise ValueError('Dia de vencimento deve ser posterior ao dia de fechamento')
        return v

class CreditCardCreate(CreditCardBase):
    pass

class CreditCardUpdate(CreditCardBase):
    pass

class CreditCard(CreditCardBase):
    id: str
    user_id: str

    class Config:
        from_attributes = True

class TransactionBase(BaseModel):
    category_id: Optional[str] = None
    credit_card_id: Optional[str] = None
    recurring_rule_id: Optional[str] = None
    amount: float
    date: str
    description: str
    status: str

    @field_validator('amount')
    def validate_amount(cls, v):
        if v == 0:
            raise ValueError('Valor não pode ser zero')
        return v
    
    @field_validator('status')
    def validate_status(cls, v):
        if v not in ['PAID', 'PENDING']:
            raise ValueError('Status deve ser PAID ou PENDING')
        return v

class TransactionCreate(TransactionBase):
    pass

class Transaction(TransactionBase):
    id: str
    user_id: str
    created_at: str

    class Config:
        from_attributes = True

class RecurringRuleBase(BaseModel):
    category_id: Optional[str] = None
    credit_card_id: Optional[str] = None
    amount: float
    description: str
    rrule: str
    active: bool
    auto_create: bool = False
    last_execution: Optional[str] = None
    next_execution: Optional[str] = None
    end_date: Optional[str] = None

    @field_validator('rrule')
    def validate_rrule(cls, v):
        """Valida se a RRule é válida usando dateutil"""
        if not v or v.strip() == '':
            raise ValueError('RRule não pode estar vazia')
        
        try:
            from dateutil.rrule import rrulestr
            from datetime import datetime
            
            # Tenta parsear a RRule
            rrulestr(v, dtstart=datetime.now())
            
            # Verifica se contém campos obrigatórios básicos
            if 'FREQ=' not in v.upper():
                raise ValueError('RRule deve conter FREQ (frequência)')
            
            return v
        except ImportError:
            # Se dateutil não estiver instalada, faz validação básica
            if 'FREQ=' not in v.upper():
                raise ValueError('RRule deve conter FREQ (frequência)')
            return v
        except Exception as e:
            raise ValueError(f'RRule inválida: {str(e)}')
    
    @field_validator('amount')
    def validate_amount_not_zero(cls, v):
        if v == 0:
            raise ValueError('Valor não pode ser zero')
        return v

class RecurringRuleCreate(RecurringRuleBase):
    pass

class RecurringRule(RecurringRuleBase):
    id: str
    user_id: str

    class Config:
        from_attributes = True

class ReserveHistoryBase(BaseModel):
    date: str
    amount: float
    type: str

class ReserveHistoryCreate(ReserveHistoryBase):
    pass

class ReserveHistory(ReserveHistoryBase):
    id: str
    reserve_id: str

    class Config:
        from_attributes = True

class ReserveBase(BaseModel):
    name: str
    target_amount: float
    current_amount: float
    deadline: str

class ReserveCreate(ReserveBase):
    pass

class Reserve(ReserveBase):
    id: str
    user_id: str
    history: List[ReserveHistory] = []

    class Config:
        from_attributes = True
