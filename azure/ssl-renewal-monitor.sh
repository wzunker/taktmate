#!/bin/bash

# TaktMate SSL Certificate Renewal Monitoring Script
# Usage: ./ssl-renewal-monitor.sh [options]
# Example: ./ssl-renewal-monitor.sh --continuous --alert --interval 3600

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

print_header() {
    echo -e "${MAGENTA}========================================${NC}"
    echo -e "${MAGENTA}$1${NC}"
    echo -e "${MAGENTA}========================================${NC}"
}

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_step() {
    echo -e "${CYAN}[STEP]${NC} $1"
}

# Function to show usage
show_usage() {
    echo "TaktMate SSL Certificate Renewal Monitoring"
    echo ""
    echo "Usage: $0 [options]"
    echo ""
    echo "Options:"
    echo "  --continuous        Run continuous monitoring (daemon mode)"
    echo "  --interval SECONDS  Monitoring interval in seconds (default: 3600 = 1 hour)"
    echo "  --alert             Enable alert notifications"
    echo "  --email EMAIL       Email address for alerts"
    echo "  --webhook URL       Webhook URL for alerts (Slack, Teams, etc.)"
    echo "  --log-file FILE     Custom log file path"
    echo "  --verbose           Enable verbose output"
    echo "  --help              Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 --continuous --alert --interval 3600"
    echo "  $0 --alert --email admin@taktconnect.com"
    echo "  $0 --continuous --webhook https://hooks.slack.com/..."
}

# Parse arguments
CONTINUOUS=false
INTERVAL=3600  # 1 hour default
ALERT=false
EMAIL=""
WEBHOOK=""
LOG_FILE=""
VERBOSE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --continuous)
            CONTINUOUS=true
            shift
            ;;
        --interval)
            INTERVAL="$2"
            shift 2
            ;;
        --alert)
            ALERT=true
            shift
            ;;
        --email)
            EMAIL="$2"
            ALERT=true
            shift 2
            ;;
        --webhook)
            WEBHOOK="$2"
            ALERT=true
            shift 2
            ;;
        --log-file)
            LOG_FILE="$2"
            shift 2
            ;;
        --verbose)
            VERBOSE=true
            shift
            ;;
        --help)
            show_usage
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
done

# Validate interval
if ! [[ "$INTERVAL" =~ ^[0-9]+$ ]] || [ "$INTERVAL" -lt 60 ]; then
    print_error "Interval must be a number >= 60 seconds"
    exit 1
fi

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="$SCRIPT_DIR/logs"
ALERT_DIR="$SCRIPT_DIR/alerts"

# Set default log file if not provided
if [ -z "$LOG_FILE" ]; then
    LOG_FILE="$LOG_DIR/ssl-renewal-monitor.log"
fi

# Create directories
mkdir -p "$LOG_DIR" "$ALERT_DIR"

# SSL monitoring configuration
DOMAINS=(
    "app.taktconnect.com"
    "www.taktconnect.com"
    "staging.taktconnect.com"
    "dev.taktconnect.com"
    "api.taktconnect.com"
    "api-staging.taktconnect.com"
    "api-dev.taktconnect.com"
)

# Certificate thresholds (days)
CRITICAL_THRESHOLD=7
WARNING_THRESHOLD=30
RENEWAL_THRESHOLD=30  # Azure Static Web Apps renews ~30 days before expiry

# Function to log message
log_message() {
    local level="$1"
    local message="$2"
    local timestamp=$(date -u +%Y-%m-%dT%H:%M:%SZ)
    
    echo "[$timestamp] [$level] $message" >> "$LOG_FILE"
    
    if [ "$VERBOSE" = true ] || [ "$level" = "ERROR" ] || [ "$level" = "WARNING" ]; then
        case "$level" in
            "ERROR") print_error "$message" ;;
            "WARNING") print_warning "$message" ;;
            "SUCCESS") print_success "$message" ;;
            *) print_status "$message" ;;
        esac
    fi
}

# Function to check if domain is accessible
check_domain_accessibility() {
    local domain="$1"
    
    if command -v curl &>/dev/null; then
        local response=$(curl -s -o /dev/null -w "%{http_code}" "https://$domain" --max-time 10 2>/dev/null || echo "000")
        if [ "$response" = "200" ] || [ "$response" = "301" ] || [ "$response" = "302" ]; then
            return 0
        fi
    fi
    
    return 1
}

