CREATE OR REPLACE FUNCTION public.list_chat_conversations()
RETURNS TABLE (
  conversation_id uuid,
  company_id uuid,
  type text,
  title text,
  other_profile_id uuid,
  other_profile_name text,
  other_profile_email text,
  other_profile_avatar_url text,
  last_message_id uuid,
  last_message_body text,
  last_message_created_at timestamptz,
  last_message_sender_id uuid,
  unread_count bigint,
  created_at timestamptz,
  updated_at timestamptz,
  last_message_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile public.profiles;
BEGIN
  v_profile := public.chat_current_profile();

  PERFORM public.ensure_general_chat();

  RETURN QUERY
  WITH mine AS (
    SELECT cp.conversation_id
    FROM public.chat_conversation_participants cp
    WHERE cp.profile_id = v_profile.id
  ),
  base AS (
    SELECT c.*
    FROM public.chat_conversations c
    JOIN mine m ON m.conversation_id = c.id
    WHERE c.company_id = v_profile.company_id
      AND c.is_active = true
  ),
  other_participant AS (
    SELECT DISTINCT ON (cp.conversation_id)
      cp.conversation_id,
      p.id AS other_profile_id,
      p.full_name AS other_profile_name,
      p.email AS other_profile_email,
      p.avatar_url AS other_profile_avatar_url
    FROM public.chat_conversation_participants cp
    JOIN public.profiles p ON p.id = cp.profile_id
    JOIN base b ON b.id = cp.conversation_id
    WHERE cp.profile_id <> v_profile.id
      AND b.type = 'direct'
    ORDER BY cp.conversation_id, p.full_name NULLS LAST, p.email
  ),
  unread AS (
    SELECT
      m.conversation_id,
      COUNT(*)::bigint AS unread_count
    FROM public.chat_messages m
    WHERE m.company_id = v_profile.company_id
      AND m.sender_profile_id <> v_profile.id
      AND EXISTS (
        SELECT 1
        FROM base b
        WHERE b.id = m.conversation_id
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.chat_message_reads r
        WHERE r.message_id = m.id
          AND r.reader_profile_id = v_profile.id
      )
    GROUP BY m.conversation_id
  )
  SELECT
    b.id AS conversation_id,
    b.company_id,
    b.type,
    CASE
      WHEN b.type = 'general' THEN COALESCE(b.title, 'General')
      ELSE COALESCE(op.other_profile_name, op.other_profile_email, 'Conversación')
    END AS title,
    op.other_profile_id,
    op.other_profile_name,
    op.other_profile_email,
    op.other_profile_avatar_url,
    lm.id AS last_message_id,
    lm.body AS last_message_body,
    lm.created_at AS last_message_created_at,
    lm.sender_profile_id AS last_message_sender_id,
    COALESCE(u.unread_count, 0) AS unread_count,
    b.created_at,
    b.updated_at,
    b.last_message_at
  FROM base b
  LEFT JOIN public.chat_messages lm ON lm.id = b.last_message_id
  LEFT JOIN other_participant op ON op.conversation_id = b.id
  LEFT JOIN unread u ON u.conversation_id = b.id
  ORDER BY COALESCE(b.last_message_at, b.created_at) DESC;
END;
$$;
