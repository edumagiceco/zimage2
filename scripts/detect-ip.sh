#!/bin/bash
# Auto-detect the server's IP address

# Get the primary IP address (non-loopback, non-docker)
get_ip() {
    # Try to get IP from hostname command
    local ip=$(hostname -I | awk '{print $1}')

    # If empty, try ip command
    if [ -z "$ip" ]; then
        ip=$(ip -4 route get 8.8.8.8 2>/dev/null | awk '{print $7; exit}')
    fi

    # If still empty, fallback to localhost
    if [ -z "$ip" ]; then
        ip="127.0.0.1"
    fi

    echo "$ip"
}

# Update .env file with detected IP
update_env() {
    local ip=$(get_ip)
    local env_file="${1:-.env}"

    if [ -f "$env_file" ]; then
        # Update HOST_IP
        sed -i "s/^HOST_IP=.*/HOST_IP=$ip/" "$env_file"

        # Update NEXT_PUBLIC_API_URL to use detected IP with correct port (8100)
        sed -i "s|^NEXT_PUBLIC_API_URL=.*|NEXT_PUBLIC_API_URL=http://$ip:8100|" "$env_file"

        echo "Updated $env_file with HOST_IP=$ip"
    else
        echo "Error: $env_file not found"
        exit 1
    fi
}

# Export IP for use in docker-compose
export_ip() {
    local ip=$(get_ip)
    export HOST_IP="$ip"
    echo "$ip"
}

# Main
case "${1:-}" in
    "update")
        update_env "${2:-.env}"
        ;;
    "export")
        export_ip
        ;;
    *)
        get_ip
        ;;
esac