# Function to get SSL certificate information
get_ssl_cert_info() {
    local domain="$1"
    
    if ! command -v openssl &>/dev/null; then
        log_message "ERROR" "openssl not available - cannot check SSL certificate for $domain"
        return 1
    fi
    
    # Check if domain is accessible first
    if ! check_domain_accessibility "$domain"; then
        log_message "WARNING" "Domain not accessible: $domain - skipping SSL check"
        return 1
    fi
    
    # Get certificate information
    local cert_info=$(echo | openssl s_client -servername "$domain" -connect "$domain:443" 2>/dev/null | openssl x509 -noout -dates 2>/dev/null || echo "")
    
    if [ -z "$cert_info" ]; then
        log_message "ERROR" "Could not retrieve SSL certificate for $domain"
        return 1
    fi
    
    # Extract dates
    local expiry_date=$(echo "$cert_info" | grep "notAfter=" | cut -d'=' -f2)
    local issue_date=$(echo "$cert_info" | grep "notBefore=" | cut -d'=' -f2)
    
    if [ -z "$expiry_date" ]; then
        log_message "ERROR" "Could not parse SSL certificate expiration for $domain"
        return 1
    fi
    
    # Calculate days until expiration
    local expiry_epoch
    local current_epoch=$(date +%s)
    
    # Cross-platform date parsing
    if date -d "$expiry_date" +%s &>/dev/null; then
        expiry_epoch=$(date -d "$expiry_date" +%s)
    elif date -j -f "%b %d %T %Y %Z" "$expiry_date" +%s &>/dev/null; then
        expiry_epoch=$(date -j -f "%b %d %T %Y %Z" "$expiry_date" +%s)
    else
        log_message "ERROR" "Could not parse expiration date format for $domain: $expiry_date"
        return 1
    fi
    
    local days_until_expiry=$(( (expiry_epoch - current_epoch) / 86400 ))
    
    # Store certificate information globally for alert processing
    echo "$domain:$days_until_expiry:$issue_date:$expiry_date"
    
    return 0
}

# Function to check SSL certificate renewal status
check_ssl_renewal_status() {
    local domain="$1"
    local days_until_expiry="$2"
    
    # Azure Static Web Apps automatic renewal logic
    if [ $days_until_expiry -le $RENEWAL_THRESHOLD ]; then
        log_message "INFO" "SSL certificate for $domain should be in renewal process (expires in $days_until_expiry days)"
        
        # Check if certificate has been recently renewed (issued within last 7 days)
        local cert_info=$(echo | openssl s_client -servername "$domain" -connect "$domain:443" 2>/dev/null | openssl x509 -noout -dates 2>/dev/null || echo "")
        local issue_date=$(echo "$cert_info" | grep "notBefore=" | cut -d'=' -f2)
        
        if [ -n "$issue_date" ]; then
            local issue_epoch
            local current_epoch=$(date +%s)
            
            if date -d "$issue_date" +%s &>/dev/null; then
                issue_epoch=$(date -d "$issue_date" +%s)
            elif date -j -f "%b %d %T %Y %Z" "$issue_date" +%s &>/dev/null; then
                issue_epoch=$(date -j -f "%b %d %T %Y %Z" "$issue_date" +%s)
            else
                return 1
            fi
            
            local days_since_issue=$(( (current_epoch - issue_epoch) / 86400 ))
            
            if [ $days_since_issue -le 7 ]; then
                log_message "SUCCESS" "SSL certificate for $domain recently renewed (issued $days_since_issue days ago)"
                return 0
            fi
        fi
        
        # If we reach here, certificate should be renewing but hasn't been renewed recently
        if [ $days_until_expiry -le $CRITICAL_THRESHOLD ]; then
            log_message "ERROR" "SSL certificate for $domain expires in $days_until_expiry days - renewal may have failed!"
            return 2  # Critical
        else
            log_message "WARNING" "SSL certificate for $domain expires in $days_until_expiry days - monitoring renewal"
            return 1  # Warning
        fi
    else
        log_message "INFO" "SSL certificate for $domain is healthy (expires in $days_until_expiry days)"
        return 0  # Healthy
    fi
}

# Function to send email alert
send_email_alert() {
    local subject="$1"
    local body="$2"
    
    if [ -z "$EMAIL" ]; then
        return 0
    fi
    
    if command -v mail &>/dev/null; then
        echo "$body" | mail -s "$subject" "$EMAIL"
        log_message "INFO" "Email alert sent to $EMAIL"
    elif command -v sendmail &>/dev/null; then
        {
            echo "To: $EMAIL"
            echo "Subject: $subject"
            echo ""
            echo "$body"
        } | sendmail "$EMAIL"
        log_message "INFO" "Email alert sent to $EMAIL via sendmail"
    else
        log_message "WARNING" "No email command available (mail/sendmail) - cannot send email alert"
    fi
}

