import json
import os
from dataclasses import dataclass
from decimal import Decimal


@dataclass(frozen=True)
class Settings:
    dsn: str
    budget: Decimal
    concurrency: int
    pricing: dict
    lease_seconds: int = 30

    @classmethod
    def from_env(cls):
        budget = Decimal(os.getenv('PROJECT_BUDGET_USD', '5'))
        concurrency = int(os.getenv('MAX_CONCURRENT_RUNS', '2'))
        pricing = json.loads(os.getenv('MODEL_PRICING_JSON', '{"gpt-4.1-mini":{"input":0.4,"output":1.6}}'))
        if not budget.is_finite() or budget < 0 or not 1 <= concurrency <= 8:
            raise ValueError('Invalid budget or concurrency configuration')
        for rates in pricing.values():
            for key in ('input', 'output'):
                rate = Decimal(str(rates[key]))
                if not rate.is_finite() or rate < 0:
                    raise ValueError('Invalid model pricing')
        return cls(os.getenv('DATABASE_URL', 'postgresql://agentarena:agentarena-local@localhost:5432/agentarena'), budget, concurrency, pricing)


def cost(usage: dict, rates: dict) -> Decimal:
    return (Decimal(usage['input']) * Decimal(str(rates['input'])) +
            Decimal(usage['output']) * Decimal(str(rates['output']))) / Decimal(1_000_000)
