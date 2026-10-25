package sarangit.semin5.extension;

import java.util.List;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/extensions")
public class ExtensionController {
    private final JdbcTemplate jdbcTemplate;

    public ExtensionController(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @GetMapping
    public List<ExtensionEntry> list() {
        return jdbcTemplate.query("""
                SELECT building, extension_number, floor, department, remarks, did_dod
                FROM extensions
                ORDER BY
                  CASE building
                    WHEN '1동[본관]' THEN 1 WHEN '2동[신관]' THEN 2 WHEN '3동[선경]' THEN 3
                    WHEN '5동[경동]' THEN 4 WHEN '6동[성포]' THEN 5 WHEN '0' THEN 6 ELSE 7
                  END,
                  CASE
                    WHEN floor ~ '^[0-9]+$' THEN CAST(floor AS INTEGER)
                    WHEN UPPER(floor) LIKE 'B%' THEN -CAST(SUBSTRING(floor, 2) AS INTEGER)
                    ELSE 999
                  END,
                  extension_number
                """, (rs, rowNum) -> new ExtensionEntry(
                rs.getString("building"),
                rs.getString("extension_number"),
                rs.getString("floor"),
                rs.getString("department"),
                rs.getString("remarks"),
                rs.getString("did_dod")
        ));
    }
}
