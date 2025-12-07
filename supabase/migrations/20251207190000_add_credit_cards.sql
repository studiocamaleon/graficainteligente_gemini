-- Create Table: tarjetas_credito
CREATE TABLE tarjetas_credito (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    nombre VARCHAR(255) NOT NULL, -- e.g., "Visa Banco Galicia"
    banco VARCHAR(255) NOT NULL,
    ultimos_4_digitos VARCHAR(4),
    dia_cierre INTEGER NOT NULL CHECK (dia_cierre BETWEEN 1 AND 31),
    dia_vencimiento INTEGER NOT NULL CHECK (dia_vencimiento BETWEEN 1 AND 31),
    color VARCHAR(20) DEFAULT 'blue', -- UI decoration
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create Table: tarjetas_resumenes
CREATE TABLE tarjetas_resumenes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tarjeta_id UUID NOT NULL REFERENCES tarjetas_credito(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    periodo VARCHAR(7) NOT NULL, -- "MM/YYYY" e.g., "12/2025"
    fecha_cierre DATE NOT NULL,
    fecha_vencimiento DATE NOT NULL,
    estado VARCHAR(20) NOT NULL DEFAULT 'abierto' CHECK (estado IN ('abierto', 'cerrado', 'pagado')),
    total_consumos DECIMAL(12, 2) DEFAULT 0,
    total_pagado DECIMAL(12, 2) DEFAULT 0,
    observaciones TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tarjeta_id, periodo)
);

-- Create Table: tarjetas_consumos
CREATE TABLE tarjetas_consumos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    resumen_id UUID NOT NULL REFERENCES tarjetas_resumenes(id) ON DELETE CASCADE,
    tarjeta_id UUID NOT NULL REFERENCES tarjetas_credito(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    fecha_compra DATE NOT NULL,
    descripcion TEXT NOT NULL,
    monto_original DECIMAL(12, 2) NOT NULL, -- El total de la compra si es 1 pago, o el total dividido si impactamos cuota pura
    monto_cuota DECIMAL(12, 2) NOT NULL, -- Lo que impacta en ESTE resumen
    cuotas_total INTEGER NOT NULL DEFAULT 1,
    nro_cuota INTEGER NOT NULL DEFAULT 1,
    comprobante_url TEXT,
    categoria_id UUID REFERENCES categorias(id), -- Para imputar al gasto correcto
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE tarjetas_credito ENABLE ROW LEVEL SECURITY;
ALTER TABLE tarjetas_resumenes ENABLE ROW LEVEL SECURITY;
ALTER TABLE tarjetas_consumos ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their company credit cards" ON tarjetas_credito
    FOR SELECT USING (company_id = (select company_id from profiles where id = auth.uid()));

CREATE POLICY "Users can manage their company credit cards" ON tarjetas_credito
    FOR ALL USING (company_id = (select company_id from profiles where id = auth.uid()));

CREATE POLICY "Users can view their company summaries" ON tarjetas_resumenes
    FOR SELECT USING (company_id = (select company_id from profiles where id = auth.uid()));

CREATE POLICY "Users can manage their company summaries" ON tarjetas_resumenes
    FOR ALL USING (company_id = (select company_id from profiles where id = auth.uid()));

CREATE POLICY "Users can view their company consumptions" ON tarjetas_consumos
    FOR SELECT USING (company_id = (select company_id from profiles where id = auth.uid()));

CREATE POLICY "Users can manage their company consumptions" ON tarjetas_consumos
    FOR ALL USING (company_id = (select company_id from profiles where id = auth.uid()));

-- Indexes
CREATE INDEX idx_tarjetas_company ON tarjetas_credito(company_id);
CREATE INDEX idx_resumenes_tarjeta ON tarjetas_resumenes(tarjeta_id);
CREATE INDEX idx_resumenes_periodo ON tarjetas_resumenes(periodo);
CREATE INDEX idx_consumos_resumen ON tarjetas_consumos(resumen_id);
