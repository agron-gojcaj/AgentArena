package com.agentarena.common;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.net.URI;
import java.util.Set;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/** Local-only MVP: block DNS rebinding and cross-origin browser writes. */
@Component
public class LocalRequestFilter extends OncePerRequestFilter {
    private static final Set<String> HOSTS = Set.of("localhost", "127.0.0.1", "[::1]", "::1", "backend");
    @Override protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
            throws ServletException, IOException {
        String origin = req.getHeader("Origin");
        boolean validOrigin = true;
        if (origin != null) {
            try { validOrigin = URI.create(origin).getAuthority().equalsIgnoreCase(req.getHeader("Host")); }
            catch (RuntimeException e) { validOrigin = false; }
        }
        if (!HOSTS.contains(req.getServerName()) || !validOrigin) {
            res.sendError(403, "Local, same-origin requests only");
            return;
        }
        res.setHeader("X-Content-Type-Options", "nosniff");
        res.setHeader("Cache-Control", "no-store");
        chain.doFilter(req, res);
    }
}
