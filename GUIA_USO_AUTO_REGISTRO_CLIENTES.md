# 📘 Guía de Uso: Sistema de Auto-Registro de Clientes

## 🎯 Para Qué Sirve

Este sistema permite que los clientes se registren de forma autónoma desde un formulario público, sin necesidad de que un empleado los dé de alta manualmente.

---

## 🚀 Cómo Usar el Sistema

### **Paso 1: Obtener el Link de Registro**

Cada empresa tiene su propio link único de registro. Para obtenerlo:

1. **Buscar el ID de tu empresa:**
   - Ve al panel de administración
   - En "Configuración de Empresa" encontrarás tu Company ID
   - O pregunta al administrador del sistema

2. **Construir la URL:**
   ```
   https://tu-dominio.com/registro/[COMPANY-ID]
   ```

   **Ejemplo:**
   ```
   https://app.imprenta.com/registro/123e4567-e89b-12d3-a456-426614174000
   ```

---

### **Paso 2: Compartir el Link**

Puedes compartir este link de múltiples formas:

#### 📱 **Por WhatsApp:**
```
¡Hola! Te compartimos nuestro formulario de registro:

https://app.imprenta.com/registro/123e4567

Completa tus datos y comenzá a hacer pedidos.
```

#### 📧 **Por Email:**
```
Asunto: Registrate en [Nombre Empresa]

Hola,

Para empezar a hacer pedidos, por favor registrate en nuestro sistema:

[Link de Registro]

Es rápido y solo te tomará 2 minutos.

Saludos,
[Tu Nombre]
```

#### 🌐 **En tu Sitio Web:**
```html
<a href="https://app.imprenta.com/registro/123e4567"
   class="btn-registro">
   Registrarse como Cliente
</a>
```

#### 📱 **QR Code:**
Genera un código QR con el link para:
- Imprimir en folletos
- Mostrar en el local
- Incluir en tarjetas de presentación
- Compartir en redes sociales

**Herramientas para generar QR:**
- https://www.qr-code-generator.com/
- https://www.qrcode-monkey.com/
- Google "QR Code Generator"

---

### **Paso 3: Cliente Completa el Formulario**

El cliente verá un formulario moderno en 4 pasos:

#### **Paso 1: Datos Básicos** 📋
- Nombre Comercial
- Razón Social

#### **Paso 2: Documento** 📄
- Tipo de Documento (DNI/CUIT/CUIL)
- Número de Documento

#### **Paso 3: Contacto** 📞
- WhatsApp (obligatorio)
- Email (opcional)

#### **Paso 4: Dirección** 📍
- Domicilio (opcional)

---

### **Paso 4: Cliente Recibe Confirmación**

Cuando el cliente completa el registro:

1. ✅ **Ve pantalla de éxito**
2. 📱 **Recibe WhatsApp de confirmación** (si está configurado)
3. ⏳ **Debe esperar aprobación**

**Mensaje de WhatsApp que recibe:**
```
Hola [Nombre Cliente]!

Gracias por registrarte en [Tu Empresa].

Tu solicitud de registro ha sido recibida y está
siendo revisada por nuestro equipo.

En breve recibirás una confirmación cuando tu
cuenta sea aprobada.

¡Gracias por tu paciencia!
```

---

### **Paso 5: Tú Apruebas o Rechazas**

1. **Ve al módulo Clientes**
2. **Filtra por "Pendientes de Aprobación"**
3. **Revisa los datos del cliente**
4. **Aprueba o Rechaza:**
   - ✅ **Aprobar:** El cliente puede empezar a hacer pedidos
   - ❌ **Rechazar:** El cliente recibe notificación
   - 📝 **Editar:** Puedes modificar datos antes de aprobar

---

## 🛡️ Seguridad del Sistema

### Rate Limiting
- **Límite:** 10 intentos por hora por IP
- **Protección:** Contra spam y registros masivos
- **Bloqueo:** 60 minutos si se excede el límite

### Validaciones
- ✅ Documentos validados según formato argentino
- ✅ WhatsApp validado y formateado
- ✅ Email validado (si se proporciona)
- ✅ No permite duplicados

### Privacidad
- 🔒 Conexión HTTPS obligatoria
- 🔒 Datos encriptados en tránsito
- 🔒 IP registrada para auditoría
- 🔒 CORS configurado correctamente

---

## 📊 Métricas y Reportes

### Ver Clientes Pendientes:
```sql
SELECT nombre_fantasia, razon_social, fecha_registro
FROM clients
WHERE status_aprobacion = 'pending'
ORDER BY fecha_registro DESC;
```

### Ver Registros por Día:
```sql
SELECT
  DATE(fecha_registro) as fecha,
  COUNT(*) as total
FROM clients
WHERE status_aprobacion = 'pending'
GROUP BY DATE(fecha_registro)
ORDER BY fecha DESC;
```

### Ver Tasa de Aprobación:
```sql
SELECT
  COUNT(*) FILTER (WHERE status_aprobacion = 'approved') as aprobados,
  COUNT(*) FILTER (WHERE status_aprobacion = 'rejected') as rechazados,
  COUNT(*) FILTER (WHERE status_aprobacion = 'pending') as pendientes,
  COUNT(*) as total
FROM clients
WHERE fecha_registro > CURRENT_DATE - INTERVAL '30 days';
```

---

## ❓ Preguntas Frecuentes

