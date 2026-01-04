from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, Float, DateTime, Date, Index, UniqueConstraint
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
    credit_cards = relationship("CreditCard", back_populates="user")
    budget_limits = relationship("BudgetLimit", back_populates="user")

class CreditCard(Base):
    __tablename__ = "credit_cards"

    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id"))
    name = Column(String)
    brand = Column(String) # Visa, Mastercard, Elo, Amex, Other
    credit_limit = Column(Float)
    due_day = Column(Integer)
    closing_day = Column(Integer)
    color = Column(String)
    active = Column(Boolean, default=True)

    user = relationship("User", back_populates="credit_cards")
    transactions = relationship("Transaction", back_populates="credit_card")
    recurring_rules = relationship("RecurringRule", back_populates="credit_card")

    __table_args__ = (
        Index('idx_creditcard_user_active', 'user_id', 'active'),
    )

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
    budget_limits = relationship("BudgetLimit", back_populates="category")

    __table_args__ = (
        Index('idx_category_user_type', 'user_id', 'type'),
    )

class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id"))
    category_id = Column(String, ForeignKey("categories.id"))
    credit_card_id = Column(String, ForeignKey("credit_cards.id"), nullable=True)
    recurring_rule_id = Column(String, ForeignKey("recurring_rules.id"), nullable=True)
    amount = Column(Float)
    date = Column(String) # YYYY-MM-DD
    description = Column(String)
    status = Column(String) # PAID, PENDING
    created_at = Column(String)

    user = relationship("User", back_populates="transactions")
    category = relationship("Category", back_populates="transactions")
    credit_card = relationship("CreditCard", back_populates="transactions")
    recurring_rule = relationship("RecurringRule", back_populates="transactions")

    __table_args__ = (
        Index('idx_transaction_user_date', 'user_id', 'date'),
        Index('idx_transaction_user_category', 'user_id', 'category_id'),
        Index('idx_transaction_user_card', 'user_id', 'credit_card_id'),
        Index('idx_transaction_user_status', 'user_id', 'status'),
    )

class RecurringRule(Base):
    __tablename__ = "recurring_rules"

    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id"))
    category_id = Column(String, ForeignKey("categories.id"))
    credit_card_id = Column(String, ForeignKey("credit_cards.id"), nullable=True)
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
    credit_card = relationship("CreditCard", back_populates="recurring_rules")
    transactions = relationship("Transaction", back_populates="recurring_rule")

    __table_args__ = (
        Index('idx_recurring_user_active', 'user_id', 'active'),
        Index('idx_recurring_user_card', 'user_id', 'credit_card_id'),
    )

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

class BudgetLimit(Base):
    __tablename__ = "budget_limits"

    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id"))
    category_id = Column(String, ForeignKey("categories.id"))
    monthly_limit = Column(Float)

    user = relationship("User", back_populates="budget_limits")
    category = relationship("Category", back_populates="budget_limits")

    __table_args__ = (
        UniqueConstraint('user_id', 'category_id', name='uq_budget_user_category'),
        Index('idx_budget_user_category', 'user_id', 'category_id'),
    )
