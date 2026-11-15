package com.agentarena.agent;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record AgentRequest(@NotBlank @Size(max=100) String name,
                           @NotBlank @Size(max=80) String model,
                           @NotBlank @Size(max=12000) String systemPrompt) {}
