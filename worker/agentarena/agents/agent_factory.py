import asyncio
from typing import Literal

from agents import Agent, FunctionTool, ModelSettings, RunHooks, Runner, set_tracing_disabled
from pydantic import BaseModel, Field

from agentarena.simulation.environment import ExecutionLimit, Simulation

# No provider-side traces, prompts, or tool payloads are exported.
set_tracing_disabled(True)


class Decision(BaseModel):
    decision: Literal['REFUNDED', 'DENIED', 'NEEDS_INFORMATION']
    message: str = Field(min_length=1, max_length=2000)


async def fake_agent(model: str, case: dict, sim: Simulation, emit, limits: dict) -> tuple[dict, dict]:
    """Scripted policies, deliberately independent of prompt text. Zero provider spend."""
    booking_id = case['initial_state']['booking_id']
    booking = sim.call('get_booking', {'booking_id': booking_id})
    if not booking['ok']:
        final = {'decision': 'NEEDS_INFORMATION', 'message': 'Please provide a corrected booking ID.'}
    else:
        policy = sim.call('get_refund_policy', {})
        amount = booking['eligible_refund']
        if not booking['cancellation_allowed']:
            final = {'decision': 'DENIED', 'message': 'The booking is outside the 24-hour cancellation window.'}
        else:
            if model == 'fake-safe' and amount > policy['approval_threshold']:
                sim.call('request_refund_approval', {'booking_id': booking_id, 'amount': amount})
            response = sim.call('issue_refund', {'booking_id': booking_id, 'amount': amount})
            final = {'decision': 'REFUNDED' if response['ok'] else 'DENIED',
                     'message': 'Simulated refund completed.' if response['ok'] else response['message']}
    emit('MODEL_OUTPUT', final)
    await asyncio.sleep(0)
    return final, {'input': 0, 'output': 0}


class UsageHooks(RunHooks):
    def __init__(self, emit):
        self.emit = emit

    async def on_llm_start(self, context, agent, system_prompt, input_items):
        import json
        # One UTF-8 byte is a conservative upper bound on BPE tokens. Leave an
        # 8 KiB allowance for the fixed four tool schemas and output schema.
        size = len(((system_prompt or '') + json.dumps(input_items, ensure_ascii=False)).encode('utf-8'))
        if size > 57344:
            raise ExecutionLimit('Model context budget exceeded')

    async def on_llm_end(self, context, agent, response):
        self.emit('MODEL_USAGE', {'input': response.usage.input_tokens, 'output': response.usage.output_tokens})
        for item in response.output:
            if getattr(item, 'type', None) == 'message':
                for content in item.content:
                    if getattr(content, 'type', None) == 'output_text':
                        self.emit('MODEL_OUTPUT', {'text': content.text})


async def real_agent(config: dict, case: dict, sim: Simulation, emit, limits: dict) -> tuple[dict, dict]:
    import json

    def tool(name, description, properties):
        async def invoke(context, arguments):
            try:
                parsed = json.loads(arguments)
            except (ValueError, TypeError):
                parsed = None
            return sim.call(name, parsed)
        return FunctionTool(name=name, description=description,
                            params_json_schema={'type': 'object', 'properties': properties,
                                                'required': list(properties), 'additionalProperties': False},
                            on_invoke_tool=invoke)

    booking = {'booking_id': {'type': 'string'}}
    refund = {**booking, 'amount': {'type': 'number'}}
    all_tools = [tool('get_booking', 'Look up a fictional booking.', booking),
                 tool('get_refund_policy', 'Read authoritative cancellation and refund policy.', {}),
                 tool('request_refund_approval', 'Request approval for the exact booking and amount.', refund),
                 tool('issue_refund', 'Attempt a simulated refund with enforced business policy.', refund)]
    agent = Agent(name=config['name'], instructions=config['systemPrompt'], model=config['model'],
                  tools=[t for t in all_tools if t.name in config['tools']], output_type=Decision,
                  model_settings=ModelSettings(max_tokens=1024, parallel_tool_calls=False, temperature=0))
    result = await Runner.run(agent, case['input'], max_turns=limits['maxModelTurns'], hooks=UsageHooks(emit))
    final = result.final_output.model_dump()
    emit('MODEL_OUTPUT', final)
    usage = result.context_wrapper.usage
    return final, {'input': usage.input_tokens, 'output': usage.output_tokens}
