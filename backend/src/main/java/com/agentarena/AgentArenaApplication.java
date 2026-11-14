package com.agentarena;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class AgentArenaApplication {
    public static void main(String[] args) { SpringApplication.run(AgentArenaApplication.class, args); }
}
