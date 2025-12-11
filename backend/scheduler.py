import datetime
from dateutil.rrule import rrulestr
from sqlalchemy.orm import Session
from . import models, crud, schemas
from .database import SessionLocal
import logging

logger = logging.getLogger(__name__)

def process_recurring_rules(db: Session):
    """
    Checks all active recurring rules with auto_create=True.
    If today >= next_execution (or if next_execution is not set but should be),
    creates a pending transaction and updates the rule.
    """
    logger.info("Starting recurring rules processing...")
    today = datetime.date.today()

    rules = db.query(models.RecurringRule).filter(
        models.RecurringRule.active == True,
        models.RecurringRule.auto_create == True
    ).all()

    for rule in rules:
        try:
            # Parse rrule
            # We assume rrule string is valid.
            # We need to determine the next execution date.

            # If next_execution is set, check if we need to run it
            if rule.next_execution:
                next_exec_date = datetime.datetime.strptime(rule.next_execution, "%Y-%m-%d").date()
            else:
                # If never executed or next_execution missing, calculate it.
                # If last_execution exists, calculate next from there.
                # If neither, calculate from 'now' or start of rule?
                # Ideally, when enabling auto_create, we should set next_execution.
                # Fallback: calculate next occurrence after today (or include today)
                # But to avoid creating past transactions for old rules, let's be careful.
                # For now, if no next_execution, we calculate the *next* one after today.
                # Or should we assume if it's new, it starts now?
                # Let's compute from rrule based on today.
                rule_obj = rrulestr(rule.rrule, dtstart=datetime.datetime.now())
                next_occ = rule_obj.after(datetime.datetime.now(), inc=True)
                if next_occ:
                    next_exec_date = next_occ.date()
                    rule.next_execution = next_exec_date.isoformat()
                    db.commit()
                else:
                    continue # No next occurrence

            if next_exec_date <= today:
                logger.info(f"Executing rule {rule.id} - {rule.description}")

                # Create Transaction
                # Use rule description or generate one
                transaction_data = schemas.TransactionCreate(
                    category_id=rule.category_id,
                    amount=rule.amount,
                    date=next_exec_date.isoformat(),
                    description=f"{rule.description} (Auto)",
                    status="PENDING" # User asked for pending transactions
                )

                # We need user_id. Rule has it.
                # CRUD create_transaction expects a schema but adds user_id internally if passed to function?
                # Let's look at crud.create_user_transaction.

                crud.create_user_transaction(db, transaction_data, rule.user_id)

                # Update Rule
                rule.last_execution = next_exec_date.isoformat()

                # Calculate NEW next_execution
                # It should be after the execution date we just processed.
                # Use the rrule to find next after 'next_exec_date'
                # Note: rrule expects datetime.
                dt_last_exec = datetime.datetime.combine(next_exec_date, datetime.time.min)
                rule_obj = rrulestr(rule.rrule, dtstart=dt_last_exec)
                next_occ = rule_obj.after(dt_last_exec)

                if next_occ:
                    rule.next_execution = next_occ.date().isoformat()
                else:
                    rule.next_execution = None # No more occurrences

                db.commit()
                logger.info(f"Rule {rule.id} processed. Next execution: {rule.next_execution}")

        except Exception as e:
            logger.error(f"Error processing rule {rule.id}: {e}")
            db.rollback()

import asyncio
import time

def run_scheduler():
    db = SessionLocal()
    try:
        process_recurring_rules(db)
    finally:
        db.close()

async def start_scheduler_loop():
    """
    Background task to run the scheduler periodically (e.g., every hour or day).
    Since this is a simple demo, we check on startup and then sleep for 24h.
    In a real app, use a dedicated job queue (Celery/Bull) or robust scheduler (APScheduler).
    """
    logger.info("Scheduler loop started.")
    while True:
        try:
            # Run the synchronous scheduler logic in a thread to not block the event loop
            await asyncio.to_thread(run_scheduler)
            logger.info("Scheduler finished run. Sleeping for 24 hours.")
        except Exception as e:
            logger.error(f"Scheduler loop error: {e}")

        # Sleep for 24 hours (86400 seconds)
        await asyncio.sleep(86400)
