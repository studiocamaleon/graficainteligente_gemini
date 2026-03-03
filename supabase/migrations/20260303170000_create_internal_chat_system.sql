-- Internal chat system scoped by tenant/company

CREATE TABLE IF NOT EXISTS public.chat_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('general', 'direct')),
  direct_key text,
  title text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_message_at timestamptz,
  last_message_id uuid,
  is_active boolean NOT NULL DEFAULT true,
  CONSTRAINT chat_conversations_general_direct_key_null CHECK (
    (type = 'general' AND direct_key IS NULL) OR (type = 'direct' AND direct_key IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS public.chat_conversation_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  last_read_message_id uuid,
  last_read_at timestamptz,
  last_delivered_at timestamptz,
  is_muted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chat_conversation_participants_unique UNIQUE (conversation_id, profile_id)
);

CREATE TABLE IF NOT EXISTS public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  sender_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  body text NOT NULL,
  message_type text NOT NULL DEFAULT 'text' CHECK (message_type IN ('text')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz,
  edited_at timestamptz,
  CONSTRAINT chat_messages_body_not_empty CHECK (char_length(btrim(body)) > 0),
  CONSTRAINT chat_messages_body_max_length CHECK (char_length(body) <= 4000)
);

CREATE TABLE IF NOT EXISTS public.chat_message_reads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  reader_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  read_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chat_message_reads_unique UNIQUE (message_id, reader_profile_id)
);

ALTER TABLE public.chat_conversations
  ADD CONSTRAINT chat_conversations_last_message_id_fkey
  FOREIGN KEY (last_message_id) REFERENCES public.chat_messages(id) ON DELETE SET NULL;

