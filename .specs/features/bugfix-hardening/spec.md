# Spec — Plano de Correção de Bugs & Hardening (FinControl AI)

Data: 2026-05-11

## Contexto
Foi executada uma análise da codebase do FinControl AI (FastAPI + React). Este documento descreve **o que** deve ser corrigido (requisitos rastreáveis) para eliminar bugs, falhas funcionais e pontos de fragilidade detectados.

## Objetivo
Elevar estabilidade, confiabilidade e manutenibilidade do sistema, corrigindo bugs críticos primeiro e, em seguida, reduzindo risco de regressões com refatorações pontuais e preparação para migrações seguras.

## Escopo
Inclui backend (API, scheduler, importação OFX, models/DB) e frontend (store/logout/paginação). Inclui apenas planejamento; implementação fica para a fase “Execute”.

## Fora de escopo (neste plano)
- Redesenho completo de UX/UI.
- Reescrita total de roteamento do frontend.
- Otimizações de custo de IA (apenas correções e guardrails).

---

## Requisitos (IDs rastreáveis)

### Bugs críticos (P0)

**REQ-P0-001 — Scheduler deve criar transações sem crash**
- O processamento de regras recorrentes com `auto_create=True` deve criar transações PENDING com sucesso.
- Não pode existir chamada a função inexistente no CRUD.

**REQ-P0-002 — Deduplicação OFX deve suportar FITID**
- Se o OFX trouxer FITID, a deduplicação deve comparar FITID de forma determinística.
- FITID deve ser persistido na transação (ou em tabela auxiliar), permitindo comparação em importações futuras.

**REQ-P0-003 — Remover duplicação de código no preview OFX**
- O preview OFX não pode executar queries duplicadas para obter `previous_txns`.

### Estabilidade e corretude (P1)

**REQ-P1-001 — Datas devem ser tipadas corretamente no banco**
- Campos de data/timestamp relevantes devem migrar de `String` para `DATE`/`TIMESTAMP` (com migração segura).

**REQ-P1-002 — Valores monetários devem evitar ponto flutuante**
- Backend e DB devem evitar float para dinheiro (preferência: `Decimal` / `NUMERIC` no DB, ou inteiro em centavos).
- Deve existir um padrão único e documentado (sem conversões inconsistentes).

**REQ-P1-003 — Lógica de período de fatura deve ser única**
- Cálculo do período (start/end) deve ser extraído para helper reutilizável, usado por statement/projection/pay_invoice.

**REQ-P1-004 — Logout não deve apagar dados de outras apps**
- Logout deve remover apenas as chaves do FinControl no `localStorage`.

### Qualidade / Operação (P2)

**REQ-P2-001 — Logging padronizado**
- Substituir `print()` por `logging` com níveis (info/warn/error) em pontos críticos (OFX, IA, scheduler).

**REQ-P2-002 — Migrações versionadas**
- Introduzir Alembic para migrações futuras (sem depender apenas de `init_tables.py`).

**REQ-P2-003 — Paginação/escala do frontend**
- Frontend deve suportar paginação incremental de transações (evitar “pegar tudo” em uma chamada).

---

## Critérios gerais de aceite
- Nenhum erro de import/atributo em runtime (ex.: scheduler).
- Fluxo de importação OFX funciona com e sem FITID.
- Padrão monetário e de datas definido, implementado e testado (mínimo smoke).
- Refatorações não devem mudar comportamento externo (exceto correções esperadas), com verificação manual e/ou testes automatizados.

