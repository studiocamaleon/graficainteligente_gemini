BEGIN;

INSERT INTO public.role_permissions (role_id, module_id, can_view, can_create, can_edit, can_delete)
SELECT
  cr.id,
  'documentation',
  true,
  false,
  false,
  false
FROM public.custom_roles cr
ON CONFLICT (role_id, module_id)
DO UPDATE SET
  can_view = EXCLUDED.can_view,
  can_create = false,
  can_edit = false,
  can_delete = false;

COMMIT;
