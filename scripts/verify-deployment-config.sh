#!/bin/bash

# Script de verificación de configuración de deployment
# Verifica que todos los archivos necesarios para el tracking estén presentes

echo "🔍 Verificando configuración de deployment para tracking..."
echo ""

# Colores
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Contador de errores
ERRORS=0
WARNINGS=0

# Función para verificar archivo
check_file() {
    local file=$1
    local description=$2

    if [ -f "$file" ]; then
        echo -e "${GREEN}✅ $description${NC}"
        echo "   📁 $file"
    else
        echo -e "${RED}❌ $description${NC}"
        echo "   📁 $file (NO ENCONTRADO)"
        ((ERRORS++))
    fi
    echo ""
}

# Función para verificar archivo opcional
check_optional_file() {
    local file=$1
    local description=$2

    if [ -f "$file" ]; then
        echo -e "${GREEN}✅ $description${NC}"
        echo "   📁 $file"
    else
        echo -e "${YELLOW}⚠️  $description (opcional)${NC}"
        echo "   📁 $file"
        ((WARNINGS++))
    fi
    echo ""
}

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "1️⃣  Archivos en /public (se copian al build)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

check_file "public/_redirects" "Archivo _redirects (Netlify/Render)"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "2️⃣  Archivos de configuración en raíz"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

check_optional_file "netlify.toml" "Configuración de Netlify"
check_optional_file "vercel.json" "Configuración de Vercel"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "3️⃣  Verificando build (dist/)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ ! -d "dist" ]; then
    echo -e "${YELLOW}⚠️  Directorio dist/ no encontrado${NC}"
    echo "   Ejecuta: npm run build"
    ((WARNINGS++))
else
    check_file "dist/_redirects" "Archivo _redirects en build"
    check_file "dist/index.html" "Archivo index.html en build"

    # Verificar contenido del _redirects
    if [ -f "dist/_redirects" ]; then
        if grep -q "/*    /index.html   200" "dist/_redirects"; then
            echo -e "${GREEN}✅ Contenido de _redirects correcto${NC}"
            echo ""
        else
            echo -e "${RED}❌ Contenido de _redirects incorrecto${NC}"
            echo "   Debe contener: /*    /index.html   200"
            echo ""
            ((ERRORS++))
        fi
    fi
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "4️⃣  Verificando rutas en código"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if grep -q 'path="/track/:token"' "src/App.tsx"; then
    echo -e "${GREEN}✅ Ruta de tracking configurada en App.tsx${NC}"
    echo ""
else
    echo -e "${RED}❌ Ruta de tracking NO encontrada en App.tsx${NC}"
    echo ""
    ((ERRORS++))
fi

if grep -q 'OrderTracking' "src/App.tsx"; then
    echo -e "${GREEN}✅ Componente OrderTracking importado${NC}"
    echo ""
else
    echo -e "${RED}❌ Componente OrderTracking NO importado${NC}"
    echo ""
    ((ERRORS++))
fi

# Resumen final
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 RESUMEN"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}✅ TODO CORRECTO - Listo para deployment${NC}"
    echo ""
    echo "🚀 Próximos pasos:"
    echo "   1. Deployar la aplicación"
    echo "   2. Verificar que /track/{TOKEN} funciona"
    echo "   3. Probar con un token real de una orden"
    echo ""
    exit 0
else
    echo -e "${RED}❌ SE ENCONTRARON $ERRORS ERRORES${NC}"
    if [ $WARNINGS -gt 0 ]; then
        echo -e "${YELLOW}⚠️  Y $WARNINGS ADVERTENCIAS${NC}"
    fi
    echo ""
    echo "❌ Corrige los errores antes de deployar"
    echo ""
    exit 1
fi
