package com.sitetrack;

import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;
import org.springframework.boot.SpringApplication;

import java.nio.file.Files;

/** Local end-to-end helper (test classpath only, never shipped): the real app on a throwaway embedded PostgreSQL. */
public class DevServer {
    public static void main(String[] args) throws Exception {
        EmbeddedPostgres pg = EmbeddedPostgres.builder().start();
        System.setProperty("spring.datasource.url", pg.getJdbcUrl("postgres", "postgres"));
        System.setProperty("spring.datasource.username", "postgres");
        System.setProperty("spring.datasource.password", "postgres");
        System.setProperty("app.upload-dir", Files.createTempDirectory("e2e-uploads").toString());
        System.setProperty("app.admin.mobile", "9000000009");
        System.setProperty("app.admin.password", "SiteTrack123!");
        SpringApplication.run(com.sitetrack.SiteTrackApplication.class, args);
    }
}
