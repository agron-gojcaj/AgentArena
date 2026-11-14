package com.agentarena.common;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;

@Component
public class Json {
    private final ObjectMapper mapper;
    public Json(ObjectMapper mapper) { this.mapper = mapper; }
    public String write(Object value) {
        try { return mapper.writeValueAsString(value); }
        catch (Exception e) { throw new IllegalStateException("Cannot serialize data", e); }
    }
    public JsonNode read(String value) {
        try { return mapper.readTree(value); }
        catch (Exception e) { throw new IllegalStateException("Cannot read stored data", e); }
    }
}
