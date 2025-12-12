from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, Float, DateTime, Date
from sqlalchemy.orm import relationship
from .database import Base
import datetime

class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    name = Column(String)
    created_at = Column(String)

    categories = relationship("Category", back_populates="user")
    transactions = relationship("Transaction", back_populates="user")
    recurring_rules = relationship("RecurringRule", back_populates="user")
    reserves = relationship("Reserve", back_populates="user")

class Category(Base):
    __tablename__ = "categories"

    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id"))
    name = Column(String, index=True)
    type = Column(String)  # INCOME, EXPENSE
    is_fixed = Column(Boolean, default=False)
    color = Column(String)
    icon = Column(String)

    user = relationship("User", back_populates="categories")
    transactions = relationship("Transaction", back_populates="category")
    recurring_rules = relationship("RecurringRule", back_populates="category")

class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id"))
    category_id = Column(String, ForeignKey("categories.id"))
    amount = Column(Float)
    date = Column(String) # YYYY-MM-DD
    description = Column(String)
    status = Column(String) # PAID, PENDING
    created_at = Column(String)

    user = relationship("User", back_populates="transactions")
    category = relationship("Category", back_populates="transactions")

class RecurringRule(Base):
    __tablename__ = "recurring_rules"

    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id"))
    category_id = Column(String, ForeignKey("categories.id"))
    amount = Column(Float)
    description = Column(String)
    rrule = Column(String)
    active = Column(Boolean, default=True)
    auto_create = Column(Boolean, default=False)
    last_execution = Column(String, nullable=True) # YYYY-MM-DD
    next_execution = Column(String, nullable=True) # YYYY-MM-DD
    end_date = Column(String, nullable=True) # YYYY-MM-DD

    user = relationship("User", back_populates="recurring_rules")
    category = relationship("Category", back_populates="recurring_rules")

class Reserve(Base):
    __tablename__ = "reserves"

    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id"))
    name = Column(String)
    target_amount = Column(Float)
    current_amount = Column(Float)
    deadline = Column(String) # YYYY-MM-DD

    user = relationship("User", back_populates="reserves")
    history = relationship("ReserveHistory", back_populates="reserve")

class ReserveHistory(Base):
    __tablename__ = "reserve_history"

    id = Column(String, primary_key=True, index=True)
    reserve_id = Column(String, ForeignKey("reserves.id"))
    date = Column(String)
    amount = Column(Float)
    type = Column(String) # DEPOSIT, WITHDRAW

    reserve = relationship("Reserve", back_populates="history")
