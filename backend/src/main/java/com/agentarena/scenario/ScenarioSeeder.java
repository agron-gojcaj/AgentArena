package com.agentarena.scenario;

import com.agentarena.common.Json;
import com.fasterxml.jackson.databind.JsonNode;
import java.nio.file.Files;
import java.nio.file.Path;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
public class ScenarioSeeder implements ApplicationRunner {
    private final JdbcTemplate db;
    private final Json json;
    private final Path root;
    public ScenarioSeeder(JdbcTemplate db, Json json, @Value("${arena.scenarios-path}") String root) {
        this.db=db; this.json=json; this.root=Path.of(root);
    }
    @Override @Transactional public void run(ApplicationArguments args) throws Exception {
        try (var directories=Files.list(root)) {
            for (Path directory: directories.filter(Files::isDirectory).sorted().toList()) {
                JsonNode s=json.read(Files.readString(directory.resolve("scenario.json")));
                String id=s.get("id").asText();
                db.update("""
                    INSERT INTO scenarios(id,title,description,version,definition) VALUES (?,?,?,?,?::jsonb)
                    ON CONFLICT(id) DO UPDATE SET title=excluded.title,description=excluded.description,
                    version=excluded.version,definition=excluded.definition
                    """,id,s.get("name").asText(),s.get("description").asText(),s.get("version").asInt(),json.write(s));
                db.update("DELETE FROM test_cases WHERE scenario_id=?",id);
                try (var files=Files.list(directory.resolve("cases"))) {
                    for (Path file: files.filter(p -> p.toString().endsWith(".json")).sorted().toList()) {
                        JsonNode c=json.read(Files.readString(file));
                        db.update("INSERT INTO test_cases(id,scenario_id,definition) VALUES (?,?,?::jsonb)",c.get("id").asText(),id,json.write(c));
                    }
                }
            }
        }
    }
}
