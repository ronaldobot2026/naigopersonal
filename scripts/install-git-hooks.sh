#!/bin/sh
# Instala os hooks versionados do repositório.
#
# Decisão: usar `core.hooksPath` apontando para scripts/git-hooks/ em vez de copiar arquivos
# para .git/hooks/. Motivos:
#   1. Os hooks ficam versionados — quem atualizar o hook atualiza para todo mundo, sem
#      precisar reinstalar nada.
#   2. `core.hooksPath` é config do repositório e vale para todos os git worktrees dele.
#   3. Zero dependência nova (husky faz exatamente isso, mas com um pacote no meio).
# Custo: cada clone novo precisa rodar este script uma vez (git não executa hooks de
# repositório automaticamente, por segurança). Daí o script `npm run hooks:install`.

set -e

REPO_ROOT=$(git rev-parse --show-toplevel)
cd "$REPO_ROOT"

chmod +x scripts/git-hooks/*
git config core.hooksPath scripts/git-hooks

echo "Hooks instalados: core.hooksPath = $(git config core.hooksPath)"
echo "Ativo: pre-push (roda 'npm run build'; pule com 'git push --no-verify')."
