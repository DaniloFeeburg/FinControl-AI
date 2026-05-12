# Tasks — Bugfix & Hardening (FinControl AI)

Este arquivo decompõe a correção em tarefas atômicas, com dependências e critérios de verificação.

> Observação: o repositório não contém suíte de testes atualmente. As tarefas incluem “gate checks” mínimos (typecheck/build/execução) e verificação manual. Recomenda-se adicionar testes assim que os P0 forem estabilizados.

---

## T0 — Preparação (recomendado)

### T0.1 — Rodar checks locais (baseline)
- **Objetivo:** capturar baseline antes de alterar.
- **Verificação (mínimo):**
  - `npm ci && npm run build`
  - `python -m compileall backend`

---

## P0 — Bugs críticos

### T1 — Corrigir crash do scheduler (REQ-P0-001)
- **Onde:** `backend/scheduler.py`
- **O que fazer:**
  - Substituir `crud.create_user_transaction(...)` por `crud.create_transaction(...)`.
  - Ajustar assinatura: hoje `crud.create_transaction(db, transaction, user_id)`.
  - Garantir que `TransactionCreate` preencha `status="PENDING"` e `date` no formato esperado.
- **Done when:**
  - Scheduler roda sem levantar `AttributeError`.
- **Gate checks:**
  - `python -m compileall backend`
  - (manual) iniciar app com `DATABASE_URL` e confirmar logs do scheduler sem erro.

### T2 — Persistir FITID no banco e usar na deduplicação (REQ-P0-002)
- **Onde:** `backend/models.py`, `backend/schemas.py`, `backend/crud.py`, `backend/ofx_service.py`, `backend/init_tables.py`
- **O que fazer:**
  - Adicionar coluna `fitid` em `Transaction` (ideal com índice composto `(user_id, fitid)` e unique parcial se aplicável).
  - Ajustar `Transaction` schema/serialização se necessário (decidir se fitid é exposto ao frontend; por padrão, pode ser interno).
  - No `confirm_ofx_import`, salvar fitid vindo do payload (hoje `txn_data` não inclui fitid explicitamente).
  - Em `detect_duplicate`, se `fitid` existir:
    - consultar por transação do usuário com `fitid` igual e retornar duplicata imediatamente.
- **Dependências:** após T1 (independente, mas P0 recomenda sequência).
- **Done when:**
  - Importar duas vezes o mesmo OFX (com FITID) gera 100% de duplicatas pelo FITID (sem depender de heurística de descrição).
- **Gate checks:**
  - `python -m compileall backend`
  - (manual) importar o mesmo OFX duas vezes e validar `duplicate_count`.

### T3 — Remover duplicação de query de `previous_txns` no preview (REQ-P0-003)
- **Onde:** `backend/main.py` (endpoint `/import/ofx/preview`)
- **O que fazer:**
  - Remover bloco duplicado que repete `get_recent_transactions_with_category`.
- **Done when:**
  - Não existe duplicação e o comportamento permanece igual.
- **Gate checks:**
  - `python -m compileall backend`

---

## P1 — Estabilidade e corretude

### T4 — Definir padrão de dinheiro e aplicar (REQ-P1-002)
- **Decisão recomendada:** armazenar dinheiro como **inteiro em centavos** no DB (INT/BIGINT), ou `NUMERIC(14,2)` com `Decimal`.
- **Onde:** `backend/models.py`, `backend/schemas.py`, `backend/ofx_service.py`, endpoints de cartões/statement/projection, frontend `types.ts`/`utils/projection.ts`/Dashboard.
- **O que fazer:**
  - Escolher um padrão único (documentar).
  - Ajustar o modelo e conversões:
    - se “centavos”: garantir DB inteiro e backend trate como int; frontend já assume centavos.
    - se “numeric”: frontend precisará adaptar (ou continuar em centavos e converter na borda).
  - Remover ambiguidades (comentários vs implementação).
- **Done when:**
  - Somas e totais batem para cenários com muitos lançamentos (sem drift).
- **Gate checks:**
  - `npm run build`
  - `python -m compileall backend`
  - (manual) criar transações com centavos (ex.: R$ 0,01) e validar totals.

### T5 — Migrar datas de String para tipos nativos (REQ-P1-001)
- **Onde:** DB schema + `backend/models.py` + `backend/schemas.py`
- **O que fazer:**
  - Planejar migração segura (preferencialmente com Alembic, ver T8).
  - Ajustar colunas críticas: `Transaction.date`, `Transaction.created_at`, `ReserveHistory.date`, etc.
  - Ajustar filtros no CRUD (`>=`, `<=`) para usar tipos date.
- **Done when:**
  - Queries por período funcionam com precisão e índices podem ser usados.
- **Gate checks:**
  - (manual) filtrar transações por `start_date/end_date` e validar resultado.

### T6 — Extrair helper único para período de fatura (REQ-P1-003)
- **Onde:** criar `backend/credit_card_period.py` (ou `backend/utils/date_periods.py`) e usar em:
  - `/credit_cards/{id}/statement`
  - `/credit_cards/{id}/projection`
  - `/credit_cards/{id}/pay_invoice`
- **O que fazer:**
  - Centralizar cálculo de `start_date/end_date` e `get_date_safe`.
  - Padronizar interpretação do parâmetro `month` (mês de fechamento vs mês de vencimento) e documentar no endpoint.
- **Done when:**
  - Três endpoints usam a mesma função e não divergem em edge cases (meses curtos, closing_day=31, etc.).
- **Gate checks:**
  - `python -m compileall backend`
  - (manual) testar month em fevereiro e cartões com dia 29/30/31.

### T7 — Ajustar logout para não limpar tudo (REQ-P1-004)
- **Onde:** `store.ts`
- **O que fazer:**
  - Trocar `localStorage.clear()` por remoção seletiva (ex.: `removeItem('token')` e chaves do app).
- **Done when:**
  - Logout remove sessão do FinControl sem apagar outras chaves.
- **Gate checks:**
  - `npm run build`

---

## P2 — Qualidade/Operação

### T8 — Introduzir Alembic para migrações (REQ-P2-002)
- **Onde:** `backend/` (novo `alembic/` + config)
- **O que fazer:**
  - Adicionar Alembic e criar migrações para FITID / datas / dinheiro.
  - Integrar no fluxo de deploy (idealmente no startup ou pipeline).
- **Done when:**
  - Migrações são versionadas e reproduzíveis.

### T9 — Padronizar logging (REQ-P2-001)
- **Onde:** `backend/main.py`, `backend/ofx_service.py`, `backend/ai_openrouter.py`, `backend/scheduler.py`
- **O que fazer:**
  - Substituir `print()` por `logging`.
  - Garantir que erros relevantes contenham contexto (user_id, endpoint, card_id) sem vazar secrets.
- **Done when:**
  - Logs possuem níveis e mensagens consistentes.

### T10 — Paginação real no frontend para transações (REQ-P2-003)
- **Onde:** `store.ts`, `pages/Transactions.tsx` (e/ou componentes de listagem)
- **O que fazer:**
  - Implementar “load more” (skip/limit) e usar `/transactions/count`.
  - Evitar `fetchAllData` puxar todas as transações de uma vez.
- **Done when:**
  - Listagem de transações escala com muitos registros e mantém UX aceitável.