# Function to send webhook alert
send_webhook_alert() {
    local message="$1"
    local level="$2"
    
    if [ -z "$WEBHOOK" ]; then
        return 0
    fi
    
    if ! command -v curl &>/dev/null; then
        log_message "WARNING" "curl not available - cannot send webhook alert"
        return 1
    fi
    
    # Determine color based on alert level
    local color=""
    case "$level" in
        "critical") color="#FF0000" ;;  # Red
        "warning") color="#FFA500" ;;   # Orange
        "info") color="#00FF00" ;;      # Green
        *) color="#0000FF" ;;           # Blue
    esac
    
    # Create webhook payload (Slack format - adapt for other webhooks)
    local payload="{
        \"text\": \"TaktMate SSL Certificate Alert\",
        \"attachments\": [
            {
                \"color\": \"$color\",
                \"fields\": [
                    {
                        \"title\": \"SSL Certificate Alert\",
                        \"value\": \"$message\",
                        \"short\": false
                    },
                    {
                        \"title\": \"Environment\",
                        \"value\": \"TaktMate Production\",
                        \"short\": true
                    },
                    {
                        \"title\": \"Timestamp\",
                        \"value\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",
                        \"short\": true
                    }
                ]
            }
        ]
    }"
    
    # Send webhook
    local response=$(curl -s -X POST -H "Content-Type: application/json" -d "$payload" "$WEBHOOK" 2>/dev/null || echo "error")
    
    if [ "$response" != "error" ]; then
        log_message "INFO" "Webhook alert sent successfully"
    else
        log_message "ERROR" "Failed to send webhook alert"
    fi
}

