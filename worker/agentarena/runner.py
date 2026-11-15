import asyncio
import contextlib
import time

from agents import MaxTurnsExceeded
from openai import OpenAIError

from agentarena.agents.agent_factory import fake_agent, real_agent
from agentarena.evaluation.grader import grade
from agentarena.job_queue import LostLease
from agentarena.simulation.environment import ExecutionLimit, Simulation


async def execute(queue, run):
    async def pulse():
        while True:
            await asyncio.sleep(5)
            await asyncio.to_thread(queue.heartbeat, run['id'])

    async def cases():
        results = []
        total = {'input': 0, 'output': 0}
        failure = None
        for case in run['case_snapshots']:
            usage = {'input': 0, 'output': 0}

            def emit(kind, payload):
                if kind == 'MODEL_USAGE':
                    for key in usage:
                        usage[key] += payload[key]
                queue.record(run['id'], kind, payload, case['id'])

            sim = Simulation(case, run['scenario_snapshot']['policy'], emit, run['execution_limits']['maxToolCalls'])
            emit('CASE_STARTED', {'name': case['name'], 'input': case['input']})
            started = time.monotonic()
            final = None
            try:
                async with asyncio.timeout(run['execution_limits']['timeoutSecondsPerCase']):
                    config = run['agent_snapshot']
                    if config['model'].startswith('fake-'):
                        final, _ = await fake_agent(config['model'], case, sim, emit, run['execution_limits'])
                    else:
                        final, measured = await real_agent(config, case, sim, emit, run['execution_limits'])
                        usage.update(measured)
            except LostLease:
                raise
            except (TimeoutError, ExecutionLimit, MaxTurnsExceeded):
                failure = 'Execution limit exceeded.'
            except OpenAIError:
                failure = 'Model provider request failed. Check worker credentials, model access, and provider availability.'
            except Exception:
                # Provider exceptions can contain request content/headers. Never persist raw exceptions.
                failure = 'Agent execution failed. Check configuration and retry manually.'
            for key in total:
                total[key] += usage[key]
            result = grade(case, sim, final, usage, (time.monotonic() - started) * 1000, failure)
            queue.save_case(run['id'], case['id'], result)
            results.append(result)
            if failure:
                break
        queue.finish(run, results, total, failure)

    heartbeat = asyncio.create_task(pulse())
    execution = asyncio.create_task(cases())
    try:
        done, _ = await asyncio.wait([heartbeat, execution], return_when=asyncio.FIRST_COMPLETED)
        for task in done:
            task.result()
    finally:
        for task in [heartbeat, execution]:
            task.cancel()
        for task in [heartbeat, execution]:
            with contextlib.suppress(asyncio.CancelledError):
                await task
