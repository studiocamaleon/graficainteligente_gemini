/*
  # Add Received Checks Support
  
  1. New Types
     - `cheque_direction`: 'emitido', 'recibido'

  2. Changes to `cheques_cartera`
     - Add `direction` column (default 'emitido').
     - Add `client_id` FK to `clients` (for received checks).
     - Add `orden_id` FK to `ordenes_trabajo` (optional link to work order).
*/

-- Create Enum
CREATE TYPE cheque_direction AS ENUM ('emitido', 'recibido');

-- Alter Table
ALTER TABLE cheques_cartera 
ADD COLUMN direction cheque_direction NOT NULL DEFAULT 'emitido',
ADD COLUMN client_id uuid REFERENCES clients(id) ON DELETE SET NULL,
ADD COLUMN orden_id uuid REFERENCES ordenes_trabajo(id) ON DELETE SET NULL;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_cheques_direction ON cheques_cartera(direction);
CREATE INDEX IF NOT EXISTS idx_cheques_client ON cheques_cartera(client_id);
CREATE INDEX IF NOT EXISTS idx_cheques_orden ON cheques_cartera(orden_id);
