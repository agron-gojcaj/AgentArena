package com.agentarena.run;

import com.fasterxml.jackson.databind.JsonNode;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record RunEntity(UUID id, UUID agentConfigId, String scenarioId, UUID comparisonId,
                        JsonNode agentSnapshot, JsonNode scenarioSnapshot, JsonNode caseSnapshots,
                        JsonNode executionLimits, String status, BigDecimal score, JsonNode tokenUsage,
                        BigDecimal costEstimate, BigDecimal reservedCost, JsonNode pricingSnapshot,
                        Instant createdAt, Instant startedAt, Instant finishedAt, String error, int passedCases, int finishedCases) {}
