#!/bin/bash

# Configuration
FRONTEND_PORT=5081
BACKEND_PORT=5051
GIT_REPO="git@github.com:yastrub/imaginaries.git"

# Get the script directory (where deploy.sh is located)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Use absolute paths for directories
APP_DIR="$SCRIPT_DIR/apps/client"
GIT_DIR="$SCRIPT_DIR/apps"
BACKUP_DIR="$SCRIPT_DIR/backups"
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
        print_action "Creating ${APP_DIR} directory..."
        mkdir -p "${APP_DIR}"
    fi
    
    # Create deployments directory if it doesn't exist
    if [ ! -d "${BACKUP_DIR}" ]; then
        print_action "Creating ${BACKUP_DIR} directory..."
        mkdir -p "${BACKUP_DIR}"
    fi
    
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
    
    # Stop and remove frontend containers
    if docker ps -a | grep -q "imaginaries-frontend"; then
        print_action "Stopping frontend containers..."
        docker stop $(docker ps -a | grep "imaginaries-frontend" | awk '{print $1}') 2>/dev/null
        docker rm $(docker ps -a | grep "imaginaries-frontend" | awk '{print $1}') 2>/dev/null
    fi
    
    # Stop and remove backend containers
    if docker ps -a | grep -q "imaginaries-backend"; then
        print_action "Stopping backend containers..."
        docker stop $(docker ps -a | grep "imaginaries-backend" | awk '{print $1}') 2>/dev/null
        docker rm $(docker ps -a | grep "imaginaries-backend" | awk '{print $1}') 2>/dev/null
    fi
    
    print_success "Cleanup completed"
}

# Build and deploy backend
deploy_backend() {
    print_header "Deploying Backend"
    
    cd ${APP_DIR}/backend || print_error "Backend directory not found"
    
    print_action "Building backend production image..."
    if ! docker build -t imaginaries-backend:prod .; then
        print_error "Failed to build backend image"
    fi
    
    print_action "Starting backend container..."
    if ! docker run -d \
        --name imaginaries-backend \
        -p ${BACKEND_PORT}:3000 \
        --restart unless-stopped \
        imaginaries-backend:prod; then
        print_error "Failed to start backend container"
    fi
    
    cd ${SCRIPT_DIR}
    
    print_success "Backend deployed successfully"
}

# Build and deploy frontend
deploy_frontend() {
    print_header "Deploying Frontend"

    cd ${APP_DIR}/frontend || print_error "Frontend directory not found"
    
    print_action "Building frontend production image..."
    if ! docker build -t imaginaries-frontend:prod .; then
        print_error "Failed to build frontend image"
    fi
    
    print_action "Starting frontend container..."
    if ! docker run -d \
        --name imaginaries-frontend \
        -p ${FRONTEND_PORT}:80 \
        --restart unless-stopped \
        imaginaries-frontend:prod; then
        print_error "Failed to start frontend container"
    fi

    cd ${SCRIPT_DIR}
    
    print_success "Frontend deployed successfully"
}

# Verify services are running
verify_deployment() {
    print_header "Verifying Deployment"
    
    # Wait for services to start
    print_action "Waiting for services to start..."
    sleep 5

    # Check if services are running on their ports
    local max_retries=5
    local retry_count=0
    local backend_health=""

    while [ $retry_count -lt $max_retries ]; do
        backend_health=$(curl -s -m 5 "http://localhost:${BACKEND_PORT}/api/health")
        
        if [ $? -eq 0 ] && echo "$backend_health" | grep -q "\"status\":\"ok\""; then
            print_success "Backend health check passed"
            
            # Check database status from health response
            if echo "$backend_health" | grep -q "\"database\":\"connected\""; then
                print_success "Database connection verified"
                break
            else
                print_warning "Database connection not verified, retrying..."
            fi
        else
            print_warning "Backend health check failed, attempt $((retry_count + 1))/$max_retries"
        fi
        
        retry_count=$((retry_count + 1))
        [ $retry_count -lt $max_retries ] && sleep 5
    done

    if [ $retry_count -eq $max_retries ]; then
        print_error "Backend health check failed after $max_retries attempts"
        print_action "Last response: $backend_health"
    fi

    # Check frontend
    if curl -s -I "http://localhost:${FRONTEND_PORT}" | grep -q "200 OK"; then
        print_success "Frontend is accessible"
    else
        print_error "Frontend is not accessible"
    fi
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
    
    # Backup docker images
    sudo -u "$REAL_USER" docker save -o "$backup_path/frontend.tar" "imaginaries-frontend:prod" 2>/dev/null
    sudo -u "$REAL_USER" docker save -o "$backup_path/backend.tar" "imaginaries-backend:prod" 2>/dev/null
    
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
        echo -e "${GREEN}[$index]${NC} ${timestamp} (${readable_date})"
        index=$((index + 1))
    done < <(ls -1t "${BACKUP_DIR}")
}