ALTER TABLE public.chat_conversation_participants
  ADD CONSTRAINT chat_conversation_participants_last_read_message_id_fkey
  FOREIGN KEY (last_read_message_id) REFERENCES public.chat_messages(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_chat_conversations_company_type
  ON public.chat_conversations(company_id, type);

CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_conversations_general_unique
  ON public.chat_conversations(company_id)
  WHERE type = 'general' AND is_active = true;

CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_conversations_direct_unique
  ON public.chat_conversations(company_id, direct_key)
  WHERE type = 'direct' AND direct_key IS NOT NULL AND is_active = true;

CREATE INDEX IF NOT EXISTS idx_chat_participants_company_profile
  ON public.chat_conversation_participants(company_id, profile_id);

CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation_created_at
  ON public.chat_messages(conversation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_chat_messages_company_created_at
  ON public.chat_messages(company_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_chat_message_reads_reader_read_at
  ON public.chat_message_reads(reader_profile_id, read_at DESC);

CREATE INDEX IF NOT EXISTS idx_chat_message_reads_conversation_reader
  ON public.chat_message_reads(conversation_id, reader_profile_id);

CREATE INDEX IF NOT EXISTS idx_chat_message_reads_message
  ON public.chat_message_reads(message_id);

ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_message_reads ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.chat_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.chat_current_profile()
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile public.profiles;
BEGIN
  SELECT *
  INTO v_profile
  FROM public.profiles
  WHERE id = auth.uid()
  LIMIT 1;

  IF v_profile.id IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado o perfil inexistente';
  END IF;

  RETURN v_profile;
END;
$$;

CREATE OR REPLACE FUNCTION public.chat_sync_general_conversation_participants(p_conversation_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id uuid;
BEGIN
  SELECT company_id
  INTO v_company_id
  FROM public.chat_conversations
  WHERE id = p_conversation_id
    AND type = 'general';

  IF v_company_id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.chat_conversation_participants (
    conversation_id,
    company_id,
    profile_id
  )
  SELECT
    p_conversation_id,
    p.company_id,
    p.id
  FROM public.profiles p
  WHERE p.company_id = v_company_id
    AND COALESCE(p.is_active, true) = true
  ON CONFLICT (conversation_id, profile_id) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.chat_touch_conversation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.chat_conversations
  SET
    last_message_at = NEW.created_at,
    last_message_id = NEW.id,
    updated_at = now()
  WHERE id = NEW.conversation_id;

  INSERT INTO public.chat_message_reads (
    message_id,
    conversation_id,
    company_id,
    reader_profile_id,
    read_at
  )
  VALUES (
    NEW.id,
    NEW.conversation_id,
    NEW.company_id,
    NEW.sender_profile_id,
    NEW.created_at
  )
  ON CONFLICT (message_id, reader_profile_id) DO NOTHING;

  UPDATE public.chat_conversation_participants
  SET
    last_delivered_at = GREATEST(COALESCE(last_delivered_at, NEW.created_at), NEW.created_at),
    updated_at = now()
  WHERE conversation_id = NEW.conversation_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_chat_conversations_updated_at ON public.chat_conversations;
CREATE TRIGGER trigger_chat_conversations_updated_at
  BEFORE UPDATE ON public.chat_conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.chat_set_updated_at();

DROP TRIGGER IF EXISTS trigger_chat_participants_updated_at ON public.chat_conversation_participants;
CREATE TRIGGER trigger_chat_participants_updated_at
  BEFORE UPDATE ON public.chat_conversation_participants
  FOR EACH ROW
  EXECUTE FUNCTION public.chat_set_updated_at();

DROP TRIGGER IF EXISTS trigger_chat_messages_touch_conversation ON public.chat_messages;
CREATE TRIGGER trigger_chat_messages_touch_conversation
  AFTER INSERT ON public.chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.chat_touch_conversation();

CREATE OR REPLACE FUNCTION public.ensure_general_chat()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile public.profiles;
  v_conversation_id uuid;
BEGIN
  v_profile := public.chat_current_profile();

  IF v_profile.company_id IS NULL THEN
    RAISE EXCEPTION 'El usuario no tiene empresa asignada';
  END IF;

  SELECT id
  INTO v_conversation_id
  FROM public.chat_conversations
  WHERE company_id = v_profile.company_id
    AND type = 'general'
    AND is_active = true
  LIMIT 1;

  IF v_conversation_id IS NULL THEN
    INSERT INTO public.chat_conversations (
      company_id,
      type,
      title,
      created_by
    )
    VALUES (
      v_profile.company_id,
      'general',
      'General',
      v_profile.id
    )
    RETURNING id INTO v_conversation_id;
  END IF;

  PERFORM public.chat_sync_general_conversation_participants(v_conversation_id);

  INSERT INTO public.chat_conversation_participants (
    conversation_id,
    company_id,
    profile_id
  )
  VALUES (
    v_conversation_id,
    v_profile.company_id,
    v_profile.id
  )
  ON CONFLICT (conversation_id, profile_id) DO NOTHING;

  RETURN v_conversation_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_direct_chat(other_profile_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile public.profiles;
  v_other_profile public.profiles;
  v_direct_key text;
  v_conversation_id uuid;
BEGIN
  v_profile := public.chat_current_profile();

  IF v_profile.company_id IS NULL THEN
    RAISE EXCEPTION 'El usuario no tiene empresa asignada';
  END IF;

  SELECT *
  INTO v_other_profile
  FROM public.profiles
  WHERE id = other_profile_id
    AND company_id = v_profile.company_id
    AND COALESCE(is_active, true) = true
  LIMIT 1;

  IF v_other_profile.id IS NULL THEN
    RAISE EXCEPTION 'El usuario destino no pertenece a la misma empresa';
  END IF;

  IF v_other_profile.id = v_profile.id THEN
    RAISE EXCEPTION 'No se puede crear un chat directo con el mismo usuario';
  END IF;

  v_direct_key := CASE
    WHEN v_profile.id::text < v_other_profile.id::text
      THEN v_profile.id::text || ':' || v_other_profile.id::text
    ELSE v_other_profile.id::text || ':' || v_profile.id::text
  END;

  SELECT id
  INTO v_conversation_id
  FROM public.chat_conversations
  WHERE company_id = v_profile.company_id
    AND type = 'direct'
    AND direct_key = v_direct_key
    AND is_active = true
  LIMIT 1;

  IF v_conversation_id IS NULL THEN
    INSERT INTO public.chat_conversations (
      company_id,
      type,
      direct_key,
      created_by
    )
    VALUES (
      v_profile.company_id,
      'direct',
      v_direct_key,
      v_profile.id
    )
    RETURNING id INTO v_conversation_id;
  END IF;

  INSERT INTO public.chat_conversation_participants (
    conversation_id,
    company_id,
    profile_id
  )
  VALUES
    (v_conversation_id, v_profile.company_id, v_profile.id),
    (v_conversation_id, v_profile.company_id, v_other_profile.id)
  ON CONFLICT (conversation_id, profile_id) DO NOTHING;

  RETURN v_conversation_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.send_chat_message(conversation_id uuid, body text)
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
  FROM public.chat_conversations
  WHERE id = conversation_id
    AND is_active = true
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
    btrim(body)
  )
  RETURNING *
  INTO v_message;

  UPDATE public.chat_conversation_participants
  SET
    last_read_message_id = v_message.id,
    last_read_at = v_message.created_at,
    last_delivered_at = v_message.created_at,
    updated_at = now()
  WHERE conversation_id = v_conversation.id
    AND profile_id = v_profile.id;

  RETURN v_message;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_conversation_read(conversation_id uuid, through_message_id uuid DEFAULT NULL)
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
  FROM public.chat_conversations
  WHERE id = conversation_id
    AND is_active = true
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

  IF through_message_id IS NOT NULL THEN
    SELECT *
    INTO v_target_message
    FROM public.chat_messages
    WHERE id = through_message_id
      AND conversation_id = v_conversation.id
    LIMIT 1;
  ELSE
    SELECT *
    INTO v_target_message
    FROM public.chat_messages
    WHERE conversation_id = v_conversation.id
    ORDER BY created_at DESC
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

  UPDATE public.chat_conversation_participants
  SET
    last_read_message_id = v_target_message.id,
    last_read_at = now(),
    last_delivered_at = now(),
    updated_at = now()
  WHERE conversation_id = v_conversation.id
    AND profile_id = v_profile.id;
END;
$$;

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
    SELECT
      cp.conversation_id,
      p.id AS other_profile_id,
      p.full_name AS other_profile_name,
      p.email AS other_profile_email,
      p.avatar_url AS other_profile_avatar_url
    FROM public.chat_conversation_participants cp
    JOIN public.profiles p ON p.id = cp.profile_id
    WHERE cp.profile_id <> v_profile.id
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

DROP POLICY IF EXISTS "Users can view chat conversations they participate in" ON public.chat_conversations;
CREATE POLICY "Users can view chat conversations they participate in"
  ON public.chat_conversations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.chat_conversation_participants cp
      JOIN public.profiles p ON p.id = auth.uid()
      WHERE cp.conversation_id = chat_conversations.id
        AND cp.profile_id = auth.uid()
        AND cp.company_id = chat_conversations.company_id
        AND p.company_id = chat_conversations.company_id
    )
  );

DROP POLICY IF EXISTS "Users can view chat participants from their conversations" ON public.chat_conversation_participants;
CREATE POLICY "Users can view chat participants from their conversations"
  ON public.chat_conversation_participants
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.chat_conversation_participants mine
      JOIN public.profiles p ON p.id = auth.uid()
      WHERE mine.conversation_id = chat_conversation_participants.conversation_id
        AND mine.profile_id = auth.uid()
        AND p.company_id = chat_conversation_participants.company_id
    )
  );

