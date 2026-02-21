-- Fix: recibos_pagos currently uses ON DELETE SET NULL for pago refs,
-- but chk_recibo_pago_ref requires at least one pago ref not null.
-- Deleting a pago can violate that check.
-- Solution: use ON DELETE CASCADE so deleting a pago removes its recibo link row.

ALTER TABLE public.recibos_pagos
  DROP CONSTRAINT IF EXISTS recibos_pagos_pago_ot_id_fkey,
  DROP CONSTRAINT IF EXISTS fk_recibos_pagos_pago_ot_id;

ALTER TABLE public.recibos_pagos
  ADD CONSTRAINT fk_recibos_pagos_pago_ot_id
  FOREIGN KEY (pago_ot_id)
  REFERENCES public.ordenes_trabajo_pagos(id)
  ON DELETE CASCADE;

ALTER TABLE public.recibos_pagos
  DROP CONSTRAINT IF EXISTS recibos_pagos_pago_copiado_id_fkey,
  DROP CONSTRAINT IF EXISTS fk_recibos_pagos_pago_copiado_id;

ALTER TABLE public.recibos_pagos
  ADD CONSTRAINT fk_recibos_pagos_pago_copiado_id
  FOREIGN KEY (pago_copiado_id)
  REFERENCES public.centro_copiado_ordenes_pagos(id)
  ON DELETE CASCADE;