# Select backup to rollback to
select_backup() {
    list_backups
    
    local total_backups=$(ls -1 "${BACKUP_DIR}" | wc -l)
    local selected_index
    
    echo -e "\n${YELLOW}Enter backup number [1-${total_backups}] or 'q' to quit:${NC} "
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
    if [ -d "${backup_path}/${APP_DIR}" ]; then
        rm -rf "${APP_DIR}"
        cp -r "${backup_path}/${APP_DIR}" ./
    fi
    
    # Restore docker images
    if [ -f "${backup_path}/frontend.tar" ]; then
        docker load < "${backup_path}/frontend.tar"
    fi
    if [ -f "${backup_path}/backend.tar" ]; then
        docker load < "${backup_path}/backend.tar"
    fi
    
    # Restart services
    deploy_backend
    deploy_frontend
    verify_deployment
    
    print_success "Rollback completed"
}

# Ensure SSH agent is running and key is loaded
ensure_ssh_agent() {
    print_header "Setting Up SSH Agent"
    local agent_file="$REAL_HOME/.ssh/agent.env"
    
    # Try to use keychain-managed agent
    print_action "Checking for keychain-managed SSH agent..."
    if sudo -u "$REAL_USER" keychain --quiet --nogui --eval "${SSH_KEY}" >/dev/null 2>&1; then
        print_action "Loading keychain environment..."
        eval "$(sudo -u "$REAL_USER" keychain --quiet --nogui --eval "${SSH_KEY}")" >/dev/null
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
    fi

    # Add the SSH key
    print_action "Adding SSH key to agent..."
    if ! sudo -u "$REAL_USER" SSH_AUTH_SOCK="$SSH_AUTH_SOCK" ssh-add "$SSH_KEY"; then
        print_error "Failed to add SSH key. Run 'sudo -u $REAL_USER ssh-add $SSH_KEY' manually to debug."
    fi
    print_success "SSH key added"
    print_success "SSH agent setup complete"
}

