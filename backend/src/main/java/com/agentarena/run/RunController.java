package com.agentarena.run;

import jakarta.validation.Valid;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/runs")
public class RunController {
    private final RunService service;
    private final RunRepository repository;
    public RunController(RunService service, RunRepository repository) { this.service=service; this.repository=repository; }
    @PostMapping(consumes="application/json") @ResponseStatus(HttpStatus.ACCEPTED)
    Map<String,Object> queue(@Valid @RequestBody RunRequest request) { return service.queue(request); }
    @PostMapping(value="/{id}/retry", consumes="application/json") @ResponseStatus(HttpStatus.ACCEPTED)
    Map<String,Object> retry(@PathVariable UUID id) { return service.retry(id); }
    @GetMapping List<RunEntity> list() { return service.list(); }
    @GetMapping("/{id}") Map<String,Object> get(@PathVariable UUID id) { return service.details(id); }
    @GetMapping("/{id}/trace") Object trace(@PathVariable UUID id) {
        repository.get(id);
        return repository.events(id,0,10000);
    }
}
