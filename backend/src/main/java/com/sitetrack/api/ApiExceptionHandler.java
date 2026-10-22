package com.sitetrack.api;

import org.springframework.http.ResponseEntity;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.time.Instant;
import java.util.Map;

@RestControllerAdvice
public class ApiExceptionHandler {
    @ExceptionHandler(ApiException.class)
    ResponseEntity<?> handleApi(ApiException ex) {
        return ResponseEntity.status(ex.status()).body(error(ex.getMessage()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<?> handleValidation(MethodArgumentNotValidException ex) {
        String message = ex.getBindingResult().getFieldErrors().stream()
                .findFirst().map(e -> e.getField() + ": " + e.getDefaultMessage())
                .orElse("Request validation failed");
        return ResponseEntity.badRequest().body(error(message));
    }

    @ExceptionHandler(AccessDeniedException.class)
    ResponseEntity<?> handleAccessDenied(AccessDeniedException ex) {
        return ResponseEntity.status(403).body(error("You do not have permission to perform this action"));
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    ResponseEntity<?> handleConflict(DataIntegrityViolationException ex) {
        return ResponseEntity.status(409).body(error("That record conflicts with existing data"));
    }

    @ExceptionHandler(Exception.class)
    ResponseEntity<?> handleUnexpected(Exception ex) {
        return ResponseEntity.internalServerError().body(error("An unexpected error occurred"));
    }

    private Map<String, Object> error(String message) {
        return Map.of("message", message, "timestamp", Instant.now().toString());
    }
}
