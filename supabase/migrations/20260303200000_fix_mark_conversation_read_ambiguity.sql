DROP FUNCTION IF EXISTS public.mark_conversation_read(uuid, uuid);

CREATE OR REPLACE FUNCTION public.mark_conversation_read(
  p_conversation_id uuid,
  p_through_message_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile public.profiles;
  v_conversation public.chat_conversations;
  v_target_message public.chat_messages;
BEGIN
  v_profile := public.chat_current_profile();

  SELECT *
  INTO v_conversation
  FROM public.chat_conversations c
  WHERE c.id = p_conversation_id
    AND c.is_active = true
  LIMIT 1;

  IF v_conversation.id IS NULL OR v_conversation.company_id <> v_profile.company_id THEN
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

  IF p_through_message_id IS NOT NULL THEN
    SELECT *
    INTO v_target_message
    FROM public.chat_messages m
    WHERE m.id = p_through_message_id
      AND m.conversation_id = v_conversation.id
    LIMIT 1;
  ELSE
    SELECT *
    INTO v_target_message
    FROM public.chat_messages m
    WHERE m.conversation_id = v_conversation.id
    ORDER BY m.created_at DESC
    LIMIT 1;
  END IF;

  IF v_target_message.id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.chat_message_reads (
    message_id,
    conversation_id,
    company_id,
    reader_profile_id,
    read_at
  )
  SELECT
    m.id,
    m.conversation_id,
    m.company_id,
    v_profile.id,
    now()
  FROM public.chat_messages m
  WHERE m.conversation_id = v_conversation.id
    AND m.created_at <= v_target_message.created_at
  ON CONFLICT (message_id, reader_profile_id) DO NOTHING;

  UPDATE public.chat_conversation_participants cp
  SET
    last_read_message_id = v_target_message.id,
    last_read_at = now(),
    last_delivered_at = now(),
    updated_at = now()
  WHERE cp.conversation_id = v_conversation.id
    AND cp.profile_id = v_profile.id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_conversation_read(uuid, uuid) TO authenticated;
