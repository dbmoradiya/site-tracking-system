package com.sitetrack;

import org.springframework.jdbc.core.simple.JdbcClient;

/** Helpers for the sample data and known-password logins that early migrations inserted. */
final class LegacyDemoData {
    static final String KNOWN_HASH = "$2y$10$uM9ZuAcxZbscrfjjpjdSTOkMQ1IWghnyocqL7VAFvoED4V6ceoAPK";

    private LegacyDemoData() {}

    static boolean legacyAdminExists(JdbcClient jdbc) {
        return jdbc.sql("select count(*) from app_users where role='ADMIN' and password_hash=:h")
                .param("h", KNOWN_HASH).query(Long.class).single() > 0;
    }

    /**
     * True only for a database that still holds exactly what the migrations seeded: nothing was
     * created after the last seeding migration (V9), and there is no evidence or review. Used as a
     * second safety check next to the explicit opt-in before any sample data is deleted.
     */
    static boolean looksUntouched(JdbcClient jdbc) {
        Long recent = jdbc.sql("""
            with cutoff as (select (installed_on::timestamptz + interval '10 minutes') as t
                            from flyway_schema_history where version = '9')
            select (select count(*) from projects, cutoff where created_at > cutoff.t)
                 + (select count(*) from sites, cutoff where created_at > cutoff.t)
                 + (select count(*) from employees, cutoff where created_at > cutoff.t)
                 + (select count(*) from teams, cutoff where created_at > cutoff.t)
                 + (select count(*) from site_types, cutoff where created_at > cutoff.t)
                 + (select count(*) from app_users, cutoff where created_at > cutoff.t)
                 + (select count(*) from evidence)
                 + (select count(*) from stage_reviews)
            """).query(Long.class).single();
        return recent != null && recent == 0;
    }

    static void deleteSampleData(JdbcClient jdbc) {
        jdbc.sql("delete from projects").update();       // cascades sites, stages, evidence rows, assignments, history
        jdbc.sql("delete from site_types").update();     // cascades stage templates
        jdbc.sql("delete from teams").update();
        jdbc.sql("delete from app_users").update();
        jdbc.sql("delete from employees").update();      // cascades employee roles
    }
}
