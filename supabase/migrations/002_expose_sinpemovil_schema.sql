GRANT USAGE ON SCHEMA sinpemovil TO anon, authenticated, service_role;

GRANT ALL ON ALL TABLES IN SCHEMA sinpemovil TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA sinpemovil TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA sinpemovil TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA sinpemovil
  GRANT ALL ON TABLES TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA sinpemovil
  GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
