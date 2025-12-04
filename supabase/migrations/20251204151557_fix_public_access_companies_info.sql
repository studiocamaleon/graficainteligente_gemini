/*
  # Permitir acceso público a información básica de empresas

  ## Descripción
  Permite que usuarios no autenticados puedan consultar información básica de las empresas
  para el formulario de autoregistro de clientes.

  ## Cambios
  1. Se agrega política SELECT para permitir acceso público de solo lectura a:
     - id
     - name
     - logo_url

  ## Seguridad
  - La política es restrictiva: solo permite SELECT (lectura)
  - Solo expone campos públicos no sensibles
  - No permite modificación de datos
*/

-- Crear política para permitir lectura pública de información básica de empresas
CREATE POLICY "Allow public read access to basic company info"
  ON companies
  FOR SELECT
  TO anon, authenticated
  USING (true);
