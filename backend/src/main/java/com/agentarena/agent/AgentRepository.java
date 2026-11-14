package com.agentarena.agent;

import com.agentarena.common.ApiException;
import com.agentarena.common.Json;
import java.util.List;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

@Repository
public class AgentRepository {
    public static final List<String> TOOLS = List.of("get_booking", "get_refund_policy", "request_refund_approval", "issue_refund");
    private final JdbcTemplate db;
    private final Json json;
    private final RowMapper<AgentConfig> mapper = (r, n) -> new AgentConfig(r.getObject("id", UUID.class),
            r.getObject("family_id", UUID.class), r.getString("name"), r.getInt("version"), r.getString("model"),
            r.getString("system_prompt"), TOOLS, r.getTimestamp("created_at").toInstant());
    public AgentRepository(JdbcTemplate db, Json json) { this.db=db; this.json=json; }
    public List<AgentConfig> list() { return db.query("SELECT * FROM agent_configs ORDER BY created_at DESC,id", mapper); }
    public AgentConfig get(UUID id) {
        return db.query("SELECT * FROM agent_configs WHERE id=?", mapper, id).stream().findFirst()
                .orElseThrow(() -> ApiException.missing("Agent"));
    }
    public void lockFamily(UUID family) {
        db.queryForObject("SELECT id FROM agent_configs WHERE family_id=? AND version=1 FOR UPDATE", UUID.class, family);
    }
    public int nextVersion(UUID family) {
        return db.queryForObject("SELECT COALESCE(MAX(version),0)+1 FROM agent_configs WHERE family_id=?", Integer.class, family);
    }
    public AgentConfig insert(AgentRequest request, UUID family, int version) {
        UUID id=UUID.randomUUID();
        db.update("INSERT INTO agent_configs(id,family_id,name,version,model,system_prompt,tools) VALUES (?,?,?,?,?,?,?::jsonb)",
                id, family, request.name().trim(), version, request.model(), request.systemPrompt(), json.write(TOOLS));
        return get(id);
    }
}
