package com.agentarena;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.containers.PostgreSQLContainer;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
class ApiIntegrationTest {
    static final PostgreSQLContainer<?> postgres;
    static {
        // Docker 29 requires API >= 1.44; usable with older supported daemons too.
        System.setProperty("api.version","1.44");
        postgres=new PostgreSQLContainer<>("postgres:17-alpine");
        postgres.start();
    }
    @DynamicPropertySource static void properties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url",postgres::getJdbcUrl);
        registry.add("spring.datasource.username",postgres::getUsername);
        registry.add("spring.datasource.password",postgres::getPassword);
        registry.add("arena.scenarios-path",() -> "../scenarios");
        registry.add("arena.max-queued-runs",() -> "4");
    }
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired JdbcTemplate db;
    @BeforeEach void reset() { db.execute("TRUNCATE run_events,run_case_results,runs,agent_configs CASCADE"); }
    JsonNode postJson(String path,Object body,int status) throws Exception {
        return json.readTree(mvc.perform(post(path).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsBytes(body)))
                .andExpect(status().is(status)).andReturn().getResponse().getContentAsString());
    }
    JsonNode agent() throws Exception {
        return postJson("/api/agents",Map.of("name","Support","model","fake-safe","systemPrompt","Follow policy."),201);
    }
    JsonNode queue(String id) throws Exception {
        return postJson("/api/runs",Map.of("agentConfigId",id,"scenarioId","refund-rescue"),202);
    }
    @Test void scenariosContainFiveCasesAndFourTools() throws Exception {
        mvc.perform(get("/api/scenarios/refund-rescue")).andExpect(status().isOk())
                .andExpect(jsonPath("$.cases.length()").value(5)).andExpect(jsonPath("$.tools.length()").value(4));
    }
    @Test void versionsAndQueuedSnapshotsRemainImmutable() throws Exception {
        var first=agent();
        var run=queue(first.get("id").asText());
        var second=postJson("/api/agents/"+first.get("id").asText()+"/versions",
                Map.of("name","Support","model","fake-safe","systemPrompt","New policy instructions."),201);
        assertThat(second.get("version").asInt()).isEqualTo(2);
        assertThat(second.get("familyId")).isEqualTo(first.get("familyId"));
        mvc.perform(get("/api/runs/"+run.get("runId").asText())).andExpect(status().isOk())
                .andExpect(jsonPath("$.run.agentSnapshot.systemPrompt").value("Follow policy."))
                .andExpect(jsonPath("$.run.caseSnapshots.length()").value(5));
    }
    @Test void selectedCasesAndLimitsAreValidated() throws Exception {
        var id=agent().get("id").asText();
        postJson("/api/runs",Map.of("agentConfigId",id,"scenarioId","refund-rescue","testCaseIds",List.of()),400);
        postJson("/api/runs",Map.of("agentConfigId",id,"scenarioId","refund-rescue","testCaseIds",List.of("refund-001","refund-001")),400);
        postJson("/api/runs",Map.of("agentConfigId",id,"scenarioId","refund-rescue","testCaseIds",List.of("foreign")),400);
        postJson("/api/runs",Map.of("agentConfigId",id,"scenarioId","refund-rescue","executionLimits",Map.of("maxModelTurns",100)),400);
        var result=postJson("/api/runs",Map.of("agentConfigId",id,"scenarioId","refund-rescue","testCaseIds",List.of("refund-002")),202);
        mvc.perform(get("/api/runs/"+result.get("runId").asText())).andExpect(jsonPath("$.run.caseSnapshots.length()").value(1))
                .andExpect(jsonPath("$.run.executionLimits.maxModelTurns").value(8));
    }
    @Test void comparisonUsesIdenticalFixturesAndIsAtomic() throws Exception {
        var a=agent().get("id").asText(); var b=agent().get("id").asText();
        var comparison=postJson("/api/comparisons",Map.of("agentConfigIds",List.of(a,b),"scenarioId","refund-rescue"),202);
        var body=mvc.perform(get("/api/comparisons/"+comparison.get("comparisonId").asText())).andExpect(status().isOk()).andReturn();
        var runs=json.readTree(body.getResponse().getContentAsString()).get("runs");
        assertThat(runs.get(0).get("run").get("agentConfigId").asText()).isEqualTo(a);
        assertThat(runs.get(1).get("run").get("agentConfigId").asText()).isEqualTo(b);
        assertThat(runs.get(0).get("run").get("caseSnapshots")).isEqualTo(runs.get(1).get("run").get("caseSnapshots"));
        postJson("/api/comparisons",Map.of("agentConfigIds",List.of(a,UUID.randomUUID().toString()),"scenarioId","refund-rescue"),404);
        assertThat(db.queryForObject("SELECT count(*) FROM runs",Integer.class)).isEqualTo(2);
    }
    @Test void queueCapacityIsEnforced() throws Exception {
        var id=agent().get("id").asText();
        for(int i=0;i<4;i++) queue(id);
        postJson("/api/runs",Map.of("agentConfigId",id,"scenarioId","refund-rescue"),429);
    }
    @Test void missingResourcesAndMalformedIdsHaveUsefulStatus() throws Exception {
        mvc.perform(get("/api/runs/"+UUID.randomUUID())).andExpect(status().isNotFound());
        mvc.perform(get("/api/runs/not-a-uuid")).andExpect(status().isBadRequest());
        mvc.perform(get("/api/scenarios/missing")).andExpect(status().isNotFound());
    }
    @Test void promptsAndModelsAreValidated() throws Exception {
        postJson("/api/agents",Map.of("name"," ","model","fake-safe","systemPrompt","x"),400);
        postJson("/api/agents",Map.of("name","x","model","arbitrary-model","systemPrompt","x"),400);
        postJson("/api/agents",Map.of("name","x","model","fake-safe","systemPrompt","x","apiKey","not-a-real-key"),400);
    }
    @Test void crossOriginRequestsAreRejected() throws Exception {
        mvc.perform(post("/api/agents").header("Origin","https://untrusted.example").contentType(MediaType.APPLICATION_JSON)
                .content("{}")).andExpect(status().isForbidden());
        mvc.perform(get("/api/agents").with(req -> { req.setServerName("evil.example"); return req; })).andExpect(status().isForbidden());
    }
    @Test void manualRetryCopiesOriginalSnapshotsAndRejectsActiveRuns() throws Exception {
        UUID original=UUID.fromString(queue(agent().get("id").asText()).get("runId").asText());
        postJson("/api/runs/"+original+"/retry",Map.of(),409);
        db.update("UPDATE runs SET status='FAILED',scenario_snapshot=jsonb_set(scenario_snapshot,'{version}','77') WHERE id=?",original);
        var retry=postJson("/api/runs/"+original+"/retry",Map.of(),202);
        mvc.perform(get("/api/runs/"+retry.get("runId").asText())).andExpect(status().isOk())
                .andExpect(jsonPath("$.run.scenarioSnapshot.version").value(77))
                .andExpect(jsonPath("$.run.status").value("QUEUED"));
    }
    @Test void sseReplaysOnlyEventsAfterCursorAndTerminates() throws Exception {
        UUID run=UUID.fromString(queue(agent().get("id").asText()).get("runId").asText());
        Long first=db.queryForObject("INSERT INTO run_events(run_id,sequence,event_type,payload) VALUES (?,1,'RUN_STARTED','{}') RETURNING id",Long.class,run);
        db.update("INSERT INTO run_events(run_id,sequence,event_type,payload) VALUES (?,2,'RUN_COMPLETED','{}')",run);
        db.update("UPDATE runs SET status='COMPLETED' WHERE id=?",run);
        var result=mvc.perform(get("/api/runs/"+run+"/events").header("Last-Event-ID",first.toString())).andExpect(request().asyncStarted()).andReturn();
        result.getAsyncResult(5000);
        String stream=mvc.perform(asyncDispatch(result)).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        assertThat(stream).contains("RUN_COMPLETED","event:end").doesNotContain("RUN_STARTED");
        mvc.perform(get("/api/runs/"+run+"/events").header("Last-Event-ID","bogus")).andExpect(status().isBadRequest());
    }
}
