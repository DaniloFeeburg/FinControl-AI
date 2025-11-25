from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, Float, DateTime, Date
from sqlalchemy.orm import relationship
from .database import Base
import datetime

class Category(Base):
    __tablename__ = "categories"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, index=True)
    type = Column(String)  # INCOME, EXPENSE
    is_fixed = Column(Boolean, default=False)
    color = Column(String)
    icon = Column(String)

    transactions = relationship("Transaction", back_populates="category")
    recurring_rules = relationship("RecurringRule", back_populates="category")

class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(String, primary_key=True, index=True)
    category_id = Column(String, ForeignKey("categories.id"))
    amount = Column(Float)  # Stored as float/double. Frontend uses integer cents sometimes? No, store.ts uses number.
    # store.ts uses amount: 500000. It seems to be in cents or just large numbers.
    # Let's check store.ts again. "amount: 500000" for "Salário Mensal". 5000.00?
    # I'll stick to Float or Integer. If it's cents, Integer is better.
    # Frontend Types: amount: number.
    # Usually money is stored as integer (cents).
    date = Column(String) # YYYY-MM-DD
    description = Column(String)
    status = Column(String) # PAID, PENDING
    created_at = Column(String)

    category = relationship("Category", back_populates="transactions")

class RecurringRule(Base):
    __tablename__ = "recurring_rules"

    id = Column(String, primary_key=True, index=True)
    category_id = Column(String, ForeignKey("categories.id"))
    amount = Column(Float)
    description = Column(String)
    rrule = Column(String)
    active = Column(Boolean, default=True)

    category = relationship("Category", back_populates="recurring_rules")

class Reserve(Base):
    __tablename__ = "reserves"

    id = Column(String, primary_key=True, index=True)
    name = Column(String)
    target_amount = Column(Float)
    current_amount = Column(Float)
    deadline = Column(String) # YYYY-MM-DD

    history = relationship("ReserveHistory", back_populates="reserve")

class ReserveHistory(Base):
    __tablename__ = "reserve_history"

    id = Column(String, primary_key=True, index=True)
    reserve_id = Column(String, ForeignKey("reserves.id"))
    date = Column(String)
    amount = Column(Float)
    type = Column(String) # DEPOSIT, WITHDRAW

    reserve = relationship("Reserve", back_populates="history")
