#!/usr/bin/env bash
set -euo pipefail

if [ $# -lt 3 ]; then
  echo "uso: restore.sh <arquivo.archive.gz> <uri-do-servidor-sem-banco> <banco-de-destino>" >&2
  echo "exemplo de teste: restore.sh backup.archive.gz 'mongodb://igtools:senha@127.0.0.1:27017/?authSource=ig-automatic-tools' ig-automatic-tools-test" >&2
  exit 1
fi

FILE="$1"
SERVER_URI="$2"
TARGET_DB="$3"

mongorestore --uri="$SERVER_URI" --archive="$FILE" --gzip --drop \
  --nsInclude="${SOURCE_DB:-ig-automatic-tools}.*" \
  --nsFrom="${SOURCE_DB:-ig-automatic-tools}.*" --nsTo="$TARGET_DB.*" --quiet

echo "restaurado em $TARGET_DB"
