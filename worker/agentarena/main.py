import asyncio
import logging
import os
import signal

from agentarena.config import Settings
from agentarena.job_queue import LostLease, Queue
from agentarena.runner import execute


async def main():
    settings = Settings.from_env()
    queue = Queue(settings)
    if os.getenv('OPENAI_API_KEY'):
        from agents import set_default_openai_client
        from openai import AsyncOpenAI
        # Never silently retry potentially billable requests.
        set_default_openai_client(AsyncOpenAI(max_retries=0, timeout=120))
    stopping = asyncio.Event()
    loop = asyncio.get_running_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(sig, stopping.set)
    logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
    # Each process handles one job. Scale workers in Compose; DB enforces the shared limit.
    while not stopping.is_set():
        try:
            run = await asyncio.to_thread(queue.claim)
            if run:
                logging.info('Executing run %s', run['id'])
                await execute(queue, run)
                continue
        except LostLease:
            logging.warning('Lost run lease; execution stopped.')
        except Exception as exc:
            logging.error('Worker operation failed (%s); lease recovery will preserve failed jobs.', type(exc).__name__)
        try:
            await asyncio.wait_for(stopping.wait(), timeout=1)
        except TimeoutError:
            pass


if __name__ == '__main__':
    asyncio.run(main())
