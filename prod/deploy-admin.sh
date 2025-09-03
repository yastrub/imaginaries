#!/usr/bin/env bash
set -Eeuo pipefail

# Configuration
APP_NAME=imaginaries-admin
EXPOSE_PORT=7770
GIT_REPO="git@github.com:yastrub/imaginaries.git"
ENV_FILENAME=".env.admin"

# Get the script directory (where deploy.sh is located)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Use absolute paths for directories
GIT_DIR="$SCRIPT_DIR/git"
APP_DIR="$GIT_DIR/apps/admin"
BACKUP_DIR="$SCRIPT_DIR/backups/admin"
MAX_BACKUPS=3  # Maximum number of backups to keep
DEBUG=false  # Enable debug output

# Get real user's home directory even when run with sudo
if [ -n "$SUDO_USER" ]; then
    REAL_USER="$SUDO_USER"
    REAL_HOME="$(getent passwd "$SUDO_USER" | cut -d: -f6)"
else
    REAL_USER="$(whoami)"
    REAL_HOME="$HOME"
fi

SSH_KEY="$REAL_HOME/.ssh/id_rsa"  # Default SSH key path

# Color codes
RED="\033[0;31m"
GREEN="\033[0;32m"
YELLOW="\033[1;33m"  # Bold yellow
BLUE="\033[0;34m"
CYAN="\033[0;36m"
WHITE="\033[0;37m"
RESET="\033[0m"
PURPLE="\033[0;35m"

# Print functions
print_header() {
    echo -e "\n${CYAN}=== $1 ===${RESET}\n"
}

print_success() {
    echo -e "${GREEN}✓ $1${RESET}"
}

print_error() {
    echo -e "${RED}✗ $1${RESET}"
}

print_debug() {
    if [ "$DEBUG" = "true" ]; then
        echo -e "${WHITE}DEBUG: $1${RESET}"
    fi
}

print_action() {
    echo -e "${YELLOW}⚡ $1${RESET}"
}

print_info() {
    echo -e "${PURPLE}ⓘ $1${RESET}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${RESET}"
}

