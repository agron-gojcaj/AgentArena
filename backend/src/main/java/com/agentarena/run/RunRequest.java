package com.agentarena.run;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.List;
import java.util.UUID;

public record RunRequest(@NotNull UUID agentConfigId, @NotBlank @Size(max=80) String scenarioId,
                         @Size(min=1,max=20) List<@NotBlank String> testCaseIds,
                         @Valid ExecutionLimits executionLimits) {
    public RunRequest { if (executionLimits == null) executionLimits=ExecutionLimits.defaults(); }
}
