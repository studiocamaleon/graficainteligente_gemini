
-- Create company_business_hours table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.company_business_hours (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    day_of_week integer NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    is_open boolean DEFAULT false,
    opening_time_1 time without time zone,
    closing_time_1 time without time zone,
    opening_time_2 time without time zone,
    closing_time_2 time without time zone,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT company_business_hours_company_id_day_of_week_key UNIQUE (company_id, day_of_week)
);

-- Enable RLS
ALTER TABLE public.company_business_hours ENABLE ROW LEVEL SECURITY;

-- Policies for authenticated users (based on profile company)
CREATE POLICY "Users can view own company business hours"
    ON public.company_business_hours FOR SELECT
    TO authenticated
    USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert own company business hours"
    ON public.company_business_hours FOR INSERT
    TO authenticated
    WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update own company business hours"
    ON public.company_business_hours FOR UPDATE
    TO authenticated
    USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()))
    WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can delete own company business hours"
    ON public.company_business_hours FOR DELETE
    TO authenticated
    USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

-- Policy for public access (Tracking pages)
CREATE POLICY "Public tracking can view business hours"
    ON public.company_business_hours FOR SELECT
    TO anon
    USING (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_company_business_hours_company_id ON company_business_hours(company_id);