# Highlight npm output: WARN/notice/deprecation in yellow, ERR! in red
highlight_npm() {
    while IFS= read -r line; do
        # Remove any existing ANSI color codes so we control the final color
        # Requires perl, which is present on Ubuntu images by default
        local clean
        clean=$(printf '%s' "$line" | perl -pe '
            s/\e\[[0-9;]*[a-zA-Z]//g;                 # strip ANSI
            s/^#[0-9]+(\s[0-9]+(\.[0-9]+)?)?\s+//;    # strip BuildKit prefixes like "#16 " or "#16 160.2 "
        ')
        # lowercase copy for case-insensitive checks
        local lower
        lower="${clean,,}"
        if [[ "$lower" == *"npm err!"* ]] || [[ "$lower" == *"npm error"* ]]; then
            echo -e "${RED}${clean}${RESET}"
        elif [[ "$lower" == *"npm warn"* ]] || [[ "$lower" == *"npm notice"* ]] || [[ "$lower" == *"deprecated"* ]] || [[ "$lower" == *"deprecationwarning"* ]]; then
            echo -e "${YELLOW}${clean}${RESET}"
        else
            echo -e "${clean}${RESET}"
        fi
    done
}

# Check if running with sudo
if [ "$EUID" -ne 0 ]; then 
    print_error "Please run this script with sudo"
    exit 1
fi

# New function for git command output
print_output() {
    # Split output into lines and prefix each with "=> "
    while IFS= read -r line; do
        echo -e "${BLUE}=> $line${RESET}"
    done <<< "$1"
}

# Initialize required directories
init_directories() {
    print_header "Initializing Directories"
    
    # Create app directory if it doesn't exist
    if [ ! -d "${APP_DIR}" ]; then
        print_action "Creating ${APP_DIR} directory as ${REAL_USER}..."
        sudo -u "$REAL_USER" mkdir -p "${APP_DIR}"
    fi
    
    # Create deployments directory if it doesn't exist
    if [ ! -d "${BACKUP_DIR}" ]; then
        print_action "Creating ${BACKUP_DIR} directory as ${REAL_USER}..."
        sudo -u "$REAL_USER" mkdir -p "${BACKUP_DIR}"
    fi
    
    # Ensure ownership is correct for REAL_USER
    chown -R "$REAL_USER:$REAL_USER" "${APP_DIR}" "${BACKUP_DIR}" 2>/dev/null || true
    
    print_success "Directories initialized"
}

# Check if Docker is running
check_docker() {
    print_header "Checking Docker"
    if ! docker info > /dev/null 2>&1; then
        print_error "Docker is not running. Please start Docker and try again."
    fi
    print_success "Docker is running"
}

# Stop and remove existing containers
cleanup_containers() {
    print_header "Cleaning up existing containers"
    
    # Stop and remove Next.js App container with exact name match
    local ids
    ids=$(docker ps -aq -f name="^${APP_NAME}$")
    if [ -n "$ids" ]; then
        print_action "Stopping/removing existing Next.js App container ${APP_NAME}..."
        docker rm -f $ids >/dev/null 2>&1 || true
    fi
    
    print_success "Cleanup completed"
}

# Build and deploy Next.js App
deploy() {
    print_header "Deploying Next.js App"
    
    cd "${APP_DIR}" || print_error "App directory not found: ${APP_DIR}"
    
    # Determine which env file to pass as BuildKit secret for build-time inlining
    local env_secret_arg=""
    if [ -f "$SCRIPT_DIR/${ENV_FILENAME}" ]; then
        env_secret_arg="--secret id=appenv,src=$SCRIPT_DIR/${ENV_FILENAME}"
        print_info "Using BuildKit secret: $SCRIPT_DIR/${ENV_FILENAME}"
    else
        print_warning "No ${ENV_FILENAME} found in $SCRIPT_DIR; build will not receive client envs via secret"
    fi

    print_action "Building Next.js App production image..."
    if ! DOCKER_BUILDKIT=1 docker build --progress=plain $env_secret_arg -f "${APP_DIR}/Dockerfile" -t ${APP_NAME}:prod "${APP_DIR}" 2>&1 | highlight_npm; then
        print_error "Failed to build Next.js App image"
    fi
    
    # Prepare env-file argument (used for both temp and final runs)
    print_action "Preparing environment for container startup..."
    local env_file_arg=""
    if [ -f "${APP_DIR}/.env" ]; then
        env_file_arg="--env-file ${APP_DIR}/.env"
        print_info "Using env file: ${APP_DIR}/.env"
    else
        print_warning "No .env found under ${APP_DIR}; relying on baked-in env and defaults"
    fi

    # Start a temporary container on a secondary port for health-check (near-zero downtime)
    local app="${APP_NAME:?APP_NAME must be set}"
    local primary_port="${EXPOSE_PORT:?EXPOSE_PORT must be set}"
    local temp_name="${app}-new"
    local temp_port=$((primary_port+1))

    # --------- ensure no stale temp container ---------
    local temp_ids
    temp_ids="$(docker ps -aq --filter "name=^${temp_name}$" || true)"
    if [[ -n "${temp_ids}" ]]; then
        print_action "Removing stale temp container ${temp_name}..."
        docker rm -f ${temp_ids} >/dev/null 2>&1 || true
    fi

    # --------- start temp container on secondary port ---------
    print_action "Starting temporary container ${temp_name} on port ${temp_port} for health-check..."

    # build docker args safely (handles optional env file)
    local -a run_args=(
        -d
        --name "${temp_name}"
        -p "${temp_port}:3000"
        --restart unless-stopped
        -e NEXT_TELEMETRY_DISABLED=1
    )
    if [[ -n "${env_file_arg:-}" ]]; then
        # if env_file_arg already includes '--env-file', keep it verbatim; else add flag
        if [[ "${env_file_arg}" == --env-file* ]]; then
        # shellcheck disable=SC2206
        run_args+=( ${env_file_arg} )
        else
        run_args+=( --env-file "${env_file_arg}" )
        fi
    fi
    run_args+=( "${app}:prod" )

    if ! docker run "${run_args[@]}"; then
        print_error "Failed to start temporary container ${temp_name}"
        return 1
    fi

    # --------- TEMP CONTAINER HEALTH CHECK (2 consecutive OKs) ---------
    health_check_temp() {
        local temp_name="${1:?temp_name required}"
        local temp_port="${2:?temp_port required}"

        # small helper to curl with timeouts and never hard-fail under set -e
        _http_code() {
            local url="$1"
            curl -s -o /dev/null -w '%{http_code}' -L \
                --connect-timeout 2 --max-time 3 \
                "$url" || echo 000
        }

        print_action "Health-checking ${temp_name} at http://127.0.0.1:${temp_port} ..."
        local url="http://127.0.0.1:${temp_port}"
        local http_code="000"
        local ok_streak=0

        for _ in $(seq 1 30); do
            http_code="$(_http_code "${url}")"
            if [[ "${http_code}" =~ ^(200|30[12478])$ ]]; then
                ((ok_streak++))
                if (( ok_streak >= 2 )); then
                    print_success "${temp_name} is healthy (HTTP ${http_code})"
                    return 0
                fi
            else
                ok_streak=0
            fi
            sleep 2
        done

        # failed
        print_error "Temporary container failed health-check; keeping existing deployment running"
        print_action "Recent logs from ${temp_name}:"
        docker logs --tail=100 "${temp_name}" 2>&1 | highlight_npm || true
        docker rm -f "${temp_name}" >/dev/null 2>&1 || true
        return 1
    }

    health_check_temp "${temp_name}" "${temp_port}" || return 1

    # --------- swap traffic to primary port ---------
    print_action "Swapping traffic to new version on port ${primary_port}..."

    local old_ids
    old_ids="$(docker ps -aq --filter "name=^${app}$" || true)"
    if [[ -n "${old_ids}" ]]; then
        print_action "Stopping/removing existing container ${app}..."
        docker rm -f ${old_ids} >/dev/null 2>&1 || true
    fi

    # start new primary
    local -a run_args_primary=(
        -d
        --name "${app}"
        -p "${primary_port}:3000"
        --restart unless-stopped
        -e NEXT_TELEMETRY_DISABLED=1
    )
    if [[ -n "${env_file_arg:-}" ]]; then
        if [[ "${env_file_arg}" == --env-file* ]]; then
        # shellcheck disable=SC2206
        run_args_primary+=( ${env_file_arg} )
        else
        run_args_primary+=( --env-file "${env_file_arg}" )
        fi
    fi
    run_args_primary+=( "${app}:prod" )

    if ! docker run "${run_args_primary[@]}"; then
        print_error "Failed to start Next.js App container on port ${primary_port}. Temp ${temp_name} still running on ${temp_port} for manual fallback."
        return 1
    fi

    # Clean up the temporary container
    print_action "Cleaning up temporary container ${temp_name}..."
    
    # optional: remove temp after successful swap
    docker rm -f "${temp_name}" >/dev/null 2>&1 || true
    
    print_success "Next.js App deployed successfully"
}

# Verify service is running (next only)
verify_deployment() {
    print_header "Verifying Deployment"

    # sanity: make sure EXPOSE_PORT is set
    : "${EXPOSE_PORT:?EXPOSE_PORT must be set}"

    # small helper to get HTTP code safely
    _http_code() {
        local url="$1"
        curl -s -o /dev/null -w '%{http_code}' -L \
            --connect-timeout 2 --max-time 3 \
            "$url" 2>/dev/null || echo 000
    }

    local url="http://127.0.0.1:${EXPOSE_PORT}"

    print_action "Verifying primary container at http://127.0.0.1:${EXPOSE_PORT} ..."
    local http_code="000"
    for _ in $(seq 1 10); do
        http_code="$(_http_code "http://127.0.0.1:${EXPOSE_PORT}")"
        if [[ "${http_code}" =~ ^(200|30[12478])$ ]]; then
            print_success "Primary container is healthy (HTTP ${http_code})"
            return 0
        fi
        sleep 1
    done
    print_error "Primary container check failed (last HTTP ${http_code})"
    return 1
}

# Create deployment backup
cleanup_old_backups() {
    print_action "Checking for old backups..."
    local backup_count=$(ls -1 "${BACKUP_DIR}" 2>/dev/null | wc -l)
    
    if [ "$backup_count" -gt "$MAX_BACKUPS" ]; then
        print_action "Removing old backups (keeping last $MAX_BACKUPS)..."
        cd "${BACKUP_DIR}" && ls -1t | tail -n +$((MAX_BACKUPS + 1)) | xargs rm -rf
        cd - > /dev/null
        print_success "Old backups cleaned up"
    else
        print_action "No cleanup needed (have $backup_count of $MAX_BACKUPS backups)"
    fi
}

create_backup() {
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_path="${BACKUP_DIR}/${timestamp}"
    
    print_header "Creating Backup"
    
    # Create backup directory
    if [ ! -d "$backup_path" ]; then
        sudo -u "$REAL_USER" mkdir -p "$backup_path"
    fi
    
    # Backup code
    if [ -d "$APP_DIR" ]; then
        sudo -u "$REAL_USER" cp -r "$APP_DIR" "$backup_path/"
    fi
    
    # Backup docker images (Next.js App only) - write file as REAL_USER
    if docker image inspect "${APP_NAME}:prod" >/dev/null 2>&1; then
        print_action "Saving Docker image ${APP_NAME}:prod to backup..."
        if ! docker save "${APP_NAME}:prod" | sudo -u "$REAL_USER" tee "$backup_path/${APP_NAME}.tar" >/dev/null; then
            print_warning "Failed to save Docker image to backup (continuing)"
        fi
    else
        print_info "Docker image ${APP_NAME}:prod not found; skipping image backup"
    fi
    
    # Set proper ownership
    sudo chown -R "$REAL_USER:$REAL_USER" "$backup_path"
    print_success "Backup created successfully"
}

# List available backups
list_backups() {
    print_header "Available Backups"
    
    if [ ! -d "${BACKUP_DIR}" ] || [ -z "$(ls -A "${BACKUP_DIR}")" ]; then
        print_error "No backups found"
    fi
    
    local index=1
    while IFS= read -r backup; do
        local timestamp=${backup##*/}  # Extract date from path
        local readable_date=$(date -r "${BACKUP_DIR}/${backup}" "+%Y-%m-%d %H:%M:%S")
        echo -e "${GREEN}[$index]${RESET} ${timestamp} (${readable_date})"
        index=$((index + 1))
    done < <(ls -1t "${BACKUP_DIR}")
}

# Select backup to rollback to
select_backup() {
    list_backups
    
    local total_backups=$(ls -1 "${BACKUP_DIR}" | wc -l)
    local selected_index
    
    echo -e "\n${YELLOW}Enter backup number [1-${total_backups}] or 'q' to quit:${RESET} "
    read -r selected_index
    
    if [[ "$selected_index" == "q" ]]; then
        exit 0
    fi
    
    if ! [[ "$selected_index" =~ ^[0-9]+$ ]] || 
    [ "$selected_index" -lt 1 ] || 
    [ "$selected_index" -gt "$total_backups" ]; then
        print_error "Invalid selection. Please choose a number between 1 and ${total_backups}"
    fi
    
    local selected_backup=$(ls -1t "${BACKUP_DIR}" | sed -n "${selected_index}p")
    echo "${BACKUP_DIR}/${selected_backup}"
}

# Rollback to selected deployment
rollback() {
    local backup_path=$(select_backup)
    print_header "Rolling back to backup at ${backup_path}"
    
    # Stop current deployment
    cleanup_containers
    
    # Restore code
    local app_basename
    app_basename="$(basename "${APP_DIR}")"
    if [ -d "${backup_path}/${app_basename}" ]; then
        sudo -u "$REAL_USER" rm -rf "${APP_DIR}"
        sudo -u "$REAL_USER" cp -r "${backup_path}/${app_basename}" "${APP_DIR}"
        # Ensure restored app directory is owned by REAL_USER (redundant safety)
        chown -R "$REAL_USER:$REAL_USER" "${APP_DIR}" 2>/dev/null || true
    fi
    
    # Restore docker images
    if [ -f "${backup_path}/${APP_NAME}.tar" ]; then
        print_action "Restoring Docker image ${APP_NAME}:prod from backup..."
        if ! docker load < "${backup_path}/${APP_NAME}.tar"; then
            print_warning "Failed to restore Docker image from backup (continuing)"
        fi
    else
        print_info "${APP_NAME}.tar not found in backups; skipping image restore"
    fi
    
    # Restart service
    deploy
    verify_deployment
    
    print_success "Rollback completed"
}

# Ensure SSH agent is running and key is loaded
ensure_ssh_agent() {
    print_header "Setting Up SSH Agent"
    local agent_file="$REAL_HOME/.ssh/agent.env"
    
    # Try to use keychain-managed agent
    print_action "Checking for keychain-managed SSH agent..."
    if sudo -u "$REAL_USER" keychain --quiet --nogui --eval $SSH_KEY >/dev/null 2>&1; then
        print_action "Loading keychain environment..."
        eval "$(sudo -u "$REAL_USER" keychain --quiet --nogui --eval $SSH_KEY)" >/dev/null
        print_success "Using keychain-managed SSH agent"
        # Verify key is loaded
        if sudo -u "$REAL_USER" SSH_AUTH_SOCK="$SSH_AUTH_SOCK" ssh-add -l | grep -q "$(ssh-keygen -lf "$SSH_KEY" | awk '{print $2}')"; then
            print_success "SSH key already loaded"
            return 0
        else
            print_error "Keychain failed to load SSH key"
        fi
    fi

    # Fallback: Check for existing agent in agent.env
    if [ -f "$agent_file" ]; then
        print_action "Loading saved SSH agent environment..."
        source "$agent_file" >/dev/null
        if [ -n "$SSH_AUTH_SOCK" ] && [ -S "$SSH_AUTH_SOCK" ] && ps -p "$SSH_AGENT_PID" >/dev/null 2>&1; then
            print_info "Existing SSH agent found (PID: $SSH_AGENT_PID)"
            if sudo -u "$REAL_USER" SSH_AUTH_SOCK="$SSH_AUTH_SOCK" ssh-add -l | grep -q "$(ssh-keygen -lf "$SSH_KEY" | awk '{print $2}')"; then
                print_success "SSH key already loaded"
                return 0
            fi
        else
            print_action "Saved agent is invalid, cleaning up..."
            rm -f "$agent_file"
        fi
    fi

    # Start a new SSH agent
    print_action "Starting new SSH agent..."
    local agent_env
    agent_env=$(sudo -u "$REAL_USER" ssh-agent -s)
    eval "$agent_env" >/dev/null
    echo "export SSH_AUTH_SOCK=$SSH_AUTH_SOCK" | sudo -u "$REAL_USER" tee "$agent_file" >/dev/null
    echo "export SSH_AGENT_PID=$SSH_AGENT_PID" | sudo -u "$REAL_USER" tee -a "$agent_file" >/dev/null
    sudo -u "$REAL_USER" chmod 600 "$agent_file"
    print_action "SSH agent started (PID: $SSH_AGENT_PID)"

    # Check if SSH key exists
    if [ ! -f "$SSH_KEY" ]; then
        print_error "SSH key not found at $SSH_KEY"
        return 1
    fi

    # Add the SSH key
    print_action "Adding SSH key to agent..."
    if ! sudo -u "$REAL_USER" SSH_AUTH_SOCK="$SSH_AUTH_SOCK" ssh-add "$SSH_KEY"; then
        print_error "Failed to add SSH key. Run 'sudo -u $REAL_USER ssh-add $SSH_KEY' manually to debug."
        return 1
    fi
    print_success "SSH key added"
    print_success "SSH agent setup complete"
    return 0
}

# Function to handle Git operations
run_git_operations() {
    print_header "Running Git Operations"
    # Ensure SSH agent is set up
    ensure_ssh_agent || { print_error "SSH agent setup failed"; return 1; }

    # Run Git commands as REAL_USER with SSH_AUTH_SOCK
    print_action "Initializing Git repository..."
    local init_output
    if ! init_output=$(sudo -u "$REAL_USER" SSH_AUTH_SOCK="$SSH_AUTH_SOCK" bash -c "cd $GIT_DIR && git init . 2>&1"); then
        print_output "$init_output"
        print_error "Failed to initialize git repository"
        return 1
    fi
    print_output "$init_output"
    print_success "Git repository initialized"

    # Check if remote exists
    print_action "Checking if remote exists..."
    if ! sudo -u "$REAL_USER" SSH_AUTH_SOCK="$SSH_AUTH_SOCK" bash -c "cd $GIT_DIR && git remote get-url origin >/dev/null 2>&1"; then
        print_action "Adding remote..."
        local add_remote_output
        if ! add_remote_output=$(sudo -u "$REAL_USER" SSH_AUTH_SOCK="$SSH_AUTH_SOCK" bash -c "cd $GIT_DIR && git remote add origin $GIT_REPO 2>&1"); then
            print_output "$add_remote_output"
            print_error "Failed to add remote"
            return 1
        fi
        print_output "$add_remote_output"
        print_success "Remote added"
    else
        print_success "Remote already exists"
        # Ensure remote URL is correct
        local current_remote
        if ! current_remote=$(sudo -u "$REAL_USER" SSH_AUTH_SOCK="$SSH_AUTH_SOCK" bash -c "cd $GIT_DIR && git remote get-url origin 2>&1"); then
            print_output "$current_remote"
            print_error "Failed to get current remote URL"
            return 1
        fi
        print_output "$current_remote"
        if [ "$current_remote" != "$GIT_REPO" ]; then
            print_action "Updating remote URL to $GIT_REPO..."
            local update_remote_output
            if ! update_remote_output=$(sudo -u "$REAL_USER" SSH_AUTH_SOCK="$SSH_AUTH_SOCK" bash -c "cd $GIT_DIR && git remote set-url origin $GIT_REPO 2>&1"); then
                print_output "$update_remote_output"
                print_error "Failed to update remote URL"
                return 1
            fi
            print_output "$update_remote_output"
            print_success "Remote URL updated"
        fi
    fi

    # Show remote configuration
    print_action "Getting remote configuration..."
    local remote_config
    if ! remote_config=$(sudo -u "$REAL_USER" SSH_AUTH_SOCK="$SSH_AUTH_SOCK" bash -c "cd $GIT_DIR && git remote -v 2>&1"); then
        print_output "$remote_config"
        print_error "Failed to get remote configuration"
        return 1
    fi
    print_output "$remote_config"

    # Fetch updates
    print_action "Fetching from origin..."
    local fetch_output
    if ! fetch_output=$(sudo -u "$REAL_USER" SSH_AUTH_SOCK="$SSH_AUTH_SOCK" bash -c "cd $GIT_DIR && git fetch origin main 2>&1"); then
        print_output "$fetch_output"
        print_error "Failed to fetch from origin"
        return 1
    fi
    print_output "$fetch_output"

    # Show remote and local main branch state
    local remote_head
    local local_head
    if ! remote_head=$(sudo -u "$REAL_USER" SSH_AUTH_SOCK="$SSH_AUTH_SOCK" bash -c "cd $GIT_DIR && git rev-parse origin/main 2>&1"); then
        print_output "$remote_head"
        print_error "Failed to parse origin/main"
        return 1
    fi
    local_head=$(sudo -u "$REAL_USER" SSH_AUTH_SOCK="$SSH_AUTH_SOCK" bash -c "cd $GIT_DIR && git rev-parse main 2>/dev/null || echo 'none'")
    print_info "Remote main: $remote_head"
    print_info "Local main: $local_head"

    # Ensure we're on main branch
    print_action "Checking out main branch..."
    local checkout_output
    if ! checkout_output=$(sudo -u "$REAL_USER" SSH_AUTH_SOCK="$SSH_AUTH_SOCK" bash -c "cd $GIT_DIR && git checkout main 2>/dev/null || git checkout -b main 2>&1"); then
        print_output "$checkout_output"
        print_error "Failed to checkout main branch"
        return 1
    fi
    print_output "$checkout_output"

    # Force reset the working directory to match the remote repository
    print_action "Resetting working directory to match remote..."
    
    # Capture old HEAD before any operations
    local old_head
    old_head=$(sudo -u "$REAL_USER" SSH_AUTH_SOCK="$SSH_AUTH_SOCK" bash -c "cd $GIT_DIR && git rev-parse HEAD 2>/dev/null || echo 'none'")
    print_action "Current HEAD: $old_head"
    
    # Fetch all changes from the remote
    local fetch_all_output
    if ! fetch_all_output=$(sudo -u "$REAL_USER" SSH_AUTH_SOCK="$SSH_AUTH_SOCK" bash -c "cd $GIT_DIR && git fetch --all 2>&1"); then
        print_output "$fetch_all_output"
        print_error "Failed to fetch all remotes"
        return 1
    fi
    print_output "$fetch_all_output"
    
    # Show what files will change before reset (if we have a valid HEAD)
    if [ "$old_head" != "none" ]; then
        print_action "Files changed since last deployment:"
        local diff_output
        diff_output=$(sudo -u "$REAL_USER" SSH_AUTH_SOCK="$SSH_AUTH_SOCK" bash -c "cd $GIT_DIR && git diff --name-status $old_head origin/main 2>&1")
        print_output "$diff_output"
    fi
    
    # Hard reset to origin/main - this will discard all local changes
    local reset_output
    if ! reset_output=$(sudo -u "$REAL_USER" SSH_AUTH_SOCK="$SSH_AUTH_SOCK" bash -c "cd $GIT_DIR && git reset --hard origin/main 2>&1"); then
        print_output "$reset_output"
        print_error "Failed to reset to origin/main"
        return 1
    fi
    print_output "$reset_output"
    
    # Clean untracked files and directories
    local clean_output
    if ! clean_output=$(sudo -u "$REAL_USER" SSH_AUTH_SOCK="$SSH_AUTH_SOCK" bash -c "cd $GIT_DIR && git clean -fd 2>&1"); then
        print_output "$clean_output"
        print_error "Failed to clean untracked files"
        return 1
    fi
    print_output "$clean_output"
    
    print_success "Working directory reset to match remote repository"

    # Capture HEAD after reset/clean
    local new_head
    if ! new_head=$(sudo -u "$REAL_USER" SSH_AUTH_SOCK="$SSH_AUTH_SOCK" bash -c "cd $GIT_DIR && git rev-parse HEAD 2>&1"); then
        print_output "$new_head"
        print_error "Failed to get new HEAD"
        return 1
    fi
    print_info "New HEAD: $new_head"

    # Show last commit message only if HEAD changed
    if [ "$old_head" != "$new_head" ]; then
        local last_commit
        last_commit=$(sudo -u "$REAL_USER" SSH_AUTH_SOCK="$SSH_AUTH_SOCK" bash -c "cd $GIT_DIR && git log -1 --pretty=%s 2>&1")
        print_info "Last Commit: $last_commit"
    fi

    print_success "Git operations completed successfully"

    # Set ownership
    sudo chown -R "$REAL_USER:$REAL_USER" "$GIT_DIR/.git" >/dev/null 2>&1 || true
}

# Function to view logs for a specific container
view_logs() {
    local container_name="$1"
    local log_type="$2"
    
    print_header "Viewing $log_type Logs"
    
    if ! docker ps -q -f name="$container_name" | grep -q .; then
        print_error "$log_type container is not running"
        return 1
    fi
    
    print_action "Streaming logs for $log_type container..."
    print_info "Press Ctrl+C to exit"
    echo ""
    
    # Stream logs through highlighter so npm warn/notice are yellow
    docker logs -f "$container_name" 2>&1 | highlight_npm
}

# Parse command line arguments
if [ $# -gt 0 ]; then
    case $1 in
        git)
            run_git_operations
            exit $?
            ;;
        rollback)
            rollback
            exit 0
            ;;
        logs)
            view_logs "${APP_NAME}" "Next.js App"
            exit 0
            ;;
        *)
            print_error "Unknown parameter: $1"
            print_info "Available commands: git, rollback, logs"
            exit 1
            ;;
    esac
