package com.agentarena.run;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

public record ExecutionLimits(@Min(1) @Max(16) Integer maxModelTurns,
                              @Min(1) @Max(30) Integer maxToolCalls,
                              @Min(1) @Max(120) Integer timeoutSecondsPerCase) {
    public ExecutionLimits {
        if (maxModelTurns == null) maxModelTurns=8;
        if (maxToolCalls == null) maxToolCalls=12;
        if (timeoutSecondsPerCase == null) timeoutSecondsPerCase=60;
    }
    public static ExecutionLimits defaults() { return new ExecutionLimits(null,null,null); }
}
