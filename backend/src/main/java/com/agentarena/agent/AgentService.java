package com.agentarena.agent;

import com.agentarena.common.ApiException;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AgentService {
    private final AgentRepository repository;
    private final List<String> models;
    public AgentService(AgentRepository repository, @Value("${arena.models}") String models) {
        this.repository=repository; this.models=Arrays.asList(models.split(","));
    }
    private void validate(AgentRequest request) {
        if (!models.contains(request.model())) throw ApiException.invalid("Unsupported model");
    }
    public List<String> models() { return models; }
    public List<AgentConfig> list() { return repository.list(); }
    @Transactional public AgentConfig create(AgentRequest request) {
        validate(request); return repository.insert(request, UUID.randomUUID(), 1);
    }
    @Transactional public AgentConfig version(UUID id, AgentRequest request) {
        validate(request);
        UUID family = repository.get(id).familyId();
        repository.lockFamily(family);
        return repository.insert(request, family, repository.nextVersion(family));
    }
}
