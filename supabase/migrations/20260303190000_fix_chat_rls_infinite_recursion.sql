CREATE OR REPLACE FUNCTION public.chat_user_company_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT company_id
  FROM public.profiles
  WHERE id = auth.uid()
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.chat_user_is_participant(p_conversation_id uuid, p_company_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.chat_conversation_participants cp
    WHERE cp.conversation_id = p_conversation_id
      AND cp.profile_id = auth.uid()
      AND cp.company_id = p_company_id
  )
$$;

DROP POLICY IF EXISTS "Users can view chat conversations they participate in" ON public.chat_conversations;
CREATE POLICY "Users can view chat conversations they participate in"
  ON public.chat_conversations
  FOR SELECT
  TO authenticated
  USING (
    public.chat_user_company_id() = company_id
    AND public.chat_user_is_participant(id, company_id)
  );

DROP POLICY IF EXISTS "Users can view chat participants from their conversations" ON public.chat_conversation_participants;
CREATE POLICY "Users can view chat participants from their conversations"
  ON public.chat_conversation_participants
  FOR SELECT
  TO authenticated
  USING (
    public.chat_user_company_id() = company_id
    AND public.chat_user_is_participant(conversation_id, company_id)
  );

DROP POLICY IF EXISTS "Users can view chat messages from their conversations" ON public.chat_messages;
CREATE POLICY "Users can view chat messages from their conversations"
  ON public.chat_messages
  FOR SELECT
  TO authenticated
  USING (
    public.chat_user_company_id() = company_id
    AND public.chat_user_is_participant(conversation_id, company_id)
  );

DROP POLICY IF EXISTS "Users can view chat reads from their conversations" ON public.chat_message_reads;
CREATE POLICY "Users can view chat reads from their conversations"
  ON public.chat_message_reads
  FOR SELECT
  TO authenticated
  USING (
    public.chat_user_company_id() = company_id
    AND public.chat_user_is_participant(conversation_id, company_id)
  );

GRANT EXECUTE ON FUNCTION public.chat_user_company_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.chat_user_is_participant(uuid, uuid) TO authenticated;
