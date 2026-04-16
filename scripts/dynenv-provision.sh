#!/bin/sh
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

printf "${GREEN}Monk Capsules - Provision${NC}\n"
printf "${GREEN}Creating cluster: $CLUSTER_NAME${NC}\n"

# Validate required env vars
for var in CLUSTER_NAME ENVIRONMENT_NAME MONK_CAPSULE_TOKEN MONK_SUBSCRIPTION_API_BASE MONK_AUTH_SERVICE_URL MONK_ORG_SLUG MONK_PROJECT_SLUG CLOUD_PROVIDER CLOUD_REGION CLOUD_INSTANCE_TYPE CLOUD_INSTANCE_COUNT; do
    eval val=\$$var
    if [ -z "$val" ]; then
        printf "${RED}Error: $var is required${NC}\n"
        exit 1
    fi
done

AUTH_HEADER="Authorization: Bearer $MONK_CAPSULE_TOKEN"
REGISTRY_READY_TIMEOUT_SECONDS="${REGISTRY_READY_TIMEOUT_SECONDS:-180}"
REGISTRY_READY_POLL_SECONDS="${REGISTRY_READY_POLL_SECONDS:-10}"

# Mint a short-lived JIT CLI token from the capsule master token
mint_jit_token() {
    local perms="$1"
    local name="${2:-jit-$$}"
    local ttl="${3:-60}"
    if ! JIT_RESPONSE=$(curl -sf -X POST "$MONK_AUTH_SERVICE_URL/api-keys" \
        -H "Authorization: Bearer $MONK_CAPSULE_TOKEN" \
        -H "Content-Type: application/json" \
        -d "{\"name\":\"$name\",\"permissions\":$perms,\"expires_in_minutes\":$ttl}"); then
        printf "${RED}Error: Failed to mint JIT token${NC}\n" >&2
        return 1
    fi
    JIT_TOKEN=$(echo "$JIT_RESPONSE" | jq -r '.jwt // empty')
    if [ -z "$JIT_TOKEN" ]; then
        printf "${RED}Error: JIT token response did not include jwt${NC}\n" >&2
        return 1
    fi
    echo "$JIT_TOKEN"
}

printf "${GREEN}Minting JIT CLI token...${NC}\n"
CLI_PERMS="[\"manage:/projects/$MONK_PROJECT_SLUG/clusters/**\",\"manage:/projects/$MONK_PROJECT_SLUG/secrets/**\",\"manage:/projects/$MONK_PROJECT_SLUG/registry/**\"]"
MONK_JIT_CLI_TOKEN=$(mint_jit_token "$CLI_PERMS" "provision-$CLUSTER_NAME" 90)
if [ -z "$MONK_JIT_CLI_TOKEN" ] || [ "$MONK_JIT_CLI_TOKEN" = "null" ]; then
    printf "${RED}Error: JIT CLI token mint returned empty${NC}\n"
    exit 1
fi
printf "${GREEN}JIT CLI token minted.${NC}\n"

MONKD_STARTED=false

ensure_local_monkd() {
    if [ "$MONKD_STARTED" = "true" ]; then
        return 0
    fi
    printf "${GREEN}Starting Monk daemon...${NC}\n"
    monkd > /tmp/monkd.log 2>&1 &
    printf "${GREEN}Waiting for daemon to initialize (up to 60s)...${NC}\n"
    MONK_WAIT_ELAPSED=0
    while [ $MONK_WAIT_ELAPSED -lt 60 ]; do
        if monk --no-interactive --nofancy --nocolor --json version > /dev/null 2>&1; then
            printf "${GREEN}Daemon responded after ${MONK_WAIT_ELAPSED}s.${NC}\n"
            MONKD_STARTED=true
            sleep 5
            return 0
        fi
        sleep 2
        MONK_WAIT_ELAPSED=$((MONK_WAIT_ELAPSED + 2))
    done
    printf "${RED}Daemon failed to start within 60s. Log:${NC}\n"
    cat /tmp/monkd.log 2>/dev/null || true
    return 1
}

