CREATE TABLE IF NOT EXISTS public.chat_message_references (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  reference_type text NOT NULL CHECK (reference_type IN ('orden_trabajo', 'orden_copiado')),
  entity_id uuid NOT NULL,
  entity_label text NOT NULL,
  entity_status text,
  client_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chat_message_references_unique UNIQUE (message_id, reference_type, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_chat_message_references_message
  ON public.chat_message_references(message_id);

CREATE INDEX IF NOT EXISTS idx_chat_message_references_conversation
  ON public.chat_message_references(conversation_id, created_at DESC);

ALTER TABLE public.chat_message_references ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view chat message references from their conversations" ON public.chat_message_references;
CREATE POLICY "Users can view chat message references from their conversations"
  ON public.chat_message_references
  FOR SELECT
  TO authenticated
  USING (
    public.chat_user_company_id() = company_id
    AND public.chat_user_is_participant(conversation_id, company_id)
  );

ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_message_references;

DROP FUNCTION IF EXISTS public.send_chat_message(uuid, text);
DROP FUNCTION IF EXISTS public.send_chat_message(uuid, text, jsonb);

CREATE FUNCTION public.send_chat_message(
  p_conversation_id uuid,
  p_body text,
  p_references jsonb DEFAULT '[]'::jsonb
)
RETURNS public.chat_messages
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile public.profiles;
  v_conversation public.chat_conversations;
  v_message public.chat_messages;
  v_reference jsonb;
  v_reference_type text;
  v_entity_id uuid;
  v_entity_label text;
  v_entity_status text;
  v_client_name text;
  v_ot public.ordenes_trabajo;
  v_cc public.centro_copiado_ordenes;
BEGIN
  v_profile := public.chat_current_profile();

  SELECT *
  INTO v_conversation
  FROM public.chat_conversations c
  WHERE c.id = p_conversation_id
    AND c.is_active = true
  LIMIT 1;

  IF v_conversation.id IS NULL THEN
    RAISE EXCEPTION 'La conversación no existe';
  END IF;

  IF v_conversation.company_id <> v_profile.company_id THEN
    RAISE EXCEPTION 'No tienes acceso a esta conversación';
  END IF;

  IF v_conversation.type = 'general' THEN
    PERFORM public.chat_sync_general_conversation_participants(v_conversation.id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.chat_conversation_participants cp
    WHERE cp.conversation_id = v_conversation.id
      AND cp.profile_id = v_profile.id
  ) THEN
    RAISE EXCEPTION 'No participas de esta conversación';
  END IF;

  IF char_length(btrim(p_body)) = 0 THEN
    RAISE EXCEPTION 'El mensaje no puede estar vacío';
  END IF;

  IF p_references IS NOT NULL AND jsonb_typeof(p_references) <> 'array' THEN
    RAISE EXCEPTION 'Las referencias deben enviarse como un array JSON';
  END IF;

  INSERT INTO public.chat_messages (
    conversation_id,
    company_id,
    sender_profile_id,
    body
  )
  VALUES (
    v_conversation.id,
    v_conversation.company_id,
    v_profile.id,
    btrim(p_body)
  )
  RETURNING *
  INTO v_message;

  IF COALESCE(jsonb_array_length(p_references), 0) > 0 THEN
    FOR v_reference IN
      SELECT jsonb_array_elements(p_references)
    LOOP
      v_reference_type := NULLIF(v_reference->>'reference_type', '');
      v_entity_id := NULLIF(v_reference->>'entity_id', '')::uuid;
      v_entity_label := NULLIF(v_reference->>'entity_label', '');
      v_entity_status := NULLIF(v_reference->>'entity_status', '');
      v_client_name := NULLIF(v_reference->>'client_name', '');

      IF v_reference_type IS NULL OR v_entity_id IS NULL OR v_entity_label IS NULL THEN
        RAISE EXCEPTION 'Cada referencia debe incluir reference_type, entity_id y entity_label';
      END IF;

      IF v_reference_type = 'orden_trabajo' THEN
        SELECT *
        INTO v_ot
        FROM public.ordenes_trabajo ot
        WHERE ot.id = v_entity_id
          AND ot.company_id = v_profile.company_id
        LIMIT 1;

        IF v_ot.id IS NULL THEN
          RAISE EXCEPTION 'La orden de trabajo referenciada no existe o no pertenece al tenant';
        END IF;
      ELSIF v_reference_type = 'orden_copiado' THEN
        SELECT *
        INTO v_cc
        FROM public.centro_copiado_ordenes cc
        WHERE cc.id = v_entity_id
          AND cc.company_id = v_profile.company_id
        LIMIT 1;

        IF v_cc.id IS NULL THEN
          RAISE EXCEPTION 'La orden de copiado referenciada no existe o no pertenece al tenant';
        END IF;
      ELSE
        RAISE EXCEPTION 'Tipo de referencia inválido: %', v_reference_type;
      END IF;

      INSERT INTO public.chat_message_references (
        message_id,
        conversation_id,
        company_id,
        reference_type,
        entity_id,
        entity_label,
        entity_status,
        client_name
      )
      VALUES (
        v_message.id,
        v_message.conversation_id,
        v_message.company_id,
        v_reference_type,
        v_entity_id,
        v_entity_label,
        v_entity_status,
        v_client_name
      )
      ON CONFLICT (message_id, reference_type, entity_id) DO NOTHING;
    END LOOP;
  END IF;

  UPDATE public.chat_conversation_participants cp
  SET
    last_read_message_id = v_message.id,
    last_read_at = v_message.created_at,
    last_delivered_at = v_message.created_at,
    updated_at = now()
  WHERE cp.conversation_id = v_conversation.id
    AND cp.profile_id = v_profile.id;

  RETURN v_message;
END;
$$;

GRANT EXECUTE ON FUNCTION public.send_chat_message(uuid, text, jsonb) TO authenticated;