fi

# Run main deployment
main() {
    print_header "Starting Deployment Process"
    
    # First check if SSH key exists
    if [ ! -f "$SSH_KEY" ]; then
        print_error "SSH key not found at $SSH_KEY"
        exit 1
    fi
    
    # Initialize directories
    init_directories
    
    # Check Docker
    check_docker
    
    # Change to app directory
    cd "$APP_DIR" || { print_error "Failed to change to app directory"; exit 1; }
    
    # Run Git operations to update code (will fail if SSH key invalid/not added)
    if ! run_git_operations; then
        print_error "Aborting due to SSH/Git setup failure"
        exit 1
    fi
    
    # Check for environment files and override if they exist
    print_header "Checking for environment files"
    
    print_info "Script directory: $SCRIPT_DIR"
    print_info "App directory: $APP_DIR"
    
    # Copy next env files into apps/admin so they are available at build time
    sudo -u "$REAL_USER" mkdir -p "$APP_DIR"
    if [ -f "$SCRIPT_DIR/${ENV_FILENAME}" ]; then
        print_action "Found ${ENV_FILENAME} in deploy directory, copying to ${APP_DIR}/.env..."
        sudo -u "$REAL_USER" cp -f "$SCRIPT_DIR/${ENV_FILENAME}" "$APP_DIR/.env"
        print_success "Next.js ${ENV_FILENAME} copied to ${APP_DIR}/.env"
    fi
    if [ ! -f "$SCRIPT_DIR/${ENV_FILENAME}" ]; then
        print_warning "No ${ENV_FILENAME} found in deploy directory ($SCRIPT_DIR); using repo defaults"
    fi
    
    # Backup current deployment
    create_backup
    
    # Clean up old backups
    cleanup_old_backups
    
    # Keep existing container running; cleanup will happen during the swap in deploy()
    
    # Deploy (Next.js App only)
    deploy
    verify_deployment
    
    print_success "Deployment completed"
    print_success "Next.js App is running on port ${EXPOSE_PORT}"
    print_info "You can access the application at http://localhost:${EXPOSE_PORT}"
    print_info "To rollback, run: $0 rollback"
    print_info "To view logs, run: $0 logs"
}

main