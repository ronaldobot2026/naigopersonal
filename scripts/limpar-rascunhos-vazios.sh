#!/usr/bin/env bash
# Lista (e, com --apagar, remove) rascunhos de avaliação física sem nenhum dado útil.
#
# "Sem dado útil" = status 'draft' E sem nenhuma medida preenchida em body_metrics E sem foto em
# assessment_photos E sem postural_assessment. São os rascunhos que a tela "Nova avaliação" criava
# só por ter sido aberta; poluem o histórico do personal sem informação nenhuma.
#
# A service role NUNCA fica neste arquivo: é lida em runtime de ~/.config/naigo/service_role.key
# (chmod 600). Sem ela o script não roda.
#
# Uso:
#   scripts/limpar-rascunhos-vazios.sh            # dry-run (padrão): só lista
#   scripts/limpar-rascunhos-vazios.sh --apagar   # apaga de verdade

set -euo pipefail

PROJECT_REF="midftshifkvweehrtyte"
BASE_URL="https://${PROJECT_REF}.supabase.co/rest/v1"
KEY_FILE="${HOME}/.config/naigo/service_role.key"
APAGAR=0

for arg in "$@"; do
  case "$arg" in
    --apagar) APAGAR=1 ;;
    --dry-run) APAGAR=0 ;;
    -h|--help) sed -n '2,13p' "$0"; exit 0 ;;
    *) echo "Argumento desconhecido: $arg" >&2; exit 2 ;;
  esac
done

if [[ ! -f "$KEY_FILE" ]]; then
  echo "Erro: chave de service role nao encontrada em $KEY_FILE" >&2
  echo "Crie o arquivo com a chave do projeto $PROJECT_REF e rode: chmod 600 $KEY_FILE" >&2
  exit 1
fi
SERVICE_KEY="$(tr -d '[:space:]' < "$KEY_FILE")"
if [[ -z "$SERVICE_KEY" ]]; then
  echo "Erro: $KEY_FILE esta vazio." >&2
  exit 1
fi

command -v jq >/dev/null || { echo "Erro: jq e obrigatorio." >&2; exit 1; }

api_get() {
  curl -sS -G "${BASE_URL}/$1" \
    -H "apikey: ${SERVICE_KEY}" \
    -H "Authorization: Bearer ${SERVICE_KEY}" \
    --data-urlencode "select=$2" \
    ${3:+--data-urlencode "$3"}
}

# 1) Todos os rascunhos, com a coluna postural para descartar quem ja tem analise.
DRAFTS="$(api_get physical_assessments 'id,student_id,created_at,postural_assessment' 'status=eq.draft')"
TOTAL_DRAFTS="$(jq 'length' <<<"$DRAFTS")"

# 2) Assessments com pelo menos uma foto.
PHOTOS="$(api_get assessment_photos 'assessment_id' '')"

# 3) Metricas: consideradas "preenchidas" se qualquer coluna numerica for nao-nula.
METRICS="$(api_get body_metrics 'assessment_id,weight_kg,height_cm,body_fat_percent,muscle_mass_kg,chest_cm,waist_cm,hip_cm,right_arm_cm,left_arm_cm,right_thigh_cm,left_thigh_cm,calves_cm' '')"

VAZIOS="$(jq -n \
  --argjson drafts "$DRAFTS" \
  --argjson photos "$PHOTOS" \
  --argjson metrics "$METRICS" '
  ($photos | map(.assessment_id) | unique) as $com_foto
  | ($metrics
      | map(select(
          (to_entries
            | map(select(.key != "assessment_id" and .value != null))
            | length) > 0))
      | map(.assessment_id) | unique) as $com_metrica
  | $drafts
  | map(select(
      (.postural_assessment == null)
      and (([.id] | inside($com_foto)) | not)
      and (([.id] | inside($com_metrica)) | not)))
')"

QTD="$(jq 'length' <<<"$VAZIOS")"

# Motivo de cada rascunho MANTIDO — sem isso um "0 vazios" parece bug em vez de resultado.
MANTIDOS="$(jq -n \
  --argjson drafts "$DRAFTS" \
  --argjson photos "$PHOTOS" \
  --argjson metrics "$METRICS" '
  ($photos | map(.assessment_id) | unique) as $com_foto
  | ($metrics
      | map(select(
          (to_entries
            | map(select(.key != "assessment_id" and .value != null))
            | length) > 0))
      | map(.assessment_id) | unique) as $com_metrica
  | $drafts
  | map({
      id,
      motivos: ([
        (if .postural_assessment != null then "postural" else empty end),
        (if ([.id] | inside($com_foto)) then "foto" else empty end),
        (if ([.id] | inside($com_metrica)) then "biometria" else empty end)
      ])
    })
  | map(select(.motivos | length > 0))
')"

echo "Projeto: ${PROJECT_REF}"
echo "Rascunhos (status=draft) no total: ${TOTAL_DRAFTS}"
echo "Rascunhos VAZIOS (sem biometria, sem foto, sem postural): ${QTD}"
echo
jq -r '.[] | "  - \(.id)  aluno=\(.student_id)  criado=\(.created_at)"' <<<"$VAZIOS"
echo
echo "Rascunhos mantidos (tem dado util): $(jq 'length' <<<"$MANTIDOS")"
jq -r '.[] | "  - \(.id)  mantido por: \(.motivos | join(", "))"' <<<"$MANTIDOS"
echo

if [[ "$QTD" -eq 0 ]]; then
  echo "Nada a fazer."
  exit 0
fi

if [[ "$APAGAR" -eq 0 ]]; then
  echo "DRY-RUN: nada foi apagado. Rode com --apagar para remover os ${QTD} rascunhos acima."
  exit 0
fi

# Exclusao real: body_metrics e assessment_photos tem ON DELETE CASCADE, entao basta a linha pai.
echo "Apagando ${QTD} rascunhos vazios..."
while read -r id; do
  [[ -z "$id" ]] && continue
  status="$(curl -sS -o /dev/null -w '%{http_code}' -X DELETE \
    "${BASE_URL}/physical_assessments?id=eq.${id}" \
    -H "apikey: ${SERVICE_KEY}" \
    -H "Authorization: Bearer ${SERVICE_KEY}")"
  echo "  ${id} -> HTTP ${status}"
done < <(jq -r '.[].id' <<<"$VAZIOS")
echo "Concluido."
