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
    amount: float
    date: str
    description: str
    status: str

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
    amount: float
    description: str
    rrule: str
    active: bool
    auto_create: bool = False
    last_execution: Optional[str] = None
    next_execution: Optional[str] = None
    end_date: Optional[str] = None

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
