package com.agentarena.common;

import org.springframework.http.HttpStatus;

public class ApiException extends RuntimeException {
    public final HttpStatus status;
    public ApiException(HttpStatus status, String message) { super(message); this.status = status; }
    public static ApiException missing(String kind) { return new ApiException(HttpStatus.NOT_FOUND, kind + " not found"); }
    public static ApiException invalid(String message) { return new ApiException(HttpStatus.BAD_REQUEST, message); }
}
