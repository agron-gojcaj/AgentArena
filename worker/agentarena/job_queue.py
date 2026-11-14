"""Short transactions, leased ownership, and a shared budget across worker processes."""
import os
import uuid
from decimal import Decimal

import psycopg
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb

from agentarena.config import cost


class LostLease(RuntimeError):
    pass


class Queue:
    def __init__(self, settings):
        self.settings = settings
        self.worker_id = uuid.uuid4()

    def connect(self):
        return psycopg.connect(self.settings.dsn, row_factory=dict_row)

    @staticmethod
    def event(conn, run_id, kind, payload, case_id=None):
        # Caller holds the run row lock. This orders ID allocation AND commits per run.
        conn.execute('''INSERT INTO run_events (run_id,case_id,sequence,event_type,payload)
            SELECT %s,%s,COALESCE(MAX(sequence),0)+1,%s,%s FROM run_events WHERE run_id=%s''',
                     (run_id, case_id, kind, Jsonb(payload), run_id))

    def reap(self):
        with self.connect() as conn:
            rows = conn.execute("SELECT id FROM runs WHERE status='RUNNING' AND lease_until < now() FOR UPDATE SKIP LOCKED").fetchall()
            for row in rows:
                # Retain reserved cost after a crash: in-flight provider spend is unknown.
                conn.execute("UPDATE runs SET status='FAILED',finished_at=now(),error=%s WHERE id=%s",
                             ('Worker lease expired. Retry manually; provider spend may have occurred.', row['id']))
                self.event(conn, row['id'], 'RUN_FAILED', {'error': 'Worker lease expired; manual retry required.'})

    def claim(self):
        self.reap()
        with self.connect() as conn:
            # Serialize capacity/budget accounting, while the row claim uses SKIP LOCKED.
            conn.execute('SELECT pg_advisory_xact_lock(71242001)')
            active = conn.execute("SELECT count(*) AS n FROM runs WHERE status='RUNNING'").fetchone()['n']
            if active >= self.settings.concurrency:
                return None
            run = conn.execute("SELECT * FROM runs WHERE status='QUEUED' ORDER BY created_at,id FOR UPDATE SKIP LOCKED LIMIT 1").fetchone()
            if not run:
                return None
            model = run['agent_snapshot']['model']
            rates = {'input': 0, 'output': 0} if model.startswith('fake-') else self.settings.pricing.get(model)
            error = None
            reserve = Decimal(0)
            if rates is None:
                error = 'No pricing configured for this model.'
            elif not model.startswith('fake-') and not os.getenv('OPENAI_API_KEY'):
                error = 'Real-agent mode requires OPENAI_API_KEY in the worker environment.'
            else:
                turns = len(run['case_snapshots']) * run['execution_limits']['maxModelTurns']
                reserve = cost({'input': 65536 * turns, 'output': 1024 * turns}, rates)
                spent = conn.execute('SELECT COALESCE(SUM(cost_estimate+reserved_cost),0) AS n FROM runs').fetchone()['n']
                if reserve > 0 and spent + reserve > self.settings.budget:
                    error = 'Project budget cannot reserve this run. Reduce cases/turns or increase the local budget.'
            if error:
                conn.execute("UPDATE runs SET status='FAILED',finished_at=now(),error=%s WHERE id=%s", (error, run['id']))
                self.event(conn, run['id'], 'RUN_FAILED', {'error': error})
                return None
            conn.execute("""UPDATE runs SET status='RUNNING',started_at=now(),worker_id=%s,
                lease_until=now() + %s * interval '1 second',reserved_cost=%s,pricing_snapshot=%s WHERE id=%s""",
                         (self.worker_id, self.settings.lease_seconds, reserve, Jsonb(rates), run['id']))
            self.event(conn, run['id'], 'RUN_STARTED', {'model': model, 'caseCount': len(run['case_snapshots'])})
            run['pricing_snapshot'] = rates
            return run

    def lock_owned(self, conn, run_id):
        row = conn.execute("SELECT id FROM runs WHERE id=%s AND worker_id=%s AND status='RUNNING' AND lease_until>now() FOR UPDATE",
                           (run_id, self.worker_id)).fetchone()
        if not row:
            raise LostLease('Run lease is no longer owned by this worker')

    def heartbeat(self, run_id):
        with self.connect() as conn:
            self.lock_owned(conn, run_id)
            conn.execute("UPDATE runs SET lease_until=now()+%s * interval '1 second' WHERE id=%s",
                         (self.settings.lease_seconds, run_id))

    def record(self, run_id, kind, payload, case_id=None):
        with self.connect() as conn:
            self.lock_owned(conn, run_id)
            self.event(conn, run_id, kind, payload, case_id)

    def save_case(self, run_id, case_id, result):
        with self.connect() as conn:
            self.lock_owned(conn, run_id)
            conn.execute('''INSERT INTO run_case_results (id,run_id,case_id,score,passed,outcome,metrics,violations,final_state)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)''',
                         (uuid.uuid4(), run_id, case_id, result['score'], result['passed'], result['outcome'],
                          Jsonb(result['metrics']), Jsonb(result['violations']), Jsonb(result['finalState'])))
            self.event(conn, run_id, 'CASE_COMPLETED', result, case_id)

    def finish(self, run, results, usage, error=None):
        with self.connect() as conn:
            self.lock_owned(conn, run['id'])
            amount = cost(usage, run['pricing_snapshot'])
            # On failures reserve remains conservatively charged for unreported usage.
            conn.execute('''UPDATE runs SET status=%s,score=%s,token_usage=%s,cost_estimate=%s,
                reserved_cost=CASE WHEN %s THEN GREATEST(reserved_cost-%s,0) ELSE 0 END,
                error=%s,finished_at=now(),lease_until=NULL WHERE id=%s''',
                         ('FAILED' if error else 'COMPLETED', sum(r['score'] for r in results) / len(results) if results else 0,
                          Jsonb(usage), amount, bool(error), amount, error, run['id']))
            self.event(conn, run['id'], 'RUN_FAILED' if error else 'RUN_COMPLETED',
                       {'error': error} if error else {'score': sum(r['score'] for r in results) / len(results), 'tokenUsage': usage})
