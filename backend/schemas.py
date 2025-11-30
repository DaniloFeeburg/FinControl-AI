from pydantic import BaseModel
from typing import List, Optional

# Auth Schemas
class UserBase(BaseModel):
    email: str
    name: str

class UserCreate(UserBase):
    password: str

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

class TransactionBase(BaseModel):
    category_id: str
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
    category_id: str
    amount: float
    description: str
    rrule: str
    active: bool

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