DROP POLICY IF EXISTS "Users can view chat messages from their conversations" ON public.chat_messages;
CREATE POLICY "Users can view chat messages from their conversations"
  ON public.chat_messages
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.chat_conversation_participants cp
      JOIN public.profiles p ON p.id = auth.uid()
      WHERE cp.conversation_id = chat_messages.conversation_id
        AND cp.profile_id = auth.uid()
        AND p.company_id = chat_messages.company_id
    )
  );

DROP POLICY IF EXISTS "Users can view chat reads from their conversations" ON public.chat_message_reads;
CREATE POLICY "Users can view chat reads from their conversations"
  ON public.chat_message_reads
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.chat_conversation_participants cp
      JOIN public.profiles p ON p.id = auth.uid()
      WHERE cp.conversation_id = chat_message_reads.conversation_id
        AND cp.profile_id = auth.uid()
        AND p.company_id = chat_message_reads.company_id
    )
  );

GRANT EXECUTE ON FUNCTION public.ensure_general_chat() TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_direct_chat(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_chat_message(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_conversation_read(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_chat_conversations() TO authenticated;

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_conversations;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN invalid_object_definition THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_conversation_participants;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN invalid_object_definition THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN invalid_object_definition THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_message_reads;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN invalid_object_definition THEN NULL;
  END;
END $$;