# Function to process alerts
process_alerts() {
    local critical_certs=()
    local warning_certs=()
    local renewed_certs=()
    
    # Read certificate information from temporary file
    local cert_file="/tmp/ssl-cert-info-$$"
    
    if [ ! -f "$cert_file" ]; then
        return 0
    fi
    
    while IFS=':' read -r domain days_until_expiry issue_date expiry_date; do
        if [ $days_until_expiry -le $CRITICAL_THRESHOLD ]; then
            critical_certs+=("$domain (expires in $days_until_expiry days)")
        elif [ $days_until_expiry -le $WARNING_THRESHOLD ]; then
            warning_certs+=("$domain (expires in $days_until_expiry days)")
        fi
        
        # Check for recently renewed certificates
        if [ -n "$issue_date" ]; then
            local issue_epoch
            local current_epoch=$(date +%s)
            
            if date -d "$issue_date" +%s &>/dev/null; then
                issue_epoch=$(date -d "$issue_date" +%s)
            elif date -j -f "%b %d %T %Y %Z" "$issue_date" +%s &>/dev/null; then
                issue_epoch=$(date -j -f "%b %d %T %Y %Z" "$issue_date" +%s)
            fi
            
            if [ -n "$issue_epoch" ]; then
                local days_since_issue=$(( (current_epoch - issue_epoch) / 86400 ))
                if [ $days_since_issue -le 1 ]; then
                    renewed_certs+=("$domain (renewed $days_since_issue days ago)")
                fi
            fi
        fi
    done < "$cert_file"
    
    # Clean up temporary file
    rm -f "$cert_file"
    
    # Send critical alerts
    if [ ${#critical_certs[@]} -gt 0 ]; then
        local critical_message="CRITICAL: SSL certificates expiring soon:\n"
        for cert in "${critical_certs[@]}"; do
            critical_message="${critical_message}• $cert\n"
        done
        critical_message="${critical_message}\nImmediate action required!"
        
        log_message "ERROR" "Critical SSL certificate alert: ${#critical_certs[@]} certificates expiring"
        
        if [ "$ALERT" = true ]; then
            send_email_alert "CRITICAL: TaktMate SSL Certificates Expiring" "$critical_message"
            send_webhook_alert "$critical_message" "critical"
        fi
    fi
    
    # Send warning alerts
    if [ ${#warning_certs[@]} -gt 0 ]; then
        local warning_message="WARNING: SSL certificates expiring within 30 days:\n"
        for cert in "${warning_certs[@]}"; do
            warning_message="${warning_message}• $cert\n"
        done
        warning_message="${warning_message}\nMonitoring automatic renewal process."
        
        log_message "WARNING" "SSL certificate warning: ${#warning_certs[@]} certificates expiring soon"
        
        if [ "$ALERT" = true ]; then
            send_email_alert "WARNING: TaktMate SSL Certificates Expiring Soon" "$warning_message"
            send_webhook_alert "$warning_message" "warning"
        fi
    fi
    
    # Send renewal notifications
    if [ ${#renewed_certs[@]} -gt 0 ]; then
        local renewal_message="INFO: SSL certificates recently renewed:\n"
        for cert in "${renewed_certs[@]}"; do
            renewal_message="${renewal_message}• $cert\n"
        done
        
        log_message "SUCCESS" "SSL certificate renewal notification: ${#renewed_certs[@]} certificates renewed"
        
        if [ "$ALERT" = true ]; then
            send_email_alert "INFO: TaktMate SSL Certificates Renewed" "$renewal_message"
            send_webhook_alert "$renewal_message" "info"
        fi
    fi
}

# Function to run SSL monitoring check
run_ssl_monitoring() {
    local timestamp=$(date -u +%Y-%m-%dT%H:%M:%SZ)
    log_message "INFO" "Starting SSL certificate monitoring check"
    
    local cert_file="/tmp/ssl-cert-info-$$"
    local total_certs=0
    local healthy_certs=0
    local warning_certs=0
    local critical_certs=0
    local error_certs=0
    
    # Check each domain
    for domain in "${DOMAINS[@]}"; do
        total_certs=$((total_certs + 1))
        
        log_message "INFO" "Checking SSL certificate for $domain"
        
        # Get certificate information
        local cert_info=$(get_ssl_cert_info "$domain")
        local cert_result=$?
        
        if [ $cert_result -eq 0 ] && [ -n "$cert_info" ]; then
            echo "$cert_info" >> "$cert_file"
            
            IFS=':' read -r cert_domain days_until_expiry issue_date expiry_date <<< "$cert_info"
            
            # Check renewal status
            check_ssl_renewal_status "$cert_domain" "$days_until_expiry"
            local renewal_status=$?
            
            case $renewal_status in
                0) healthy_certs=$((healthy_certs + 1)) ;;
                1) warning_certs=$((warning_certs + 1)) ;;
                2) critical_certs=$((critical_certs + 1)) ;;
            esac
        else
            error_certs=$((error_certs + 1))
            log_message "ERROR" "Failed to check SSL certificate for $domain"
        fi
    done
    
    # Process alerts
    process_alerts
    
    # Log summary
    log_message "INFO" "SSL monitoring check completed - Total: $total_certs, Healthy: $healthy_certs, Warning: $warning_certs, Critical: $critical_certs, Errors: $error_certs"
    
    # Return appropriate exit code
    if [ $critical_certs -gt 0 ] || [ $error_certs -gt 0 ]; then
        return 1
    elif [ $warning_certs -gt 0 ]; then
        return 2
    else
        return 0
    fi
}

# Function to handle shutdown signal
handle_shutdown() {
    log_message "INFO" "Received shutdown signal - stopping SSL renewal monitor"
    exit 0
}

# Set up signal handlers for graceful shutdown
trap handle_shutdown SIGINT SIGTERM

# Main function
main() {
    print_header "TAKTMATE SSL CERTIFICATE RENEWAL MONITOR"
    print_status "Continuous: $CONTINUOUS"
    print_status "Interval: ${INTERVAL}s"
    print_status "Alert: $ALERT"
    if [ -n "$EMAIL" ]; then
        print_status "Email: $EMAIL"
    fi
    if [ -n "$WEBHOOK" ]; then
        print_status "Webhook: configured"
    fi
    print_status "Log File: $LOG_FILE"
    echo ""
    
    log_message "INFO" "SSL renewal monitor started"
    
    if [ "$CONTINUOUS" = true ]; then
        print_status "Starting continuous monitoring (interval: ${INTERVAL}s)"
        print_status "Press Ctrl+C to stop"
        
        while true; do
            run_ssl_monitoring
            local result=$?
            
            if [ $result -eq 1 ]; then
                log_message "ERROR" "Critical SSL certificate issues detected"
            elif [ $result -eq 2 ]; then
                log_message "WARNING" "SSL certificate warnings detected"
            else
                log_message "INFO" "All SSL certificates are healthy"
            fi
            
            sleep "$INTERVAL"
        done
    else
        print_status "Running single SSL monitoring check"
        run_ssl_monitoring
        local result=$?
        
        if [ $result -eq 1 ]; then
            print_error "Critical SSL certificate issues detected"
            exit 1
        elif [ $result -eq 2 ]; then
            print_warning "SSL certificate warnings detected"
            exit 0
        else
            print_success "All SSL certificates are healthy"
            exit 0
        fi
    fi
}

# Execute main function
main "$@"
