ALTER TABLE runs ADD COLUMN comparison_position SMALLINT;
-- Preserve a stable order for any pre-upgrade comparisons.
WITH ordered AS (
    SELECT id, row_number() OVER (PARTITION BY comparison_id ORDER BY created_at,id)-1 AS position
    FROM runs WHERE comparison_id IS NOT NULL
)
UPDATE runs SET comparison_position=ordered.position FROM ordered WHERE runs.id=ordered.id;
ALTER TABLE runs ADD CONSTRAINT comparison_position_valid CHECK (
    (comparison_id IS NULL AND comparison_position IS NULL) OR
    (comparison_id IS NOT NULL AND comparison_position IN (0,1))
);
CREATE UNIQUE INDEX runs_comparison_position_idx ON runs(comparison_id,comparison_position);
