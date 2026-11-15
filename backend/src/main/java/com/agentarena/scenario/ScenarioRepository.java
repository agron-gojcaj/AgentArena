package com.agentarena.scenario;

import com.agentarena.common.ApiException;
import com.agentarena.common.Json;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.List;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class ScenarioRepository {
    private final JdbcTemplate db;
    private final Json json;
    public ScenarioRepository(JdbcTemplate db, Json json) { this.db=db; this.json=json; }
    public List<JsonNode> list() {
        return db.query("SELECT definition FROM scenarios ORDER BY id", (r,n) -> json.read(r.getString(1)));
    }
    public JsonNode get(String id) {
        ObjectNode definition = (ObjectNode) db.query("SELECT definition FROM scenarios WHERE id=?", (r,n) -> json.read(r.getString(1)),id)
                .stream().findFirst().orElseThrow(() -> ApiException.missing("Scenario"));
        definition.set("cases", json.read(json.write(cases(id))));
        return definition;
    }
    public List<JsonNode> cases(String id) {
        return db.query("SELECT definition FROM test_cases WHERE scenario_id=? ORDER BY id", (r,n) -> json.read(r.getString(1)),id);
    }
}
