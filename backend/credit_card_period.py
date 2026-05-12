import datetime
import calendar
from dateutil.relativedelta import relativedelta


def get_date_safe(year: int, month: int, day: int) -> datetime.date:
    try:
        return datetime.date(year, month, day)
    except ValueError:
        last_day = calendar.monthrange(year, month)[1]
        return datetime.date(year, month, last_day)


def get_statement_period(closing_day: int, month: str) -> tuple:
    """
    Calcula o período (start_date, end_date) de uma fatura de cartão de crédito.

    Args:
        closing_day: Dia de fechamento do cartão (1-31)
        month: Mês de referência no formato YYYY-MM (mês em que a fatura fecha)

    Returns:
        Tupla (start_date: datetime.date, end_date: datetime.date)
        O período é [start_date, end_date), ou seja, start_date incluso, end_date exclusivo.

    Interpretação:
        O parâmetro 'month' refere-se ao mês de FECHAMENTO da fatura.
        Exemplo: closing_day=10, month='2023-12'
        -> start_date = 2023-11-10 (fechamento do mês anterior)
        -> end_date = 2023-12-10 (fechamento do mês atual, exclusivo)
    """
    try:
        target_date = datetime.datetime.strptime(month, "%Y-%m")
    except ValueError:
        raise ValueError("Invalid month format. Use YYYY-MM")

    current_month_date = target_date
    prev_month_date = target_date - relativedelta(months=1)

    start_date = get_date_safe(prev_month_date.year, prev_month_date.month, closing_day)
    end_date = get_date_safe(current_month_date.year, current_month_date.month, closing_day)

    return start_date, end_date