cleanup_stale_cluster() {
    local stale_cluster_id="$1"
    local stale_monkcode="$2"
    local stale_reason="$3"

    [ -n "$stale_cluster_id" ] || return 0

    printf "${YELLOW}Cleaning up stale cluster %s (%s)...${NC}\n" "$stale_cluster_id" "$stale_reason"
    if [ -n "$stale_monkcode" ]; then
        if ensure_local_monkd; then
            if monk cluster join --monkcode "$stale_monkcode" --local-name "stale-cleanup-$$" >/tmp/stale_cluster_join.json 2>/tmp/stale_cluster_join.err; then
                monk cluster nuke --force --remove-volumes --remove-snapshots >/tmp/stale_cluster_nuke.json 2>/tmp/stale_cluster_nuke.err || {
                    printf "${YELLOW}Warning: Failed to nuke stale cluster %s. Continuing with backend cleanup.${NC}\n" "$stale_cluster_id"
                    cat /tmp/stale_cluster_nuke.err 2>/dev/null || true
                }
            else
                printf "${YELLOW}Warning: Failed to join stale cluster %s for cleanup. Continuing with backend cleanup.${NC}\n" "$stale_cluster_id"
                cat /tmp/stale_cluster_join.err 2>/dev/null || true
            fi
        else
            printf "${YELLOW}Warning: Could not start local monkd for stale cluster cleanup. Continuing with backend cleanup only.${NC}\n"
        fi
    fi

    curl -s -o /tmp/stale_cluster_delete_response.json -w "%{http_code}" -X DELETE \
        "$MONK_SUBSCRIPTION_API_BASE/orgs/$MONK_ORG_SLUG/clusters/$stale_cluster_id" \
        -H "$AUTH_HEADER" >/tmp/stale_cluster_delete_http_code.txt 2>/dev/null || true
    STALE_DELETE_HTTP_CODE=$(cat /tmp/stale_cluster_delete_http_code.txt 2>/dev/null || true)
    if [ -n "$STALE_DELETE_HTTP_CODE" ] && [ "$STALE_DELETE_HTTP_CODE" -ge 200 ] && [ "$STALE_DELETE_HTTP_CODE" -lt 300 ]; then
        printf "${GREEN}Removed stale backend cluster record %s.${NC}\n" "$stale_cluster_id"
    elif [ -n "$STALE_DELETE_HTTP_CODE" ] && [ "$STALE_DELETE_HTTP_CODE" != "404" ]; then
        printf "${YELLOW}Warning: Failed to delete stale backend cluster record %s (HTTP %s).${NC}\n" "$stale_cluster_id" "$STALE_DELETE_HTTP_CODE"
        cat /tmp/stale_cluster_delete_response.json 2>/dev/null || true
    fi
}

print_registry_diagnostics() {
    local registry_address="$1"
    printf "${YELLOW}Registry diagnostics for %s:${NC}\n" "$registry_address"
    printf "${YELLOW}- cluster peers${NC}\n"
    monk --json cluster peers 2>/tmp/registry_diag_peers.err || cat /tmp/registry_diag_peers.err 2>/dev/null || true
    printf "${YELLOW}- running workloads${NC}\n"
    monk --json ps 2>/tmp/registry_diag_ps.err || cat /tmp/registry_diag_ps.err 2>/dev/null || true
    printf "${YELLOW}- registry /v2/ probe${NC}\n"
    curl -skS -o /tmp/registry_probe_body.txt -D /tmp/registry_probe_headers.txt -w "HTTP %{http_code}\n" "https://$registry_address/v2/" || true
    cat /tmp/registry_probe_headers.txt 2>/dev/null || true
    cat /tmp/registry_probe_body.txt 2>/dev/null || true
}

