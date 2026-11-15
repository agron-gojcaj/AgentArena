import asyncio
import json
import os
import uuid
from concurrent.futures import ThreadPoolExecutor
from dataclasses import replace
from decimal import Decimal
from pathlib import Path

import psycopg
import pytest
from psycopg.conninfo import make_conninfo
from psycopg.types.json import Jsonb
from agentarena.config import Settings
from agentarena.job_queue import LostLease, Queue
from agentarena.runner import execute

ROOT=Path(__file__).resolve().parents[2]


@pytest.fixture
def queue(cases,policy):
    dsn=os.getenv('TEST_DATABASE_URL')
    if not dsn:
        pytest.skip('Set TEST_DATABASE_URL to run real PostgreSQL queue tests')
    schema='test_'+uuid.uuid4().hex
    with psycopg.connect(dsn,autocommit=True) as conn:
        conn.execute(psycopg.sql.SQL('CREATE SCHEMA {}').format(psycopg.sql.Identifier(schema)))
    settings=Settings(make_conninfo(dsn,options=f'-csearch_path={schema}'),Decimal('5'),2,{'gpt-4.1-mini':{'input':0.4,'output':1.6}})
    q=Queue(settings)
    with q.connect() as conn:
        for migration in sorted((ROOT/'backend/src/main/resources/db/migration').glob('V*.sql')):
            conn.execute(migration.read_text())
        conn.execute("INSERT INTO scenarios(id,title,description,version,definition) VALUES ('refund-rescue','Refund','Test',1,'{}')")
    yield q
    with psycopg.connect(dsn,autocommit=True) as conn:
        conn.execute(psycopg.sql.SQL('DROP SCHEMA {} CASCADE').format(psycopg.sql.Identifier(schema)))


def enqueue(queue,cases,policy,model='fake-safe',limits=None):
    run_id=uuid.uuid4(); agent_id=uuid.uuid4()
    snapshot={'name':'Test','model':model,'systemPrompt':'Follow policy','tools':['get_booking','get_refund_policy','request_refund_approval','issue_refund']}
    limits=limits or {'maxModelTurns':8,'maxToolCalls':12,'timeoutSecondsPerCase':60}
    with queue.connect() as conn:
        conn.execute("INSERT INTO agent_configs(id,family_id,name,version,model,system_prompt,tools) VALUES (%s,%s,'Test',1,%s,'Follow policy',%s)",
                     (agent_id,agent_id,model,Jsonb(snapshot['tools'])))
        conn.execute("""INSERT INTO runs(id,agent_config_id,scenario_id,agent_snapshot,scenario_snapshot,case_snapshots,execution_limits)
                        VALUES (%s,%s,'refund-rescue',%s,%s,%s,%s)""",
                     (run_id,agent_id,Jsonb(snapshot),Jsonb({'policy':policy}),Jsonb(cases),Jsonb(limits)))
    return run_id


async def test_complete_job_persists_ordered_replay_and_results(queue,cases,policy):
    run_id=enqueue(queue,cases,policy)
    run=queue.claim()
    await execute(queue,run)
    with queue.connect() as conn:
        row=conn.execute('SELECT * FROM runs WHERE id=%s',(run_id,)).fetchone()
        events=conn.execute('SELECT * FROM run_events WHERE run_id=%s ORDER BY id',(run_id,)).fetchall()
        results=conn.execute('SELECT * FROM run_case_results WHERE run_id=%s',(run_id,)).fetchall()
    assert row['status']=='COMPLETED' and row['score']==100 and row['cost_estimate']==0
    assert len(results)==5 and all(r['passed'] for r in results)
    assert events[0]['event_type']=='RUN_STARTED' and events[-1]['event_type']=='RUN_COMPLETED'
    assert [e['sequence'] for e in events]==list(range(1,len(events)+1))


def test_concurrent_workers_claim_each_job_once_and_respect_capacity(queue,cases,policy):
    ids={enqueue(queue,cases,policy) for _ in range(4)}
    workers=[Queue(queue.settings) for _ in range(4)]
    with ThreadPoolExecutor(max_workers=4) as pool:
        claims=list(pool.map(lambda q:q.claim(),workers))
    claimed=[r['id'] for r in claims if r]
    assert len(claimed)==2 and len(set(claimed))==2 and set(claimed)<=ids


