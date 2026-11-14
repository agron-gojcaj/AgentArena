"""Exercise the real Agents SDK loop against deterministic provider responses."""
import json
import pytest
from agents import Agent, MaxTurnsExceeded
from agents.items import ModelResponse
from agents.models.interface import Model
from agents.usage import Usage
from openai.types.responses import ResponseFunctionToolCall, ResponseOutputMessage, ResponseOutputText
from agentarena.agents import agent_factory
from agentarena.simulation.environment import ExecutionLimit, Simulation


class ScriptedModel(Model):
    def __init__(self, outputs):
        self.outputs = iter(outputs)

    async def get_response(self, **kwargs):
        output = next(self.outputs)
        return ModelResponse(output=[output], usage=Usage(requests=1, input_tokens=10, output_tokens=5, total_tokens=15), response_id=None)

    async def stream_response(self, **kwargs):
        raise NotImplementedError
        yield


def call(name, arguments, index):
    return ResponseFunctionToolCall(type='function_call', name=name, arguments=json.dumps(arguments), call_id=f'call-{index}')


def answer(decision='REFUNDED'):
    return ResponseOutputMessage(id='final', role='assistant', status='completed', type='message', content=[
        ResponseOutputText(type='output_text', annotations=[], text=json.dumps({'decision': decision, 'message': 'Finished.'}))])


def patch_model(monkeypatch, outputs):
    model = ScriptedModel(outputs)
    def factory(**kwargs):
        kwargs['model'] = model
        return Agent(**kwargs)
    monkeypatch.setattr(agent_factory, 'Agent', factory)


async def test_real_sdk_calls_tools_and_records_usage(monkeypatch, cases, policy):
    patch_model(monkeypatch, [call('get_booking', {'booking_id': 'BK-102'}, 1),
                             call('get_refund_policy', {}, 2),
                             call('request_refund_approval', {'booking_id': 'BK-102', 'amount': 180}, 3),
                             call('issue_refund', {'booking_id': 'BK-102', 'amount': 180}, 4), answer()])
    events=[]
    emit=lambda kind, payload: events.append((kind,payload))
    sim=Simulation(cases[1],policy,emit)
    config={'name':'Support','model':'gpt-4.1-mini','systemPrompt':'Follow policy','tools':['get_booking','get_refund_policy','request_refund_approval','issue_refund']}
    final,usage=await agent_factory.real_agent(config,cases[1],sim,emit,{'maxModelTurns':8})
    assert final['decision']=='REFUNDED' and sim.state['refund_amount']==180
    assert usage=={'input':50,'output':25}
    assert len([e for e in events if e[0]=='TOOL_CALL_COMPLETED'])==4
    assert len([e for e in events if e[0]=='MODEL_USAGE'])==5


async def test_sdk_malformed_arguments_are_recorded(monkeypatch,cases,policy):
    patch_model(monkeypatch,[call('issue_refund',{'booking_id':'BK-101','amount':'oops'},1),answer('DENIED')])
    events=[]
    emit=lambda kind,payload:events.append((kind,payload))
    sim=Simulation(cases[0],policy,emit)
    config={'name':'Bad','model':'gpt-4.1-mini','systemPrompt':'x','tools':['issue_refund']}
    await agent_factory.real_agent(config,cases[0],sim,emit,{'maxModelTurns':3})
    assert sim.errors==1 and not sim.state['refund_issued']
    assert next(p for k,p in events if k=='TOOL_CALL_COMPLETED')['result']['error']=='INVALID_AMOUNT'


async def test_sdk_turn_limit(monkeypatch,cases,policy):
    patch_model(monkeypatch,[call('get_refund_policy',{},1),call('get_refund_policy',{},2)])
    sim=Simulation(cases[0],policy,lambda *_:None)
    with pytest.raises(MaxTurnsExceeded):
        await agent_factory.real_agent({'name':'Loop','model':'gpt-4.1-mini','systemPrompt':'x','tools':['get_refund_policy']},cases[0],sim,lambda *_:None,{'maxModelTurns':1})


async def test_context_budget_checked_before_provider_call():
    hook=agent_factory.UsageHooks(lambda *_:None)
    with pytest.raises(ExecutionLimit):
        await hook.on_llm_start(None,None,'x'*60000,[])
