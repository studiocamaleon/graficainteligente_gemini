DROP FUNCTION IF EXISTS public.send_chat_message(uuid, text);

CREATE FUNCTION public.send_chat_message(p_conversation_id uuid, p_body text)
RETURNS public.chat_messages
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile public.profiles;
  v_conversation public.chat_conversations;
  v_message public.chat_messages;
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

GRANT EXECUTE ON FUNCTION public.send_chat_message(uuid, text) TO authenticated;
