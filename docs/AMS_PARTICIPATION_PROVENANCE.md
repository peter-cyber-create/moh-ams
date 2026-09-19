# AMS participation provenance (Wave 4)

Duration **numbers** are unchanged from Wave 3 (inclusive start–end; start year for cross-year; 150-day interpretation unchanged).

Each contribution now has `provenance`:

| Provenance | When |
| --- | --- |
| `DATE_CALCULATED` | Both start and end present, end ≥ start |
| `LEGACY_STORED_DAYS` | No end date; `activity.days` > 0 used |
| `DEFAULTED` | No end date and no stored days; counted as 1 day |
| `NEEDS_REVIEW` | Missing start, or end before start (excluded from totals) |

Cross-year (start year ≠ end year): still counted in the **start** year, with `crossYear: true` / `CROSS_YEAR_REVIEW`. Totals are not split or rewritten.

These labels are visible on Person participation history and on the data-quality view. Historical dates are not auto-corrected.
