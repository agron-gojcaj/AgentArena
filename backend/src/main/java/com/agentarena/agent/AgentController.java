package com.agentarena.agent;

import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
public class AgentController {
    private final AgentService service;
    public AgentController(AgentService service) { this.service=service; }
    @GetMapping("/agents") List<AgentConfig> list() { return service.list(); }
    @GetMapping("/models") List<String> models() { return service.models(); }
    @PostMapping(value="/agents", consumes="application/json") @ResponseStatus(HttpStatus.CREATED)
    AgentConfig create(@Valid @RequestBody AgentRequest request) { return service.create(request); }
    @PostMapping(value="/agents/{id}/versions", consumes="application/json") @ResponseStatus(HttpStatus.CREATED)
    AgentConfig version(@PathVariable UUID id, @Valid @RequestBody AgentRequest request) { return service.version(id,request); }
}
