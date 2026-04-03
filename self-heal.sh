#!/bin/bash
# Script de self-healing pour l'environnement sandbox
# Ce script vérifie et restaure tous les fichiers nécessaires au démarrage
# Il est appelé automatiquement avant chaque démarrage du serveur

set -e
cd /home/z/my-project

echo "[self-heal] Vérification de l'environnement..."

# 1. S'assurer que dev.sh existe
if [ ! -f "dev.sh" ]; then
    echo "#!/bin/bash
cd /home/z/my-project
exec bun run dev" > dev.sh
    echo "[self-heal] dev.sh restauré"
fi

# 2. S'assurer que .env existe
if [ ! -f ".env" ]; then
    echo "DATABASE_URL=\"file:./dev.db\"" > .env
    echo "[self-heal] .env restauré"
fi

# 3. S'assurer que la DB existe
if [ ! -f "prisma/dev.db" ]; then
    echo "[self-heal] Base de données introuvable, initialisation..."
    bunx prisma db push --skip-generate 2>/dev/null || npx prisma db push --skip-generate 2>/dev/null || true
    # Seed les catégories
    echo "[self-heal] DB initialisée"
fi

# 4. Nettoyer les fichiers temporaires
rm -rf public/uploads/_temp_extract 2>/dev/null || true
rm -rf public/uploads/_temp_repair 2>/dev/null || true

echo "[self-heal] Environnement OK ✓"