### **¿El cliente puede hacer pedidos inmediatamente?**
No, primero debe ser aprobado por un administrador.

### **¿Qué pasa si el cliente intenta registrarse dos veces?**
El sistema detecta documentos duplicados y muestra un mensaje apropiado según el estado:
- Si está pendiente: "Tu solicitud ya está siendo procesada"
- Si fue rechazado: "Tu solicitud fue rechazada, contacta con la empresa"
- Si ya fue aprobado: "Ya tienes una cuenta activa"

### **¿Puedo personalizar el formulario?**
Sí, puedes modificar:
- Campos mostrados
- Validaciones
- Textos y mensajes
- Colores y estilos
- Logo de empresa

### **¿El WhatsApp es obligatorio?**
Sí, es el único campo de contacto obligatorio además del documento.

### **¿Puedo desactivar el registro público?**
Sí, simplemente no compartas el link. No hay botón público en el sistema.

### **¿Los datos son seguros?**
Sí, toda la información viaja encriptada (HTTPS) y se almacena en Supabase con políticas de seguridad (RLS).

### **¿Qué pasa si se excede el rate limit?**
El cliente verá un mensaje: "Ha superado el límite de 10 intentos por hora. Intente nuevamente en X minutos."

### **¿Puedo ver la IP de quien se registró?**
Sí, está guardada en el campo `ip_registro` para auditoría.

---

## 🎨 Personalización

### Cambiar Colores:
Edita `src/pages/public/ClienteRegistro.tsx`:

```tsx
// Cambiar gradiente principal
className="bg-gradient-to-r from-purple-600 to-pink-600"

// Cambiar gradiente de fondo
className="bg-gradient-to-br from-purple-50 via-white to-pink-50"
```

### Agregar Campos Custom:
1. Agrega el campo al estado `formData`
2. Crea la validación en el hook
3. Agrega el FormField en el paso deseado
4. Actualiza la integración con la edge function

### Cambiar Textos:
Busca los strings en el componente y modifícalos directamente.

---

## 🚨 Troubleshooting

### **El formulario no carga**
- ✅ Verifica que el Company ID es correcto
- ✅ Verifica que la empresa existe en la BD
- ✅ Revisa la consola del navegador

### **No envía el WhatsApp**
- ✅ Verifica que `whatsapp_configured = true` en companies
- ✅ Verifica que el backend de WhatsApp está conectado
- ✅ Revisa los logs de la edge function

### **Error 429 (Rate Limit)**
- ✅ Espera 60 minutos
- ✅ O limpia la tabla `cliente_registro_intentos` manualmente

### **Error de validación de documento**
- ✅ Verifica el formato: DNI 7-8 dígitos, CUIT/CUIL 11 dígitos
- ✅ Limpia espacios y guiones

### **Cliente no aparece en la lista**
- ✅ Verifica que el registro fue exitoso
- ✅ Filtra por status "pending" en el módulo Clientes
- ✅ Busca por documento o nombre

---

## 📞 Soporte

Si tienes problemas con el sistema:

1. **Revisa los logs de Supabase:**
   - Edge Functions logs
   - Database logs
   - Realtime logs

2. **Verifica la base de datos:**
   ```sql
   SELECT * FROM clients
   WHERE numero_documento = 'DOCUMENTO_DEL_CLIENTE';
   ```

3. **Revisa la tabla de intentos:**
   ```sql
   SELECT * FROM cliente_registro_intentos
   WHERE ip_address = 'IP_DEL_CLIENTE';
   ```

---

## ✅ Checklist de Configuración

Antes de compartir el link de registro:

- [ ] Obtuve el Company ID correcto
- [ ] Probé el link en incógnito
- [ ] Verifiqué que el logo aparece
- [ ] Completé un registro de prueba
- [ ] Verifiqué que aparece en "Pendientes"
- [ ] Probé aprobar un cliente
- [ ] Probé rechazar un cliente
- [ ] Configuré WhatsApp (opcional)
- [ ] Probé en móvil
- [ ] Probé en tablet
- [ ] Probé en desktop

---

## 🎯 Mejores Prácticas

### ✅ **DO:**
- Responde rápido a los registros pendientes
- Mantén el WhatsApp configurado para confirmaciones
- Revisa los datos antes de aprobar
- Comunica con el cliente si hay dudas
- Mantén una política clara de aprobación

### ❌ **DON'T:**
- No apruebes sin revisar los datos
- No dejes registros pendientes por días
- No rechaces sin dar explicaciones
- No compartas el link de otra empresa
- No modifiques el Company ID manualmente

---

## 📈 KPIs Recomendados

### Velocidad de Aprobación:
- **Óptimo:** < 24 horas
- **Aceptable:** 24-48 horas
- **Mejorar:** > 48 horas

### Tasa de Aprobación:
- **Saludable:** > 80%
- **Revisar proceso:** < 60%

### Registros por Día:
- Monitorear tendencias
- Correlacionar con campañas
- Identificar picos anormales (spam)

---

## 🎉 ¡Todo Listo!

Ahora puedes:
1. ✅ Obtener tu link de registro
2. ✅ Compartirlo con clientes potenciales
3. ✅ Aprobar/rechazar registros desde el panel
4. ✅ Automatizar el onboarding de clientes

**Link de ejemplo:**
```
https://app.imprenta.com/registro/123e4567-e89b-12d3-a456-426614174000
```

¡Compártelo y comienza a recibir registros!
