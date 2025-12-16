-- Migration: Secure Public Budget Approval/Rejection RPCs
-- Description: Adds RPC functions to handle budget state transitions securely from public views, avoiding direct table update permissions issues.

-- 1. Function to Approve Budget
CREATE OR REPLACE FUNCTION fn_aprobar_presupuesto_public(
  p_tracking_token text,
  p_observaciones text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with privileges of the creator (bypass RLS for this specific action)
AS $$
DECLARE
  v_presupuesto_id uuid;
  v_current_state text;
BEGIN
  -- 1. Find the budget by token
  SELECT id, estado INTO v_presupuesto_id, v_current_state
  FROM presupuestos
  WHERE tracking_token = p_tracking_token;

  IF v_presupuesto_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Presupuesto no encontrado');
  END IF;

  -- 2. Validate state (optional but recommended)
  IF v_current_state NOT IN ('enviado', 'vencido', 'pendiente') THEN -- Allow approval even if expired? Usually yes, or negotiation. Assuming 'enviado' is the main one.
     -- Let's be permissive but safe. If it's already approved, just return success.
     IF v_current_state = 'aprobado' THEN
        RETURN jsonb_build_object('success', true, 'message', 'El presupuesto ya estaba aprobado');
     END IF;
  END IF;

  -- 3. Update the budget
  UPDATE presupuestos
  SET 
    estado = 'aprobado',
    fecha_respuesta = now(),
    observaciones_cliente = p_observaciones,
    updated_at = now()
  WHERE id = v_presupuesto_id;

  -- 4. Log validation (Implicit via return)
  RETURN jsonb_build_object('success', true, 'message', 'Presupuesto aprobado correctamente');

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;

-- Grant execution to public/anon if necessary, or at least authenticated (which public view usually acts as anon if not logged in, but Supabase client might be anon)
GRANT EXECUTE ON FUNCTION fn_aprobar_presupuesto_public TO anon, authenticated, service_role;


-- 2. Function to Reject Budget
CREATE OR REPLACE FUNCTION fn_rechazar_presupuesto_public(
  p_tracking_token text,
  p_motivo text,
  p_observaciones text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_presupuesto_id uuid;
  v_observaciones_final text;
BEGIN
  -- 1. Find the budget
  SELECT id INTO v_presupuesto_id
  FROM presupuestos
  WHERE tracking_token = p_tracking_token;

  IF v_presupuesto_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Presupuesto no encontrado');
  END IF;

  -- 2. Format observations
  IF p_observaciones IS NOT NULL AND p_observaciones != '' THEN
    v_observaciones_final := 'MOTIVO: ' || p_motivo || E'\n\n' || p_observaciones;
  ELSE
    v_observaciones_final := 'MOTIVO: ' || p_motivo;
  END IF;

  -- 3. Update
  UPDATE presupuestos
  SET 
    estado = 'rechazado',
    fecha_respuesta = now(),
    observaciones_cliente = v_observaciones_final,
    updated_at = now()
  WHERE id = v_presupuesto_id;

  RETURN jsonb_build_object('success', true, 'message', 'Presupuesto rechazado correctamente');

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION fn_rechazar_presupuesto_public TO anon, authenticated, service_role;
