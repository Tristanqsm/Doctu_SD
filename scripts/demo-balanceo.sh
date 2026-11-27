#!/usr/bin/env bash
# =============================================================================
#  DOCTU · Demo de balanceo con réplicas y caída de una réplica
# -----------------------------------------------------------------------------
#  Requisitos: el sistema levantado (docker compose up --build -d) y bash + curl
#  (en Windows: Git Bash).
#
#  Uso:
#    ./scripts/demo-balanceo.sh              # reparto + los 4 escenarios de falla
#    ./scripts/demo-balanceo.sh reparto      # solo el reparto round robin
#    ./scripts/demo-balanceo.sh stop         # docker stop de una réplica
#    ./scripts/demo-balanceo.sh kill         # docker kill (corte abrupto, como en S07)
#    ./scripts/demo-balanceo.sh enferma      # réplica viva pero /health responde 503
#    ./scripts/demo-balanceo.sh colgada      # réplica congelada con docker pause
#
#  En cada escenario se hace una consulta cada medio segundo por el gateway, se
#  provoca la falla en la consulta 5 y se repara en la 25. Al final se cuentan
#  los errores y se muestran los eventos del balanceador en el log del gateway.
# =============================================================================
set -u
export MSYS_NO_PATHCONV=1   # Git Bash: no convertir /tmp a una ruta de Windows

GATEWAY="${GATEWAY:-http://localhost:8080}"
REPLICA="${REPLICA:-doctu-servicio-expedientes-1}"
CONSULTAS="${CONSULTAS:-40}"
FALLA_EN=5
REPARA_EN=25

B=$'\e[1m'; V=$'\e[32m'; R=$'\e[31m'; A=$'\e[33m'; N=$'\e[0m'

titulo() { printf '\n%s== %s ==%s\n' "$B" "$1" "$N"; }

login() {
  TOKEN=$(curl -s -X POST "$GATEWAY/api/usuarios/login" \
    -H 'Content-Type: application/json' \
    -d '{"email":"doctor@doctu.com","password":"password123","rol":"medico"}' |
    sed -nE 's/.*"token":"([^"]+)".*/\1/p')
  if [ -z "$TOKEN" ]; then
    echo "${R}No se pudo iniciar sesión en $GATEWAY. ¿Está levantado el sistema?${N}"
    exit 1
  fi
}

# Una consulta por el gateway. Imprime: "<código HTTP> <réplica que respondió>"
consulta() {
  curl -s -o /dev/null --max-time 10 \
    -w '%{http_code} %header{x-served-by}' \
    -H "Authorization: Bearer $TOKEN" \
    "$GATEWAY/api/expedientes/expedientes"
}

reparto() {
  titulo "Reparto round robin (10 consultas por el gateway)"
  echo "Directorio: DNS de Docker -> servicio-expedientes resuelve a varias IPs."
  echo "Balanceador: el gateway reparte por turnos entre las réplicas sanas."
  echo
  for i in $(seq 1 10); do
    read -r codigo replica <<<"$(consulta)"
    printf '  consulta %2d -> HTTP %s  atendió la réplica %s\n' "$i" "$codigo" "${replica:--}"
  done
}

# escenario <nombre> <comando que provoca la falla> <comando que la repara>
escenario() {
  local nombre="$1" falla="$2" repara="$3"
  local errores=0 inicio t codigo replica marca
  titulo "Escenario: $nombre"
  echo "Falla en la consulta $FALLA_EN:   $falla"
  echo "Reparación en la consulta $REPARA_EN: $repara"
  echo
  inicio=$(date -u +%Y-%m-%dT%H:%M:%SZ)

  for i in $(seq 1 "$CONSULTAS"); do
    marca=""
    if [ "$i" -eq "$FALLA_EN" ]; then
      eval "$falla" >/dev/null 2>&1
      marca="  ${A}<- $falla${N}"
    fi
    if [ "$i" -eq "$REPARA_EN" ]; then
      eval "$repara" >/dev/null 2>&1
      marca="  ${A}<- $repara${N}"
    fi

    t=$(date +%H:%M:%S)
    read -r codigo replica <<<"$(consulta)"
    if [ "$codigo" = "200" ]; then
      printf '  %s  #%-2d %sHTTP %s%s  réplica %s%s\n' "$t" "$i" "$V" "$codigo" "$N" "${replica:--}" "$marca"
    else
      errores=$((errores + 1))
      printf '  %s  #%-2d %sHTTP %s%s  réplica %s%s\n' "$t" "$i" "$R" "$codigo" "$N" "${replica:--}" "$marca"
    fi
    sleep 0.5
  done

  echo
  if [ "$errores" -eq 0 ]; then
    echo "  ${V}${B}Resultado: 0 errores en $CONSULTAS consultas.${N}"
  else
    echo "  ${R}${B}Resultado: $errores errores en $CONSULTAS consultas.${N}"
  fi
  echo
  echo "  Eventos del balanceador en el gateway:"
  docker compose logs gateway --since "$inicio" --no-log-prefix 2>/dev/null |
    grep -E 'Balanceador\]\[servicio-expedientes\]|Retry\]\[servicio-expedientes\]' | sed 's/^/    /'

  # Esperar a que la réplica vuelva a estar en rotación antes del siguiente escenario
  sleep 6
}

login

case "${1:-todo}" in
  reparto) reparto ;;
  stop)    escenario "docker stop (apagado ordenado)" "docker stop $REPLICA" "docker start $REPLICA" ;;
  kill)    escenario "docker kill (corte abrupto, como en el lab S07)" "docker kill $REPLICA" "docker start $REPLICA" ;;
  enferma) escenario "réplica viva pero /health responde 503" \
             "docker exec $REPLICA touch /tmp/doctu-no-sano" \
             "docker exec $REPLICA rm -f /tmp/doctu-no-sano" ;;
  colgada) escenario "réplica colgada (docker pause: el proceso existe pero no responde)" \
             "docker pause $REPLICA" "docker unpause $REPLICA" ;;
  todo)
    reparto
    escenario "docker stop (apagado ordenado)" "docker stop $REPLICA" "docker start $REPLICA"
    escenario "docker kill (corte abrupto, como en el lab S07)" "docker kill $REPLICA" "docker start $REPLICA"
    escenario "réplica viva pero /health responde 503" \
      "docker exec $REPLICA touch /tmp/doctu-no-sano" \
      "docker exec $REPLICA rm -f /tmp/doctu-no-sano"
    escenario "réplica colgada (docker pause: el proceso existe pero no responde)" \
      "docker pause $REPLICA" "docker unpause $REPLICA"
    ;;
  *) echo "Uso: $0 [reparto|stop|kill|enferma|colgada]"; exit 1 ;;
esac
