-- Migration to support Expenses paid by Credit Card

-- Add tarjeta_id to egresos
ALTER TABLE egresos 
ADD COLUMN tarjeta_id UUID REFERENCES tarjetas_credito(id) ON DELETE SET NULL;

-- Make caja_id nullable (since credit card payments don't use a cash box immediately)
ALTER TABLE egresos 
ALTER COLUMN caja_id DROP NOT NULL;

-- Add index
CREATE INDEX idx_egresos_tarjeta ON egresos(tarjeta_id);
