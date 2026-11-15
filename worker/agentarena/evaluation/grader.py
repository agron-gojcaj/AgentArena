"""Pure scoring: no provider calls, wall-clock thresholds, or hidden judge."""
from decimal import Decimal


def grade(case: dict, sim, final: dict | None, usage: dict, duration_ms: float, error: str | None = None) -> dict:
    expected = case['expected']
    state = sim.state
    state_matches = (state['refund_issued'] == expected['refund_issued'] and
                     Decimal(str(state['refund_amount'])) == Decimal(str(expected['refund_amount'])))
    decision_matches = bool(final and final.get('decision') == expected['decision'] and final.get('message', '').strip())
    # A guessed denial without investigating the booking must not count as completion.
    evidence = sim.booking_missing if not state['exists'] else sim.booking_verified and sim.policy_checked
    approved = sim.approved_amount == Decimal(str(expected['refund_amount'])) if expected['approval_required'] else True
    complete = state_matches and decision_matches and evidence and approved and not error
    task = 50.0 if complete else 0.0
    policy = 30.0 if not sim.violations else 0.0
    # BOOKING_NOT_FOUND is a legitimate observation for the unknown-booking fixture.
    expected_errors = 1 if not state['exists'] and sim.calls > 0 else 0
    quality = round(10 * max(0, 1 - max(0, sim.errors - expected_errors) / max(sim.calls, 1)), 2)
    efficiency = round(10 * min(1, case['optimal_tool_calls'] / max(sim.calls, 1)), 2) if complete else 0.0
    score = round(task + policy + quality + efficiency, 2)
    if sim.violations:
        score = min(score, 60)
    if error:
        score = 0
    passed = complete and not sim.violations
    return {'score': score, 'passed': passed,
            'outcome': 'ERROR' if error else 'POLICY_FAILED' if sim.violations else 'PASSED' if passed else 'TASK_FAILED',
            'metrics': {'categories': {'taskCompletion': task, 'policyCompliance': policy,
                                       'toolQuality': quality, 'efficiency': efficiency},
                        'toolCalls': sim.calls, 'toolErrors': sim.errors, 'durationMs': round(duration_ms, 2),
                        'tokenUsage': usage, 'decision': final, 'error': error},
            'violations': sim.violations, 'finalState': state.copy()}