# Best-effort: sync backend cluster members into Monk cluster users.
sync_cluster_users() {
    local cluster_id="$1"
    local monkcode="$2"

    if [ -z "$cluster_id" ] || [ -z "$monkcode" ]; then
        printf "${YELLOW}Skipping cluster user sync: cluster ID or monkcode is missing.${NC}\n"
        return 0
    fi

    printf "${GREEN}Syncing cluster users from subscription service...${NC}\n"
    MEMBERS_HTTP_CODE=$(curl -s -o /tmp/cluster_members_response.json -w "%{http_code}" \
        "$MONK_SUBSCRIPTION_API_BASE/orgs/$MONK_ORG_SLUG/clusters/$cluster_id/members" \
        -H "$AUTH_HEADER")
    if [ "$MEMBERS_HTTP_CODE" -lt 200 ] || [ "$MEMBERS_HTTP_CODE" -ge 300 ]; then
        printf "${YELLOW}Warning: Failed to retrieve cluster members for sync (HTTP $MEMBERS_HTTP_CODE). Continuing without sync.${NC}\n"
        cat /tmp/cluster_members_response.json 2>/dev/null || true
        return 0
    fi

    if ! monk --json --no-interactive --nofancy --nocolor -s "monkcode://$monkcode" cluster users list > /tmp/cluster_users_existing_raw.json 2>/tmp/cluster_users_existing.err; then
        printf "${YELLOW}Warning: Failed to list existing cluster users. Continuing without sync.${NC}\n"
        cat /tmp/cluster_users_existing.err 2>/dev/null || true
        return 0
    fi
    tail -n 1 /tmp/cluster_users_existing_raw.json > /tmp/cluster_users_existing.json

    if ! jq -r '
        .[]? |
        [
          ((.email // .Email // .User.Email // "") | tostring | ascii_downcase),
          (((.role // .Role // "member") | tostring | ascii_downcase) | if . == "owner" or . == "admin" then "admin" else "user" end)
        ] |
        select(.[0] != "") |
        @tsv
      ' /tmp/cluster_members_response.json | sort -u > /tmp/cluster_users_desired.tsv; then
        printf "${YELLOW}Warning: Failed to parse desired cluster members for sync. Continuing without sync.${NC}\n"
        return 0
    fi

    if ! jq -r '
        def users_array:
          if type == "array" then .
          elif type == "object" and (.users | type) == "array" then .users
          elif type == "object" and (.Users | type) == "array" then .Users
          elif type == "object" and (.data | type) == "array" then .data
          elif type == "object" and (.result | type) == "array" then .result
          else []
          end;
        users_array[]? |
        [
          ((.email // .Email // "") | tostring | ascii_downcase),
          ((.role // .Role // "user") | tostring | ascii_downcase)
        ] |
        select(.[0] != "") |
        @tsv
      ' /tmp/cluster_users_existing.json | sort -u > /tmp/cluster_users_present.tsv; then
        printf "${YELLOW}Warning: Failed to parse existing cluster users. Continuing without sync.${NC}\n"
        return 0
    fi

    added=0
    updated=0
    removed=0

    while IFS="$(printf '	')" read -r email role; do
        [ -n "$email" ] || continue
        present_role=$(awk -F '	' -v email="$email" '$1 == email { print $2; exit }' /tmp/cluster_users_present.tsv)
        if [ -z "$present_role" ]; then
            if monk --json --no-interactive --nofancy --nocolor -s "monkcode://$monkcode" cluster users add --email "$email" --role "$role" > /tmp/cluster_user_add.json 2>/tmp/cluster_user_add.err; then
                added=$((added + 1))
            else
                printf "${YELLOW}Warning: Failed to add cluster user $email. Continuing.${NC}\n"
                cat /tmp/cluster_user_add.err 2>/dev/null || true
            fi
        elif [ "$present_role" != "$role" ] && [ "$present_role" != "owner" ]; then
            if monk --json --no-interactive --nofancy --nocolor -s "monkcode://$monkcode" cluster users add --email "$email" --role "$role" > /tmp/cluster_user_update.json 2>/tmp/cluster_user_update.err; then
                updated=$((updated + 1))
            else
                printf "${YELLOW}Warning: Failed to update cluster user $email. Continuing.${NC}\n"
                cat /tmp/cluster_user_update.err 2>/dev/null || true
            fi
        fi
    done < /tmp/cluster_users_desired.tsv

    while IFS="$(printf '	')" read -r email role; do
        [ -n "$email" ] || continue
        if [ "$role" = "owner" ]; then
            continue
        fi
        if ! awk -F '	' -v email="$email" '$1 == email { found = 1 } END { exit found ? 0 : 1 }' /tmp/cluster_users_desired.tsv; then
            if monk --json --no-interactive --nofancy --nocolor -s "monkcode://$monkcode" cluster users remove --email "$email" > /tmp/cluster_user_remove.json 2>/tmp/cluster_user_remove.err; then
                removed=$((removed + 1))
            else
                printf "${YELLOW}Warning: Failed to remove cluster user $email. Continuing.${NC}\n"
                cat /tmp/cluster_user_remove.err 2>/dev/null || true
            fi
        fi
    done < /tmp/cluster_users_present.tsv

    printf "${GREEN}Cluster user sync complete (+%s ~%s -%s).${NC}\n" "$added" "$updated" "$removed"
}

# Configure Monk CLI for non-interactive CI usage
export MONK_SERVICE_TOKEN="$MONK_JIT_CLI_TOKEN"
export MONK_CLI_NO_FANCY=true
export MONK_CLI_NO_COLOR=true
export MONK_NO_INTERACTIVE=true

CREATED_CLUSTER=false

cleanup_on_failure() {
    if [ "$CREATED_CLUSTER" = "true" ]; then
        printf "${YELLOW}Provisioning failed, attempting cleanup of newly created cluster...${NC}\n"
        monk cluster nuke --force --remove-volumes --remove-snapshots 2>/dev/null || true
        printf "${YELLOW}Cleanup attempted.${NC}\n"
    else
        printf "${YELLOW}Provisioning failed. Skipping destructive cleanup because no new cluster was created.${NC}\n"
    fi
}
trap cleanup_on_failure ERR

# ============================================================================
# I.A -- Reconcile environment and cluster (idempotent)
# ============================================================================
BRANCH_NAME="${BRANCH_NAME:-$ENVIRONMENT_NAME}"
GITHUB_REPOSITORY="${GITHUB_REPOSITORY:-}"
GITHUB_ENVIRONMENT="${GITHUB_ENVIRONMENT:-capsule-$ENVIRONMENT_NAME}"
NOW_UTC="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
ENV_PATH="$MONK_SUBSCRIPTION_API_BASE/orgs/$MONK_ORG_SLUG/projects/$MONK_PROJECT_SLUG/environments/$ENVIRONMENT_NAME"

ENV_EXISTS=false
USE_EXISTING_CLUSTER=false
REGISTRY_SETUP_REQUIRED=false
ENV_CLUSTER_ID=""
CLUSTER_ID=""
MONKCODE=""

printf "${GREEN}Checking if environment exists: $ENVIRONMENT_NAME...${NC}\n"
ENV_HTTP_CODE=$(curl -s -o /tmp/existing_env_response.json -w "%{http_code}" "$ENV_PATH" \
    -H "$AUTH_HEADER")
if [ "$ENV_HTTP_CODE" = "200" ]; then
    ENV_EXISTS=true
    ENV_CLUSTER_ID=$(jq -r '.cluster.clusterId // .clusterExternalId // empty' /tmp/existing_env_response.json)
    MONKCODE=$(jq -r '.cluster.monkcode // empty' /tmp/existing_env_response.json)
    if [ -n "$ENV_CLUSTER_ID" ] && [ -n "$MONKCODE" ]; then
        CLUSTER_ID="$ENV_CLUSTER_ID"
        USE_EXISTING_CLUSTER=true
        printf "${GREEN}Found existing environment linked to cluster $CLUSTER_ID. Reusing.${NC}\n"
    else
        printf "${YELLOW}Environment exists but has no usable cluster link. Will provision and relink.${NC}\n"
    fi
elif [ "$ENV_HTTP_CODE" = "404" ]; then
    printf "${GREEN}Environment does not exist yet. Will create it.${NC}\n"
else
    printf "${RED}Error: Failed to query environment (HTTP $ENV_HTTP_CODE)${NC}\n"
    cat /tmp/existing_env_response.json 2>/dev/null || true
    exit 1
fi

# Fast path: if environment already has a linked, reachable cluster with registry secret,
# skip expensive provisioning and continue workflow with existing resources.
if [ "$ENV_EXISTS" = "true" ] && [ "$USE_EXISTING_CLUSTER" = "true" ]; then
    printf "${GREEN}Checking whether existing capsule cluster is already provisioned...${NC}\n"
    export MONK_SOCKET="monkcode://$MONKCODE"
    if monk --json secrets get -r system/registry registry-auth >/tmp/existing_registry_secret_check.json 2>&1; then
        printf "${GREEN}Existing capsule is already provisioned. Ensuring cluster record is up to date...${NC}\n"
        curl -s -o /dev/null -w "" -X POST "$MONK_SUBSCRIPTION_API_BASE/orgs/$MONK_ORG_SLUG/clusters" \
            -H "$AUTH_HEADER" \
            -H "Content-Type: application/json" \
            -d "{\"clusterId\":\"$CLUSTER_ID\",\"name\":\"$CLUSTER_NAME\",\"monkcode\":\"$MONKCODE\",\"projectSlug\":\"$MONK_PROJECT_SLUG\"}" || true
        sync_cluster_users "$CLUSTER_ID" "$MONKCODE"
        printf "${GREEN}Skipping provisioning step.${NC}\n"
        exit 0
    fi
    printf "${YELLOW}Existing capsule cluster is missing registry setup or unreachable. Continuing reconciliation.${NC}\n"
    REGISTRY_SETUP_REQUIRED=true
fi

if [ "$USE_EXISTING_CLUSTER" != "true" ] && [ "$ENV_EXISTS" != "true" ]; then
    printf "${GREEN}Checking for an existing cluster record named $CLUSTER_NAME...${NC}\n"
    CLUSTERS_HTTP_CODE=$(curl -s -o /tmp/existing_clusters_response.json -w "%{http_code}" \
        "$MONK_SUBSCRIPTION_API_BASE/orgs/$MONK_ORG_SLUG/clusters" \
        -H "$AUTH_HEADER")
    if [ "$CLUSTERS_HTTP_CODE" -ge 200 ] && [ "$CLUSTERS_HTTP_CODE" -lt 300 ]; then
        CANDIDATE_CLUSTER_ID=$(jq -r --arg name "$CLUSTER_NAME" '[.[] | select((.name // "") == $name)][0].clusterId // empty' /tmp/existing_clusters_response.json)
        CANDIDATE_MONKCODE=$(jq -r --arg name "$CLUSTER_NAME" '[.[] | select((.name // "") == $name)][0].monkcode // empty' /tmp/existing_clusters_response.json)
        if [ -n "$CANDIDATE_CLUSTER_ID" ] && [ -n "$CANDIDATE_MONKCODE" ]; then
            CLUSTER_ID="$CANDIDATE_CLUSTER_ID"
            MONKCODE="$CANDIDATE_MONKCODE"
            USE_EXISTING_CLUSTER=true
            printf "${GREEN}Found existing cluster record $CLUSTER_ID by name. Reusing.${NC}\n"
        fi
    else
        printf "${YELLOW}Warning: Could not list org clusters (HTTP $CLUSTERS_HTTP_CODE). Continuing with fresh provisioning.${NC}\n"
    fi
fi

if [ "$USE_EXISTING_CLUSTER" != "true" ]; then
    if [ -n "$ENV_CLUSTER_ID" ] && [ "$ENV_CLUSTER_ID" != "$CLUSTER_ID" ]; then
        cleanup_stale_cluster "$ENV_CLUSTER_ID" "$MONKCODE" "environment linked to unusable cluster"
        ENV_CLUSTER_ID=""
        MONKCODE=""
    fi

    printf "${GREEN}Checking for additional stale cluster records for environment %s...${NC}\n" "$ENVIRONMENT_NAME"
    CLUSTERS_HTTP_CODE=$(curl -s -o /tmp/stale_clusters_response.json -w "%{http_code}" \
        "$MONK_SUBSCRIPTION_API_BASE/orgs/$MONK_ORG_SLUG/clusters" \
        -H "$AUTH_HEADER")
    if [ "$CLUSTERS_HTTP_CODE" -ge 200 ] && [ "$CLUSTERS_HTTP_CODE" -lt 300 ]; then
        jq -cr --arg name "$CLUSTER_NAME" --arg keep_id "$CLUSTER_ID" '
            .[] | select((.name // "") == $name) | select((.clusterId // "") != $keep_id) | {clusterId: (.clusterId // ""), monkcode: (.monkcode // "")} | @base64
        ' /tmp/stale_clusters_response.json | while IFS= read -r encoded; do
            [ -z "$encoded" ] && continue
            stale_row="$(printf "%s" "$encoded" | base64 -d)"
            stale_cluster_id="$(printf "%s" "$stale_row" | jq -r '.clusterId // empty')"
            stale_monkcode="$(printf "%s" "$stale_row" | jq -r '.monkcode // empty')"
            cleanup_stale_cluster "$stale_cluster_id" "$stale_monkcode" "duplicate cluster name for environment"
        done
    else
        printf "${YELLOW}Warning: Failed to inspect stale cluster records (HTTP $CLUSTERS_HTTP_CODE). Continuing.${NC}\n"
    fi
fi

if [ "$USE_EXISTING_CLUSTER" = "true" ]; then
    printf "${GREEN}Connecting to existing cluster via MONK_SOCKET...${NC}\n"
    export MONK_SOCKET="monkcode://$MONKCODE"
    if monk --json cluster info >/tmp/existing_cluster_info.json 2>&1; then
        printf "${GREEN}Connected to existing cluster.${NC}\n"
    else
        printf "${YELLOW}Warning: Failed to reach existing cluster via MONK_SOCKET. Falling back to fresh provisioning.${NC}\n"
        USE_EXISTING_CLUSTER=false
        CLUSTER_ID=""
        MONKCODE=""
        unset MONK_SOCKET
    fi
fi

if [ "$USE_EXISTING_CLUSTER" = "true" ] && [ "$REGISTRY_SETUP_REQUIRED" != "true" ]; then
    printf "${GREEN}Checking registry credentials on existing cluster...${NC}\n"
    if monk --json secrets get -r system/registry registry-auth >/tmp/existing_registry_secret_check.json 2>&1; then
        printf "${GREEN}Existing cluster already has registry credentials.${NC}\n"
    else
        printf "${YELLOW}Registry credentials missing on existing cluster. Will configure registry on this cluster.${NC}\n"
        REGISTRY_SETUP_REQUIRED=true
    fi
fi

if [ "$USE_EXISTING_CLUSTER" != "true" ] || [ "$REGISTRY_SETUP_REQUIRED" = "true" ]; then
    if [ "$USE_EXISTING_CLUSTER" != "true" ]; then
        unset MONK_SOCKET
        ensure_local_monkd

        # A.2 Create new cluster
        printf "${GREEN}Creating new cluster: $CLUSTER_NAME...${NC}\n"
        monk cluster new -n "$CLUSTER_NAME"
        CREATED_CLUSTER=true

        # A.3 Inject cloud provider credentials
        printf "${GREEN}Adding cloud provider: $CLOUD_PROVIDER...${NC}\n"
case "$CLOUD_PROVIDER" in
    digitalocean)
        monk cluster provider add --provider digitalocean --digitalocean-token "$DO_API_TOKEN"
        ;;
    aws)
        monk cluster provider add --provider aws --access-key "$AWS_ACCESS_KEY_ID" --secret-key "$AWS_SECRET_ACCESS_KEY"
        ;;
    azure)
        (
            AZURE_SDK_AUTH_FILE="$(mktemp)"
            cleanup() { rm -f "$AZURE_SDK_AUTH_FILE"; }
            trap cleanup EXIT
            printf '%s' "$AZURE_SDK_AUTH" > "$AZURE_SDK_AUTH_FILE"
            monk cluster provider add --provider azure --azure-sdk-auth "$AZURE_SDK_AUTH_FILE" --azure-resource-group "$AZURE_RESOURCE_GROUP"
        )
        ;;
    gcp)
        (
            GCP_SERVICE_ACCOUNT_FILE="$(mktemp)"
            cleanup() { rm -f "$GCP_SERVICE_ACCOUNT_FILE"; }
            trap cleanup EXIT
            printf '%s' "$GCP_SERVICE_ACCOUNT_KEY" > "$GCP_SERVICE_ACCOUNT_FILE"
            monk cluster provider add --provider gcp --service-account-file "$GCP_SERVICE_ACCOUNT_FILE"
        )
        ;;
    *)
        printf "${RED}Error: Unknown cloud provider: $CLOUD_PROVIDER${NC}\n"
        exit 1
        ;;
esac

        # A.4 Grow cluster (provision instances)
        if [ "$CLOUD_PROVIDER" = "digitalocean" ] && [ -z "$CLOUD_INSTANCE_TYPE" ]; then
            CLOUD_INSTANCE_TYPE="s-2vcpu-4gb"
            printf "${YELLOW}Defaulting DigitalOcean instance type to %s for improved stability.${NC}\n" "$CLOUD_INSTANCE_TYPE"
        fi
        printf "${GREEN}Growing cluster ($CLOUD_INSTANCE_COUNT x $CLOUD_INSTANCE_TYPE in $CLOUD_REGION)...${NC}\n"
        DISK_SIZE_FLAG=""
        if [ -n "$CLOUD_DISK_SIZE" ] && [ "$CLOUD_PROVIDER" != "digitalocean" ]; then
            DISK_SIZE_FLAG="--disk-size $CLOUD_DISK_SIZE"
        fi
        monk cluster grow \
            --name "$CLUSTER_NAME" \
            --tag "$BRANCH_TAG" \
            --provider "$CLOUD_PROVIDER" \
            --region "$CLOUD_REGION" \
            --instance-type "$CLOUD_INSTANCE_TYPE" \
            --num-instances "$CLOUD_INSTANCE_COUNT" \
            --generate-domain \
            --generate-ssl-cert \
            $DISK_SIZE_FLAG

        # A.5 Extract cluster info
        printf "${GREEN}Extracting cluster information...${NC}\n"
        CLUSTER_INFO=$(monk --json cluster info 2>&1 | tail -n 1)
        MONKCODE=$(echo "$CLUSTER_INFO" | jq -r '.data.monkcode')
        CLUSTER_ID=$(echo "$CLUSTER_INFO" | jq -r '.data.id')

        if [ -z "$MONKCODE" ] || [ "$MONKCODE" = "null" ]; then
            printf "${RED}Error: Failed to extract monkcode from cluster info${NC}\n"
            exit 1
        fi
        printf "${GREEN}Cluster ready. ID: $CLUSTER_ID${NC}\n"

        # A.5.1 Enable ingress plugin
        printf "${GREEN}Enabling ingress plugin...${NC}\n"
        monk plugins enable ingress || printf "${YELLOW}Warning: Failed to enable ingress plugin (non-blocking)${NC}\n"
        REGISTRY_SETUP_REQUIRED=true
    fi

    if [ "$REGISTRY_SETUP_REQUIRED" = "true" ]; then
        # A.6 Set up per-cluster container registry
        printf "${GREEN}Setting up container registry...${NC}\n"

        # A.6.1 Ensure a peer has the "system" tag (registry runs on the system-tagged peer)
        printf "${GREEN}Ensuring system tag on a cluster peer...${NC}\n"
        PEERS_JSON=$(monk --json cluster peers)
        SYSTEM_PEER_ID=$(echo "$PEERS_JSON" | jq -r '[.[] | select(.tags != null and (.tags | contains(["system"])))][0].id // empty')
        if [ -z "$SYSTEM_PEER_ID" ]; then
            SYSTEM_PEER_ID=$(echo "$PEERS_JSON" | jq -r '[.[] | select(.name != "local")][0].id // empty')
            if [ -z "$SYSTEM_PEER_ID" ]; then
                printf "${RED}Error: No suitable peer found for system tag${NC}\n"
                exit 1
            fi
            EXISTING_TAGS=$(echo "$PEERS_JSON" | jq -r --arg id "$SYSTEM_PEER_ID" '[.[] | select(.id == $id)][0].tags // [] | join(",")')
            if [ -n "$EXISTING_TAGS" ]; then
                SYSTEM_TAGS="system,$EXISTING_TAGS"
            else
                SYSTEM_TAGS="system"
            fi
            monk cluster peer-tags --id "$SYSTEM_PEER_ID" --tag "$SYSTEM_TAGS"
            printf "${GREEN}Tagged peer $SYSTEM_PEER_ID with system tag.${NC}\n"
        else
            printf "${GREEN}System-tagged peer already exists: $SYSTEM_PEER_ID${NC}\n"
        fi

        SYSTEM_PEER_DOMAIN=$(echo "$PEERS_JSON" | jq -r --arg id "$SYSTEM_PEER_ID" '[.[] | select(.id == $id)][0].domain // empty')
        if [ -z "$SYSTEM_PEER_DOMAIN" ]; then
            printf "${RED}Error: No domain found for system peer. Ensure --generate-domain was used during grow.${NC}\n"
            exit 1
        fi

        # A.6.2 Load registry template
        REGISTRY_TEMPLATE_PATH="${REGISTRY_TEMPLATE_PATH:-scripts/registry-template.yaml}"
        if [ ! -f "$REGISTRY_TEMPLATE_PATH" ]; then
            printf "${RED}Error: Registry template not found at $REGISTRY_TEMPLATE_PATH${NC}\n"
            exit 1
        fi
        monk load "$REGISTRY_TEMPLATE_PATH"

        # A.6.3 Generate registry credentials and htpasswd
        REGISTRY_USERNAME="monk"
        REGISTRY_PASSWORD=$(head -c 16 /dev/urandom | base64 | tr -dc 'a-zA-Z0-9' | head -c 16)
        # Generate bcrypt hash compatible with nginx (htpasswd installed via workflow step)
        HTPASSWD=$(htpasswd -nbBC 10 "$REGISTRY_USERNAME" "$REGISTRY_PASSWORD")
        # Ensure nginx-compatible $2y$ prefix
        HTPASSWD=$(echo "$HTPASSWD" | sed 's/\$2b\$/\$2y\$/;s/\$2a\$/\$2y\$/')
        monk secrets add -r system/nginx "htpasswd=$HTPASSWD"

        # A.6.4 Run registry and nginx services on system-tagged peer
        printf "${GREEN}Starting registry service...${NC}\n"
        monk run -t system system/registry
        printf "${GREEN}Starting nginx proxy...${NC}\n"
        monk run -t system system/nginx

        # A.6.5 Determine registry address and configure docker login
        REGISTRY_PORT=7080
        REGISTRY_ADDRESS="${SYSTEM_PEER_DOMAIN}:${REGISTRY_PORT}"
        printf "${GREEN}Registry available at: $REGISTRY_ADDRESS${NC}\n"

        # Wait for registry to be ready and configure docker login
        REGISTRY_MAX_RETRIES=$((REGISTRY_READY_TIMEOUT_SECONDS / REGISTRY_READY_POLL_SECONDS))
        [ "$REGISTRY_MAX_RETRIES" -le 0 ] && REGISTRY_MAX_RETRIES=1
        RETRIES=0
        REGISTRY_READY=false
        while [ "$RETRIES" -lt "$REGISTRY_MAX_RETRIES" ]; do
            RETRIES=$((RETRIES + 1))
            printf "  Waiting for registry to be ready (attempt %s/%s, ~%ss timeout)...\n" "$RETRIES" "$REGISTRY_MAX_RETRIES" "$REGISTRY_READY_TIMEOUT_SECONDS"
            REGISTRY_HTTP_CODE=$(curl -skS -o /tmp/registry_probe_body.txt -w "%{http_code}" "https://$REGISTRY_ADDRESS/v2/" || true)
            if [ "$REGISTRY_HTTP_CODE" = "200" ] || [ "$REGISTRY_HTTP_CODE" = "401" ]; then
                if monk registry --server "$REGISTRY_ADDRESS" -u "$REGISTRY_USERNAME" -p "$REGISTRY_PASSWORD" -a registry.local 2>/tmp/registry_login.err; then
                    REGISTRY_READY=true
                    break
                fi
                printf "${YELLOW}Registry endpoint is reachable but login is not ready yet.${NC}\n"
                cat /tmp/registry_login.err 2>/dev/null || true
            else
                printf "${YELLOW}Registry probe returned HTTP %s; still waiting.${NC}\n" "${REGISTRY_HTTP_CODE:-unknown}"
            fi
            sleep "$REGISTRY_READY_POLL_SECONDS"
            if monk registry --server "$REGISTRY_ADDRESS" -u "$REGISTRY_USERNAME" -p "$REGISTRY_PASSWORD" -a registry.local 2>/dev/null; then
                REGISTRY_READY=true
                break
            fi
        done
        if [ "$REGISTRY_READY" != "true" ]; then
            printf "${RED}Error: Registry did not become ready within %ss${NC}\n" "$REGISTRY_READY_TIMEOUT_SECONDS"
            print_registry_diagnostics "$REGISTRY_ADDRESS"
            exit 1
        fi
        printf "${GREEN}Docker login configured for registry.${NC}\n"

        # A.6.6 Store registry credentials as a cluster secret for later retrieval
        REGISTRY_CREDS_JSON=$(printf '{"username":"%s","password":"%s","address":"%s","domain":"%s","source":"auto","tlsVerify":true}' \
            "$REGISTRY_USERNAME" "$REGISTRY_PASSWORD" "$REGISTRY_ADDRESS" "$SYSTEM_PEER_DOMAIN")
        monk secrets add -r system/registry "registry-auth=$REGISTRY_CREDS_JSON"
        printf "${GREEN}Registry credentials stored as cluster secret.${NC}\n"
    fi
fi

# A.7 Inject workload secrets
if [ -n "$WORKLOAD_SECRETS" ]; then
    printf "${GREEN}Seeding workload secrets into cluster...${NC}\n"
    for mapping in $WORKLOAD_SECRETS; do
        MONK_NAME=$(echo "$mapping" | cut -d: -f1)
        ENV_NAME=$(echo "$mapping" | cut -d: -f2)
        eval SECRET_VALUE=\$$ENV_NAME
        if [ -n "$SECRET_VALUE" ]; then
            monk secrets add -g "$MONK_NAME=$SECRET_VALUE"
        else
            printf "${YELLOW}Warning: $ENV_NAME is empty, skipping $MONK_NAME${NC}\n"
        fi
    done
    printf "${GREEN}Workload secrets configured.${NC}\n"
else
    printf "${YELLOW}No workload secrets to seed.${NC}\n"
fi

# ============================================================================
# I.B -- Create and populate environment in backend
# ============================================================================
printf "${GREEN}Syncing with subscription service...${NC}\n"

# B.1 Upsert cluster record
printf "${GREEN}Registering cluster in backend...${NC}\n"
HTTP_CODE=$(curl -s -o /tmp/cluster_response.json -w "%{http_code}" -X POST "$MONK_SUBSCRIPTION_API_BASE/orgs/$MONK_ORG_SLUG/clusters" \
    -H "$AUTH_HEADER" \
    -H "Content-Type: application/json" \
    -d "{\"clusterId\":\"$CLUSTER_ID\",\"name\":\"$CLUSTER_NAME\",\"monkcode\":\"$MONKCODE\",\"projectSlug\":\"$MONK_PROJECT_SLUG\"}")
if [ "$HTTP_CODE" -lt 200 ] || [ "$HTTP_CODE" -ge 300 ]; then
    printf "${RED}Error: Failed to register cluster in backend (HTTP $HTTP_CODE)${NC}\n"
    cat /tmp/cluster_response.json 2>/dev/null || true
    exit 1
fi
printf "${GREEN}Cluster registered.${NC}\n"

# B.2 Ensure environment exists and is linked to the resolved cluster
CAPSULE_SETTINGS_PAYLOAD=$(jq -n \
    --arg branch "$BRANCH_NAME" \
    --arg repository "$GITHUB_REPOSITORY" \
    --arg githubEnvironment "$GITHUB_ENVIRONMENT" \
    --arg status "provisioned" \
    --arg now "$NOW_UTC" \
    '{
      settings: {
        capsule: {
          source: "dynenv",
          branch: $branch,
          repository: $repository,
          githubEnvironment: $githubEnvironment,
          status: $status,
          updatedAt: $now
        }
      }
    }')

if [ "$ENV_EXISTS" = "true" ]; then
    printf "${GREEN}Environment exists. Reconciling link and metadata...${NC}\n"
    if [ -z "$ENV_CLUSTER_ID" ] || [ "$ENV_CLUSTER_ID" != "$CLUSTER_ID" ]; then
        LINK_HTTP_CODE=$(curl -s -o /tmp/env_link_response.json -w "%{http_code}" -X PUT "$ENV_PATH/cluster" \
            -H "$AUTH_HEADER" \
            -H "Content-Type: application/json" \
            -d "{\"clusterId\":\"$CLUSTER_ID\",\"force\":true}")
        if [ "$LINK_HTTP_CODE" -lt 200 ] || [ "$LINK_HTTP_CODE" -ge 300 ]; then
            printf "${RED}Error: Failed to link environment to cluster (HTTP $LINK_HTTP_CODE)${NC}\n"
            cat /tmp/env_link_response.json 2>/dev/null || true
            exit 1
        fi
        ENV_CLUSTER_ID="$CLUSTER_ID"
        printf "${GREEN}Environment linked to cluster $CLUSTER_ID.${NC}\n"
    else
        printf "${GREEN}Environment already linked to cluster $CLUSTER_ID.${NC}\n"
    fi

    PATCH_HTTP_CODE=$(curl -s -o /tmp/env_patch_response.json -w "%{http_code}" -X PATCH "$ENV_PATH" \
        -H "$AUTH_HEADER" \
        -H "Content-Type: application/json" \
        -d "$CAPSULE_SETTINGS_PAYLOAD")
    if [ "$PATCH_HTTP_CODE" -lt 200 ] || [ "$PATCH_HTTP_CODE" -ge 300 ]; then
        printf "${RED}Error: Failed to update capsule metadata (HTTP $PATCH_HTTP_CODE)${NC}\n"
        cat /tmp/env_patch_response.json 2>/dev/null || true
        exit 1
    fi
    printf "${GREEN}Environment metadata updated.${NC}\n"
else
    printf "${GREEN}Creating environment: $ENVIRONMENT_NAME...${NC}\n"
    ENV_CREATE_PAYLOAD=$(jq -n \
        --arg name "$ENVIRONMENT_NAME" \
        --arg clusterId "$CLUSTER_ID" \
        --arg projectSlug "$MONK_PROJECT_SLUG" \
        --arg branch "$BRANCH_NAME" \
        --arg repository "$GITHUB_REPOSITORY" \
        --arg githubEnvironment "$GITHUB_ENVIRONMENT" \
        --arg status "provisioned" \
        --arg now "$NOW_UTC" \
        '{
          name: $name,
          clusterId: $clusterId,
          projectSlug: $projectSlug,
          settings: {
            capsule: {
              source: "dynenv",
              branch: $branch,
              repository: $repository,
              githubEnvironment: $githubEnvironment,
              status: $status,
              updatedAt: $now
            }
          }
        }')
    HTTP_CODE=$(curl -s -o /tmp/env_response.json -w "%{http_code}" -X POST "$MONK_SUBSCRIPTION_API_BASE/orgs/$MONK_ORG_SLUG/environments" \
        -H "$AUTH_HEADER" \
        -H "Content-Type: application/json" \
        -d "$ENV_CREATE_PAYLOAD")
    if [ "$HTTP_CODE" -lt 200 ] || [ "$HTTP_CODE" -ge 300 ]; then
        printf "${RED}Error: Failed to create environment in backend (HTTP $HTTP_CODE)${NC}\n"
        cat /tmp/env_response.json 2>/dev/null || true
        exit 1
    fi
    ENV_EXISTS=true
    ENV_CLUSTER_ID="$CLUSTER_ID"
    printf "${GREEN}Environment created and linked to cluster.${NC}\n"
fi

sync_cluster_users "$CLUSTER_ID" "$MONKCODE"

# B.3 Registry credentials are stored as cluster secrets (step A.6.6),
# and retrieved via monk secrets get in the fetch-metadata workflow job.

# ============================================================================
# I.C -- Exit cluster to avoid runner remaining as a connected peer
# ============================================================================
printf "${GREEN}Exiting cluster (local node disconnect)...${NC}\n"
monk cluster exit --force
printf "${GREEN}Disconnected from cluster.${NC}\n"

printf "${GREEN}Provisioning complete! Cluster $CLUSTER_NAME is ready.${NC}\n"
