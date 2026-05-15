#!/bin/bash
# Uso: ./push.sh "mensagem do commit"
# Se não passar mensagem, pergunta interativamente.

BRANCH=$(git rev-parse --abbrev-ref HEAD)

if [ -n "$1" ]; then
  MSG="$1"
else
  echo ""
  read -rp "Nome do commit: " MSG
  if [ -z "$MSG" ]; then
    echo "Mensagem vazia. Operação cancelada."
    exit 1
  fi
fi

echo ""
echo "Arquivos a commitar:"
git status --short
echo ""

git add -A

if git diff --cached --quiet; then
  echo "Nada a commitar. Working tree limpo."
  exit 0
fi

git commit -m "$MSG"

if [ $? -ne 0 ]; then
  echo ""
  echo "Erro no commit. Push cancelado."
  exit 1
fi

echo ""
echo "Fazendo push para origin/$BRANCH..."
git push origin "$BRANCH"

if [ $? -eq 0 ]; then
  echo ""
  echo "Pronto! Commit e push feitos com sucesso."
else
  echo ""
  echo "Push falhou. Verifique a conexão ou as permissões do repositório."
  exit 1
fi