# Function to handle Git operations
run_git_operations() {
    print_header "Running Git Operations"
    # Ensure SSH agent is set up
    ensure_ssh_agent

    # Run Git commands as REAL_USER with SSH_AUTH_SOCK
    print_action "Initializing Git repository..."
    local init_output
    init_output=$(sudo -u "$REAL_USER" SSH_AUTH_SOCK="$SSH_AUTH_SOCK" bash -c "cd ${GIT_DIR} && git init . 2>&1")
    print_output "$init_output"
    if [ $? -ne 0 ]; then
        print_error "Failed to initialize git repository"
    fi
    print_success "Git repository initialized"

    # Check if remote exists
    print_action "Checking if remote exists..."
    if ! sudo -u "$REAL_USER" SSH_AUTH_SOCK="$SSH_AUTH_SOCK" bash -c "cd ${GIT_DIR} && git remote get-url origin >/dev/null 2>&1"; then
        print_action "Adding remote..."
        local add_remote_output
        add_remote_output=$(sudo -u "$REAL_USER" SSH_AUTH_SOCK="$SSH_AUTH_SOCK" bash -c "cd ${GIT_DIR} && git remote add origin $GIT_REPO 2>&1")
        print_output "$add_remote_output"
        if [ $? -ne 0 ]; then
            print_error "Failed to add remote"
        fi
        print_success "Remote added"
    else
        print_success "Remote already exists"
        # Ensure remote URL is correct
        local current_remote
        current_remote=$(sudo -u "$REAL_USER" SSH_AUTH_SOCK="$SSH_AUTH_SOCK" bash -c "cd ${GIT_DIR} && git remote get-url origin")
        print_output "$current_remote"
        if [ "$current_remote" != "$GIT_REPO" ]; then
            print_action "Updating remote URL to $GIT_REPO..."
            local update_remote_output
            update_remote_output=$(sudo -u "$REAL_USER" SSH_AUTH_SOCK="$SSH_AUTH_SOCK" bash -c "cd ${GIT_DIR} && git remote set-url origin $GIT_REPO 2>&1")
            print_output "$update_remote_output"
            if [ $? -ne 0 ]; then
                print_error "Failed to update remote URL"
            fi
            print_success "Remote URL updated"
        fi
    fi

    # Show remote configuration
    print_action "Getting remote configuration..."
    local remote_config
    remote_config=$(sudo -u "$REAL_USER" SSH_AUTH_SOCK="$SSH_AUTH_SOCK" bash -c "cd ${GIT_DIR} && git remote -v 2>&1")
    print_output "$remote_config"

    # Fetch updates
    print_action "Fetching from origin..."
    local fetch_output
    fetch_output=$(sudo -u "$REAL_USER" SSH_AUTH_SOCK="$SSH_AUTH_SOCK" bash -c "cd ${GIT_DIR} && git fetch origin main 2>&1")
    print_output "$fetch_output"
    if [ $? -ne 0 ]; then
        print_error "Failed to fetch from origin"
    fi

    # Show remote and local main branch state
    local remote_head
    local local_head
    remote_head=$(sudo -u "$REAL_USER" SSH_AUTH_SOCK="$SSH_AUTH_SOCK" bash -c "cd ${GIT_DIR} && git rev-parse origin/main")
    local_head=$(sudo -u "$REAL_USER" SSH_AUTH_SOCK="$SSH_AUTH_SOCK" bash -c "cd ${GIT_DIR} && git rev-parse main 2>/dev/null || echo 'none'")
    print_info "Remote main: $remote_head"
    print_info "Local main: $local_head"

    # Ensure we're on main branch
    print_action "Checking out main branch..."
    local checkout_output
    checkout_output=$(sudo -u "$REAL_USER" SSH_AUTH_SOCK="$SSH_AUTH_SOCK" bash -c "cd ${GIT_DIR} && git checkout main 2>/dev/null || git checkout -b main")
    print_output "$checkout_output"
    if [ $? -ne 0 ]; then
        print_error "Failed to checkout main branch"
    fi

    # Capture HEAD before pull
    local old_head
    old_head=$(sudo -u "$REAL_USER" SSH_AUTH_SOCK="$SSH_AUTH_SOCK" bash -c "cd ${GIT_DIR} && git rev-parse HEAD")
    print_action "Current HEAD: $old_head"

    # Force reset the working directory to match the remote repository
    print_action "Resetting working directory to match remote..."
    
    # Capture old HEAD before any operations
    local old_head
    old_head=$(sudo -u "$REAL_USER" SSH_AUTH_SOCK="$SSH_AUTH_SOCK" bash -c "cd ${GIT_DIR} && git rev-parse HEAD 2>/dev/null || echo 'none'")
    print_action "Current HEAD: $old_head"
    
    # Fetch all changes from the remote
    local fetch_all_output
    fetch_all_output=$(sudo -u "$REAL_USER" SSH_AUTH_SOCK="$SSH_AUTH_SOCK" bash -c "cd ${GIT_DIR} && git fetch --all 2>&1")
    print_output "$fetch_all_output"
    
    # Show what files will change before reset (if we have a valid HEAD)
    if [ "$old_head" != "none" ]; then
        print_action "Files changed since last deployment:"
        local diff_output
        diff_output=$(sudo -u "$REAL_USER" SSH_AUTH_SOCK="$SSH_AUTH_SOCK" bash -c "cd ${GIT_DIR} && git diff --name-status $old_head origin/main 2>&1")
        print_output "$diff_output"
    fi
    
    # Hard reset to origin/main - this will discard all local changes
    local reset_output
    reset_output=$(sudo -u "$REAL_USER" SSH_AUTH_SOCK="$SSH_AUTH_SOCK" bash -c "cd ${GIT_DIR} && git reset --hard origin/main 2>&1")
    print_output "$reset_output"
    if [ $? -ne 0 ]; then
        print_error "Failed to reset to origin/main"
    fi
    
    # Clean untracked files and directories
    local clean_output
    clean_output=$(sudo -u "$REAL_USER" SSH_AUTH_SOCK="$SSH_AUTH_SOCK" bash -c "cd ${GIT_DIR} && git clean -fd 2>&1")
    print_output "$clean_output"
    if [ $? -ne 0 ]; then
        print_error "Failed to clean untracked files"
    fi
    
    print_success "Working directory reset to match remote repository"

    # Show last commit message only if HEAD changed
    if [ "$old_head" != "$new_head" ]; then
        local last_commit
        last_commit=$(sudo -u "$REAL_USER" SSH_AUTH_SOCK="$SSH_AUTH_SOCK" bash -c "cd ${GIT_DIR} && git log -1 --pretty=%s")
        print_info "Last Commit: $last_commit"
    fi

   # Capture HEAD after pull
    local new_head
    new_head=$(sudo -u "$REAL_USER" SSH_AUTH_SOCK="$SSH_AUTH_SOCK" bash -c "cd ${GIT_DIR} && git rev-parse HEAD")
    print_info "New HEAD: $new_head"

    print_success "Git operations completed successfully"

    # Set ownership
    sudo chown -R "$REAL_USER:$REAL_USER" "${GIT_DIR}/.git"
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
    
    # Simple log viewing without styling
    docker logs -f "$container_name"
}

