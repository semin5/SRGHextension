-- One-time replacement from 사랑의병원 내선번호 일람 (1).xlsx.
-- Run with psql -v ON_ERROR_STOP=1 on the PostgreSQL 5432 primary only.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

CREATE TEMP TABLE extension_import (
    id bigint PRIMARY KEY,
    building varchar(20) NOT NULL,
    extension_number varchar(50),
    floor varchar(50),
    department varchar(100),
    remarks varchar(255),
    did_dod varchar(100)
) ON COMMIT DROP;

COPY extension_import (id, building, extension_number, floor, department, remarks, did_dod)
    FROM '/var/lib/postgresql/extensions_import_20261020.csv'
    WITH (FORMAT csv, HEADER true, ENCODING 'UTF8');

DO $$
BEGIN
    IF (SELECT count(*) FROM extension_import) <> 343
       OR (SELECT min(id) FROM extension_import) <> 1
       OR (SELECT max(id) FROM extension_import) <> 343
       OR (SELECT count(*) FROM extension_import WHERE building = '0') <> 7
       OR (SELECT count(*) FROM extension_import WHERE extension_number IS NULL) <> 1 THEN
        RAISE EXCEPTION 'The staged extension data failed validation';
    END IF;
END $$;

LOCK TABLE public.extensions IN ACCESS EXCLUSIVE MODE;
DO $$
BEGIN
    IF pg_is_in_recovery() OR (SELECT count(*) FROM public.extensions) <> 343
       OR (SELECT count(*) FROM public.extension_edit_audit) <> 0 THEN
        RAISE EXCEPTION 'The extension database changed or is not primary';
    END IF;
END $$;

TRUNCATE public.extensions RESTART IDENTITY;
INSERT INTO public.extensions (id, building, extension_number, floor, department, remarks, did_dod)
    SELECT id, building, extension_number, floor, department, remarks, did_dod
    FROM extension_import ORDER BY id;
SELECT setval(pg_get_serial_sequence('public.extensions', 'id'), 343, true);

DO $$
BEGIN
    IF EXISTS (
        (SELECT id, building, extension_number, floor, department, remarks, did_dod FROM public.extensions
         EXCEPT ALL
         SELECT id, building, extension_number, floor, department, remarks, did_dod FROM extension_import)
        UNION ALL
        (SELECT id, building, extension_number, floor, department, remarks, did_dod FROM extension_import
         EXCEPT ALL
         SELECT id, building, extension_number, floor, department, remarks, did_dod FROM public.extensions)
    ) THEN
        RAISE EXCEPTION 'The replacement did not match the staged extension data';
    END IF;
END $$;
COMMIT;
