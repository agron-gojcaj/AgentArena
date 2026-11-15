package com.agentarena.run;

import com.agentarena.agent.AgentRepository;
import com.agentarena.common.ApiException;
import com.agentarena.scenario.ScenarioRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class RunService {
    private final RunRepository runs;
    private final AgentRepository agents;
    private final ScenarioRepository scenarios;
    private final int maximum;
    public RunService(RunRepository runs, AgentRepository agents, ScenarioRepository scenarios,
                      @Value("${arena.max-queued-runs}") int maximum) {
        this.runs=runs; this.agents=agents; this.scenarios=scenarios; this.maximum=maximum;
    }
    public List<JsonNode> selectCases(JsonNode scenario, List<String> ids) {
        List<JsonNode> all=new java.util.ArrayList<>();
        scenario.get("cases").forEach(all::add);
        if (ids==null) return all;
        if (new HashSet<>(ids).size()!=ids.size()) throw ApiException.invalid("Duplicate test case IDs");
        List<JsonNode> selected=all.stream().filter(c -> ids.contains(c.get("id").asText())).toList();
        if (selected.size()!=ids.size()) throw ApiException.invalid("Test cases must belong to the selected scenario");
        return selected;
    }
    @Transactional public Map<String,Object> queue(RunRequest request) {
        runs.capacity(1,maximum);
        JsonNode scenario=scenarios.get(request.scenarioId());
        UUID id=insert(request,null,null,scenario,selectCases(scenario,request.testCaseIds()));
        return Map.of("runId",id,"status","QUEUED","eventsUrl","/api/runs/"+id+"/events");
    }
    @Transactional public Map<String,Object> retry(UUID original) {
        var prior=runs.get(original);
        if (!prior.status().equals("COMPLETED") && !prior.status().equals("FAILED"))
            throw new ApiException(org.springframework.http.HttpStatus.CONFLICT,"Only finished runs can be retried");
        runs.capacity(1,maximum);
        UUID id=UUID.randomUUID();
        runs.retry(original,id);
        return Map.of("runId",id,"status","QUEUED","eventsUrl","/api/runs/"+id+"/events");
    }
    public UUID insert(RunRequest request, UUID comparison, Integer comparisonPosition, JsonNode scenario, List<JsonNode> cases) {
        UUID id=UUID.randomUUID();
        ObjectNode definition=scenario.deepCopy();
        definition.remove("cases");
        runs.insert(id,request,comparison,comparisonPosition,agents.get(request.agentConfigId()),definition,cases);
        return id;
    }
    public void reserveComparison() { runs.capacity(2,maximum); }
    public Map<String,Object> details(UUID id) { return Map.of("run",runs.get(id),"results",runs.results(id)); }
    public List<RunEntity> list() { return runs.list(); }
}