# Parse command line arguments
if [ $# -gt 0 ]; then
    case $1 in
        git)
            run_git_operations
            exit 0
            ;;
        rollback)
            rollback
            exit 0
            ;;

        logs-backend)
            view_logs "imaginaries-backend" "Backend"
            exit 0
            ;;
        logs-frontend)
            view_logs "imaginaries-frontend" "Frontend"
            exit 0
            ;;
        *)
            print_error "Unknown parameter: $1"
            print_info "Available commands: git, rollback, logs-backend, logs-frontend"
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
    fi
    
    # Initialize directories
    init_directories
    
    # Check Docker
    check_docker
    
    # Change to app directory
    cd "$APP_DIR" || print_error "Failed to change to app directory"
    
    # Run Git operations to update code
    run_git_operations
    
    # Check for environment files and override if they exist
    print_header "Checking for environment files"
    
    print_info "Script directory: $SCRIPT_DIR"
    print_info "App directory: $APP_DIR"
    
    # Check for .env.frontend file (for frontend) in the script directory
    if [ -f "$SCRIPT_DIR/.env.frontend" ]; then
        print_action "Found .env.frontend file in deploy directory, copying to app directory..."
        # Ensure the target directory exists
        mkdir -p "$APP_DIR/frontend"
        cp -f "$SCRIPT_DIR/.env.frontend" "$APP_DIR/frontend/.env"
        print_success "Frontend .env file copied"
    else
        print_info "No .env.frontend file found in deploy directory, using existing file"
    fi
    
    # Check for .env.backend file (for backend) in the script directory
    if [ -f "$SCRIPT_DIR/.env.backend" ]; then
        print_action "Found .env.backend file in deploy directory, copying to backend directory..."
        # Ensure the target directory exists
        mkdir -p "$APP_DIR/backend"
        cp -f "$SCRIPT_DIR/.env.backend" "$APP_DIR/backend/.env"
        print_success "Backend .env file copied"
    else
        print_info "No .env.backend file found in deploy directory, using existing file"
    fi
    
    # Backup current deployment
    create_backup
    
    # Clean up old backups
    cleanup_old_backups
    
    # Clean up existing containers
    cleanup_containers
    
    # Deploy
    deploy_backend
    deploy_frontend
    verify_deployment
    
    print_success "Deployment completed"
    print_success "Backend is running on port ${BACKEND_PORT}"
    print_success "Frontend is running on port ${FRONTEND_PORT}"
    print_info "You can access the application at http://localhost:${FRONTEND_PORT}"
    print_info "To rollback, run: $0 rollback"
    print_info "To view logs, run: $0 logs-backend or $0 logs-frontend"
}

main