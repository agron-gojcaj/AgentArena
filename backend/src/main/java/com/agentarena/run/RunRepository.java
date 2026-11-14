package com.agentarena.run;

import com.agentarena.common.ApiException;
import com.agentarena.common.Json;
import com.fasterxml.jackson.databind.JsonNode;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class RunRepository {
    private static final String SELECT = "SELECT runs.*, " +
        "(SELECT count(*) FROM run_case_results c WHERE c.run_id=runs.id AND c.passed) AS passed_cases, " +
        "(SELECT count(*) FROM run_case_results c WHERE c.run_id=runs.id) AS finished_cases FROM runs ";
    private final JdbcTemplate db;
    private final Json json;
    public RunRepository(JdbcTemplate db, Json json) { this.db=db; this.json=json; }
    private Instant time(ResultSet r, String name) throws SQLException {
        return r.getTimestamp(name)==null ? null : r.getTimestamp(name).toInstant();
    }
    private RunEntity map(ResultSet r, int n) throws SQLException {
        return new RunEntity(r.getObject("id",UUID.class),r.getObject("agent_config_id",UUID.class),r.getString("scenario_id"),
                r.getObject("comparison_id",UUID.class),json.read(r.getString("agent_snapshot")),json.read(r.getString("scenario_snapshot")),
                json.read(r.getString("case_snapshots")),json.read(r.getString("execution_limits")),r.getString("status"),r.getBigDecimal("score"),
                json.read(r.getString("token_usage")),r.getBigDecimal("cost_estimate"),r.getBigDecimal("reserved_cost"),
                r.getString("pricing_snapshot")==null ? null : json.read(r.getString("pricing_snapshot")),
                time(r,"created_at"),time(r,"started_at"),time(r,"finished_at"),r.getString("error"),r.getInt("passed_cases"),r.getInt("finished_cases"));
    }
    public RunEntity get(UUID id) {
        return db.query(SELECT+"WHERE id=?",this::map,id).stream().findFirst().orElseThrow(() -> ApiException.missing("Run"));
    }
    public List<RunEntity> list() { return db.query(SELECT+"ORDER BY created_at DESC,id LIMIT 50",this::map); }
    public List<RunEntity> comparison(UUID id) { return db.query(SELECT+"WHERE comparison_id=? ORDER BY comparison_position",this::map,id); }
    public List<JsonNode> results(UUID id) {
        return db.query("""
            SELECT jsonb_build_object('caseId',case_id,'score',score,'passed',passed,'outcome',outcome,
            'metrics',metrics,'violations',violations,'finalState',final_state) AS result
            FROM run_case_results WHERE run_id=? ORDER BY case_id
            """,(r,n) -> json.read(r.getString(1)),id);
    }
    public List<JsonNode> events(UUID id, long after, int limit) {
        return db.query("""
            SELECT jsonb_build_object('eventId',id,'runId',run_id,'caseId',case_id,'sequence',sequence,
            'type',event_type,'timestamp',created_at,'payload',payload) AS event
            FROM run_events WHERE run_id=? AND id>? ORDER BY id LIMIT ?
            """,(r,n) -> json.read(r.getString(1)),id,after,limit);
    }
    public void capacity(int amount, int maximum) {
        db.execute("SELECT pg_advisory_xact_lock(71242002)");
        int count=db.queryForObject("SELECT count(*) FROM runs WHERE status IN ('QUEUED','RUNNING')",Integer.class);
        if (count+amount>maximum) throw new ApiException(org.springframework.http.HttpStatus.TOO_MANY_REQUESTS,"Run queue is full. Wait for active runs to finish.");
    }
    public void retry(UUID original, UUID id) {
        db.update("""
            INSERT INTO runs(id,agent_config_id,scenario_id,agent_snapshot,scenario_snapshot,case_snapshots,execution_limits)
            SELECT ?,agent_config_id,scenario_id,agent_snapshot,scenario_snapshot,case_snapshots,execution_limits
            FROM runs WHERE id=?
            """,id,original);
    }
    public void insert(UUID id, RunRequest request, UUID comparison, Integer comparisonPosition, Object agent, Object scenario, Object cases) {
        db.update("""
            INSERT INTO runs(id,agent_config_id,scenario_id,comparison_id,comparison_position,agent_snapshot,scenario_snapshot,case_snapshots,execution_limits)
            VALUES (?,?,?,?,?,?::jsonb,?::jsonb,?::jsonb,?::jsonb)
            """,id,request.agentConfigId(),request.scenarioId(),comparison,comparisonPosition,json.write(agent),json.write(scenario),json.write(cases),json.write(request.executionLimits()));
    }
}
