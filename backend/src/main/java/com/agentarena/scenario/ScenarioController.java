package com.agentarena.scenario;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.List;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/scenarios")
public class ScenarioController {
    private final ScenarioRepository repository;
    public ScenarioController(ScenarioRepository repository) { this.repository=repository; }
    @GetMapping List<JsonNode> list() { return repository.list(); }
    @GetMapping("/{id}") JsonNode get(@PathVariable String id) { return repository.get(id); }
}