def test_expired_lease_is_failed_never_requeued_and_fences_old_worker(queue,cases,policy):
    run_id=enqueue(queue,cases,policy); queue.claim()
    with queue.connect() as conn:
        conn.execute("UPDATE runs SET lease_until=now()-interval '1 minute',reserved_cost=1.2 WHERE id=%s",(run_id,))
    other=Queue(queue.settings); other.reap()
    with pytest.raises(LostLease): queue.record(run_id,'MODEL_OUTPUT',{'text':'late'})
    with pytest.raises(LostLease): queue.heartbeat(run_id)
    with queue.connect() as conn:
        row=conn.execute('SELECT * FROM runs WHERE id=%s',(run_id,)).fetchone()
    assert row['status']=='FAILED' and row['reserved_cost']==Decimal('1.2')
    assert other.claim() is None


def test_missing_provider_key_fails_without_paid_calls(queue,cases,policy,monkeypatch):
    monkeypatch.delenv('OPENAI_API_KEY',raising=False)
    run_id=enqueue(queue,cases,policy,'gpt-4.1-mini')
    assert queue.claim() is None
    with queue.connect() as conn:
        row=conn.execute('SELECT * FROM runs WHERE id=%s',(run_id,)).fetchone()
    assert row['status']=='FAILED' and 'OPENAI_API_KEY' in row['error']


def test_project_budget_reservations_are_atomic(queue,cases,policy,monkeypatch):
    monkeypatch.setenv('OPENAI_API_KEY','test-not-a-real-key')
    settings=replace(queue.settings,budget=Decimal('1.5'))
    workers=[Queue(settings),Queue(settings)]
    for _ in workers: enqueue(queue,cases,policy,'gpt-4.1-mini')
    with ThreadPoolExecutor(max_workers=2) as pool:
        claims=list(pool.map(lambda q:q.claim(),workers))
    assert len([r for r in claims if r])==1
    with queue.connect() as conn:
        total=conn.execute('SELECT SUM(cost_estimate+reserved_cost) AS n FROM runs').fetchone()['n']
        failed=conn.execute("SELECT error FROM runs WHERE status='FAILED'").fetchone()
    assert total<=Decimal('1.5') and 'budget' in failed['error']


async def test_tool_limit_is_persisted_as_failure(queue,cases,policy):
    run_id=enqueue(queue,cases,policy,limits={'maxModelTurns':1,'maxToolCalls':1,'timeoutSecondsPerCase':60})
    await execute(queue,queue.claim())
    with queue.connect() as conn:
        row=conn.execute('SELECT * FROM runs WHERE id=%s',(run_id,)).fetchone()
        result=conn.execute('SELECT * FROM run_case_results WHERE run_id=%s',(run_id,)).fetchone()
    assert row['status']=='FAILED' and result['outcome']=='ERROR' and result['score']==0


async def test_timeout_and_provider_error_are_sanitized(queue,cases,policy,monkeypatch):
    from agentarena import runner
    async def stalled(*args):
        await asyncio.sleep(10)
    monkeypatch.setattr(runner,'fake_agent',stalled)
    run_id=enqueue(queue,cases,policy,limits={'maxModelTurns':8,'maxToolCalls':12,'timeoutSecondsPerCase':1})
    await execute(queue,queue.claim())
    with queue.connect() as conn:
        row=conn.execute('SELECT * FROM runs WHERE id=%s',(run_id,)).fetchone()
    assert row['status']=='FAILED' and row['error']=='Execution limit exceeded.'


async def test_provider_error_does_not_persist_exception_content(queue,cases,policy,monkeypatch):
    from agentarena import runner
    from openai import OpenAIError
    async def failing(*args):
        raise OpenAIError('secret-private-prompt-and-key')
    monkeypatch.setattr(runner,'fake_agent',failing)
    run_id=enqueue(queue,cases,policy)
    await execute(queue,queue.claim())
    with queue.connect() as conn:
        row=conn.execute('SELECT * FROM runs WHERE id=%s',(run_id,)).fetchone()
        events=conn.execute('SELECT payload FROM run_events WHERE run_id=%s',(run_id,)).fetchall()
    assert row['status']=='FAILED' and 'secret-private' not in row['error']
    assert 'secret-private' not in str(events)


def test_zero_cost_fake_runs_work_even_after_budget_is_lowered(queue,cases,policy):
    prior=enqueue(queue,cases,policy)
    with queue.connect() as conn:
        conn.execute("UPDATE runs SET status='FAILED',reserved_cost=10 WHERE id=%s",(prior,))
    next_id=enqueue(queue,cases,policy)
    free_queue=Queue(replace(queue.settings,budget=Decimal('0')))
    assert free_queue.claim()['id']==next_id
