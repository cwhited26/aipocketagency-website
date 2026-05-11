#!/usr/bin/env bash
# Smoke test for /api/apa/leads.
# Verifies: POST with lead_id (canonical) returns 200 + checkout_url.
# Also exercises the legacy `id` alias to guarantee backward compatibility
# for any in-flight clients with cached JS.
#
# Usage:
#   BASE_URL=https://aipocketagency.com ./scripts/smoke-apa-leads.sh
#   (defaults to https://aipocketagency.com)
#
# Cleanup of the test row(s) in apa_leads is the caller's responsibility:
#   DELETE FROM apa_leads WHERE email LIKE 'smoke+%@aipocketagency.com';

set -euo pipefail

BASE_URL="${BASE_URL:-https://aipocketagency.com}"
ENDPOINT="${BASE_URL%/}/api/apa/leads"

# uuidgen lowercased — UUID v4 per RFC 4122 (matches macOS/Linux uuidgen).
gen_uuid() {
  uuidgen | tr '[:upper:]' '[:lower:]'
}

assert_200_with_checkout() {
  local label="$1"
  local body="$2"
  local response http_code checkout_url

  response="$(curl -s -o /tmp/smoke-apa-leads.body -w '%{http_code}' \
    -X POST "$ENDPOINT" \
    -H 'content-type: application/json' \
    -d "$body")"
  http_code="$response"

  if [[ "$http_code" != "200" ]]; then
    echo "FAIL [$label] expected 200 got $http_code"
    echo "body: $(cat /tmp/smoke-apa-leads.body)"
    exit 1
  fi

  checkout_url="$(sed -E 's/.*"checkout_url":"([^"]+)".*/\1/' /tmp/smoke-apa-leads.body)"
  if [[ -z "$checkout_url" || "$checkout_url" != https://checkout.stripe.com/* ]]; then
    echo "FAIL [$label] missing or non-Stripe checkout_url"
    echo "body: $(cat /tmp/smoke-apa-leads.body)"
    exit 1
  fi

  echo "PASS [$label] 200 + checkout_url -> ${checkout_url:0:60}..."
}

LEAD_ID_CANONICAL="$(gen_uuid)"
LEAD_ID_LEGACY="$(gen_uuid)"
EMAIL_CANONICAL="smoke+canon-${LEAD_ID_CANONICAL:0:8}@aipocketagency.com"
EMAIL_LEGACY="smoke+legacy-${LEAD_ID_LEGACY:0:8}@aipocketagency.com"

assert_200_with_checkout "canonical lead_id" \
  "{\"lead_id\":\"$LEAD_ID_CANONICAL\",\"name\":\"Smoke Canonical\",\"email\":\"$EMAIL_CANONICAL\",\"phone\":\"555-0100\"}"

assert_200_with_checkout "legacy id alias" \
  "{\"id\":\"$LEAD_ID_LEGACY\",\"name\":\"Smoke Legacy\",\"email\":\"$EMAIL_LEGACY\",\"phone\":\"555-0101\",\"source\":\"dispatch-playbook\"}"

# Negative cases: each should return 400 with a clear error.
fail_400_response="$(curl -s -o /tmp/smoke-apa-leads.body -w '%{http_code}' \
  -X POST "$ENDPOINT" \
  -H 'content-type: application/json' \
  -d '{"lead_id":"not-a-uuid","name":"X","email":"x@y.z"}')"
if [[ "$fail_400_response" != "400" ]]; then
  echo "FAIL [bad uuid] expected 400 got $fail_400_response"
  cat /tmp/smoke-apa-leads.body
  exit 1
fi
grep -q "Invalid lead id" /tmp/smoke-apa-leads.body || {
  echo "FAIL [bad uuid] error message did not include 'Invalid lead id'"
  cat /tmp/smoke-apa-leads.body
  exit 1
}
echo "PASS [bad uuid] 400 + clear error"

echo
echo "smoke leads inserted (cleanup in wc-admin Supabase):"
echo "  $LEAD_ID_CANONICAL  $EMAIL_CANONICAL"
echo "  $LEAD_ID_LEGACY     $EMAIL_LEGACY"
