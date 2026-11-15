package com.agentarena.comparison;

import com.agentarena.common.ApiException;
import com.agentarena.run.*;
import com.agentarena.scenario.ScenarioRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/comparisons")
public class ComparisonController {
    public record Request(@NotNull @Size(min=2,max=2) List<@NotNull UUID> agentConfigIds,
                          @NotBlank @Size(max=80) String scenarioId,
                          @Size(min=1,max=20) List<@NotBlank String> testCaseIds, @Valid ExecutionLimits executionLimits) {
        public Request { if(executionLimits==null) executionLimits=ExecutionLimits.defaults(); }
    }
    private final RunService service;
    private final RunRepository runs;
    private final ScenarioRepository scenarios;
    public ComparisonController(RunService service, RunRepository runs, ScenarioRepository scenarios) {
        this.service=service; this.runs=runs; this.scenarios=scenarios;
    }
    @PostMapping(consumes="application/json") @ResponseStatus(HttpStatus.ACCEPTED) @Transactional
    Map<String,Object> queue(@Valid @RequestBody Request request) {
        service.reserveComparison();
        UUID comparison=UUID.randomUUID();
        var scenario=scenarios.get(request.scenarioId());
        var cases=service.selectCases(scenario,request.testCaseIds());
        List<UUID> ids=java.util.stream.IntStream.range(0,2).mapToObj(index -> service.insert(
                new RunRequest(request.agentConfigIds().get(index),request.scenarioId(),request.testCaseIds(),request.executionLimits()),comparison,index,scenario,cases)).toList();
        return Map.of("comparisonId",comparison,"runIds",ids,"status","QUEUED");
    }
    @GetMapping("/{id}") Map<String,Object> get(@PathVariable UUID id) {
        var entries=runs.comparison(id);
        if(entries.isEmpty()) throw ApiException.missing("Comparison");
        return Map.of("comparisonId",id,"runs",entries.stream().map(r -> service.details(r.id())).toList());
    }
}
