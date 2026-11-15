package com.agentarena.agent;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record AgentConfig(UUID id, UUID familyId, String name, int version, String model,
                          String systemPrompt, List<String> tools, Instant createdAt) {}
