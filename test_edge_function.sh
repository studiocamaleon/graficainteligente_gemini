#!/bin/bash
SUPABASE_URL="https://velbpmbndvovczruzkzg.supabase.co"
ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZlbGJwbWJuZHZvdmN6cnV6a3pnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ5NTM0MTgsImV4cCI6MjA4MDUyOTQxOH0.NaUzS0Ra1LOvWoVvj1is1c2PmdzcBT5elYDu5WcfSKw"

curl -X POST "${SUPABASE_URL}/functions/v1/send-wati-message" \
  -H "Authorization: Bearer ${ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
        "company_id": "1ce5a11b-ed47-477b-919f-7fab92a0f311",
        "phone": "5492966671081",
        "template_name": "orden_finalizada_v3",
        "parameters": [
            {"name": "nombre_cliente", "value": "Test"},
            {"name": "numero_orden", "value": "GI-000151"},
            {"name": "saldo_pendiente", "value": "$14,667.62"},
            {"name": "url_tracking", "value": "https://www.grafica.ar/track/ABC123456"},
            {"name": "nombre_empresa", "value": "Gráfica Inteligente"},
            {"name": "1", "value": "ABC123456"}
        ],
        "metadata": {
            "tipo": "orden_finalizada",
            "orden_trabajo_id": "c6052975-37cd-4b02-a5e4-ef7757babfc6"
        }
    }'
