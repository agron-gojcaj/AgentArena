package com.agentarena.streaming;

import com.agentarena.common.ApiException;
import com.agentarena.run.RunRepository;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@RestController
public class EventController {
    private static class Subscriber {
        final UUID runId;
        final SseEmitter emitter=new SseEmitter(300_000L);
        volatile long after;
        int idle=0;
        Subscriber(UUID runId,long after) { this.runId=runId; this.after=after; }
    }
    private final RunRepository runs;
    private final Map<UUID,Subscriber> subscribers=new ConcurrentHashMap<>();
    public EventController(RunRepository runs) { this.runs=runs; }
    @GetMapping(value="/api/runs/{id}/events",produces=MediaType.TEXT_EVENT_STREAM_VALUE)
    SseEmitter events(@PathVariable UUID id, @RequestHeader(value="Last-Event-ID",required=false) String last,
                      @RequestParam(defaultValue="0") long after) {
        runs.get(id);
        if(last!=null) {
            try { after=Long.parseLong(last); } catch(NumberFormatException e) { throw ApiException.invalid("Invalid event cursor"); }
        }
        if(after<0) throw ApiException.invalid("Invalid event cursor");
        if(subscribers.size()>=128) throw new ApiException(HttpStatus.TOO_MANY_REQUESTS,"Too many streams");
        UUID key=UUID.randomUUID();
        Subscriber subscriber=new Subscriber(id,after);
        subscriber.emitter.onCompletion(() -> subscribers.remove(key));
        subscriber.emitter.onTimeout(() -> subscribers.remove(key));
        subscriber.emitter.onError(e -> subscribers.remove(key));
        subscribers.put(key,subscriber);
        return subscriber.emitter;
    }
    @Scheduled(fixedDelay=250)
    public void pump() {
        subscribers.forEach((key, subscriber) -> {
            try {
                // Read terminal status BEFORE events: never close across a final-event commit race.
                String status=runs.get(subscriber.runId).status();
                var events=runs.events(subscriber.runId,subscriber.after,200);
                for(var event:events) {
                    long eventId=event.get("eventId").asLong();
                    subscriber.emitter.send(SseEmitter.event().id(Long.toString(eventId)).name("arena").data(event));
                    subscriber.after=eventId;
                }
                if((status.equals("COMPLETED") || status.equals("FAILED")) && events.size()<200) {
                    subscriber.emitter.send(SseEmitter.event().name("end").data(Map.of("status",status)));
                    subscriber.emitter.complete();
                    subscribers.remove(key);
                } else if(++subscriber.idle%40==0) {
                    subscriber.emitter.send(SseEmitter.event().comment("heartbeat"));
                }
            } catch(Exception e) {
                subscribers.remove(key);
                subscriber.emitter.completeWithError(e);
            }
        });
    }
}
