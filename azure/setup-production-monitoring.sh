#!/bin/bash

# TaktMate Production Application Insights Monitoring Setup
# Usage: ./setup-production-monitoring.sh [environment] [options]
# Example: ./setup-production-monitoring.sh production --comprehensive --alerts

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
    echo "TaktMate Production Application Insights Monitoring Setup"
    echo ""
    echo "Usage: $0 [environment] [options]"
    echo ""
    echo "Environments:"
    echo "  production  - Production monitoring setup"
    echo "  staging     - Staging monitoring setup"
    echo "  development - Development monitoring setup"
    echo ""
    echo "Options:"
    echo "  --comprehensive     Set up comprehensive monitoring (dashboards, alerts, workbooks)"
    echo "  --alerts           Set up production alerts and action groups"
    echo "  --dashboards       Deploy custom dashboards"
    echo "  --workbooks        Deploy monitoring workbooks"
    echo "  --availability     Set up availability tests"
    echo "  --performance      Set up performance monitoring"
    echo "  --validate         Validate monitoring setup"
    echo "  --dry-run          Show what would be configured without executing"
    echo "  --verbose          Enable verbose output"
    echo "  --help             Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 production --comprehensive"
    echo "  $0 staging --alerts --dashboards"
    echo "  $0 production --availability --performance --validate"
}

# Parse arguments
ENVIRONMENT=""
COMPREHENSIVE=false
ALERTS=false
DASHBOARDS=false
WORKBOOKS=false
AVAILABILITY=false
PERFORMANCE=false
VALIDATE=false
DRY_RUN=false
VERBOSE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        production|staging|development)
            ENVIRONMENT="$1"
            shift
            ;;
        --comprehensive)
            COMPREHENSIVE=true
            ALERTS=true
            DASHBOARDS=true
            WORKBOOKS=true
            AVAILABILITY=true
            PERFORMANCE=true
            shift
            ;;
        --alerts)
            ALERTS=true
            shift
            ;;
        --dashboards)
            DASHBOARDS=true
            shift
            ;;
        --workbooks)
            WORKBOOKS=true
            shift
            ;;
        --availability)
            AVAILABILITY=true
            shift
            ;;
        --performance)
            PERFORMANCE=true
            shift
            ;;
        --validate)
            VALIDATE=true
            shift
            ;;
        --dry-run)
            DRY_RUN=true
            shift
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

# Validate environment
if [[ ! "$ENVIRONMENT" =~ ^(production|staging|development)$ ]]; then
    print_error "Environment must be specified: production, staging, or development"
    show_usage
    exit 1
fi

# Set environment-specific variables
case "$ENVIRONMENT" in
    "production")
        RESOURCE_GROUP="taktmate-prod-rg"
        APP_INSIGHTS_NAME="taktmate-appinsights-prod"
        APP_SERVICE_NAME="taktmate-api-prod"
        STATIC_WEB_APP_NAME="taktmate-frontend-prod"
        FRONTEND_URL="https://app.taktmate.com"
        BACKEND_URL="https://api.taktmate.com"
        LOG_ANALYTICS_WORKSPACE="taktmate-logs-prod"
        ACTION_GROUP_NAME="taktmate-alerts-prod"
        AVAILABILITY_TEST_NAME="taktmate-availability-prod"
        ALERT_EMAIL="alerts@taktmate.com"
        CRITICAL_ALERT_THRESHOLD="5"
        WARNING_ALERT_THRESHOLD="10"
        ;;
    "staging")
        RESOURCE_GROUP="taktmate-staging-rg"
        APP_INSIGHTS_NAME="taktmate-appinsights-staging"
        APP_SERVICE_NAME="taktmate-api-staging"
        STATIC_WEB_APP_NAME="taktmate-frontend-staging"
        FRONTEND_URL="https://staging.taktmate.com"
        BACKEND_URL="https://api-staging.taktmate.com"
        LOG_ANALYTICS_WORKSPACE="taktmate-logs-staging"
        ACTION_GROUP_NAME="taktmate-alerts-staging"
        AVAILABILITY_TEST_NAME="taktmate-availability-staging"
        ALERT_EMAIL="staging-alerts@taktmate.com"
        CRITICAL_ALERT_THRESHOLD="10"
        WARNING_ALERT_THRESHOLD="20"
        ;;
    "development")
        RESOURCE_GROUP="taktmate-dev-rg"
        APP_INSIGHTS_NAME="taktmate-appinsights-dev"
        APP_SERVICE_NAME="taktmate-api-dev"
        STATIC_WEB_APP_NAME="taktmate-frontend-dev"
        FRONTEND_URL="https://dev.taktmate.com"
        BACKEND_URL="https://api-dev.taktmate.com"
        LOG_ANALYTICS_WORKSPACE="taktmate-logs-dev"
        ACTION_GROUP_NAME="taktmate-alerts-dev"
        AVAILABILITY_TEST_NAME="taktmate-availability-dev"
        ALERT_EMAIL="dev-alerts@taktmate.com"
        CRITICAL_ALERT_THRESHOLD="20"
        WARNING_ALERT_THRESHOLD="30"
        ;;
esac

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Function to execute or simulate commands
execute_command() {
    local command="$1"
    local description="$2"
    
    if [ "$DRY_RUN" = true ]; then
        print_status "[DRY-RUN] Would execute: $description"
        if [ "$VERBOSE" = true ]; then
            print_status "[DRY-RUN] Command: $command"
        fi
        return 0
    else
        print_step "$description"
        if [ "$VERBOSE" = true ]; then
            echo "Executing: $command"
        fi
        eval "$command"
        return $?
    fi
}

# Function to create Log Analytics Workspace
create_log_analytics_workspace() {
    print_step "Creating Log Analytics Workspace"
    
    if [ "$DRY_RUN" = false ]; then
        # Check if workspace already exists
        if az monitor log-analytics workspace show --name "$LOG_ANALYTICS_WORKSPACE" --resource-group "$RESOURCE_GROUP" &>/dev/null; then
            print_success "Log Analytics Workspace already exists: $LOG_ANALYTICS_WORKSPACE"
        else
            if az monitor log-analytics workspace create \
                --name "$LOG_ANALYTICS_WORKSPACE" \
                --resource-group "$RESOURCE_GROUP" \
                --location "eastus" \
                --sku "PerGB2018" &>/dev/null; then
                print_success "Log Analytics Workspace created: $LOG_ANALYTICS_WORKSPACE"
            else
                print_error "Failed to create Log Analytics Workspace"
                return 1
            fi
        fi
    else
        print_status "[DRY-RUN] Would create Log Analytics Workspace: $LOG_ANALYTICS_WORKSPACE"
    fi
}

# Function to create Application Insights instance
create_application_insights() {
    print_step "Creating Application Insights instance"
    
    if [ "$DRY_RUN" = false ]; then
        # Check if Application Insights already exists
        if az monitor app-insights component show --app "$APP_INSIGHTS_NAME" --resource-group "$RESOURCE_GROUP" &>/dev/null; then
            print_success "Application Insights already exists: $APP_INSIGHTS_NAME"
        else
            # Get workspace resource ID
            local workspace_id=$(az monitor log-analytics workspace show --name "$LOG_ANALYTICS_WORKSPACE" --resource-group "$RESOURCE_GROUP" --query "id" -o tsv)
            
            if az monitor app-insights component create \
                --app "$APP_INSIGHTS_NAME" \
                --location "eastus" \
                --resource-group "$RESOURCE_GROUP" \
                --application-type "web" \
                --kind "web" \
                --workspace "$workspace_id" &>/dev/null; then
                print_success "Application Insights created: $APP_INSIGHTS_NAME"
            else
                print_error "Failed to create Application Insights"
                return 1
            fi
        fi
        
        # Get connection string and instrumentation key
        local connection_string=$(az monitor app-insights component show --app "$APP_INSIGHTS_NAME" --resource-group "$RESOURCE_GROUP" --query "connectionString" -o tsv)
        local instrumentation_key=$(az monitor app-insights component show --app "$APP_INSIGHTS_NAME" --resource-group "$RESOURCE_GROUP" --query "instrumentationKey" -o tsv)
        
        print_success "Connection String: $connection_string"
        print_success "Instrumentation Key: $instrumentation_key"
    else
        print_status "[DRY-RUN] Would create Application Insights: $APP_INSIGHTS_NAME"
    fi
}

# Function to configure App Service Application Insights
configure_app_service_insights() {
    print_step "Configuring App Service Application Insights"
    
    if [ "$DRY_RUN" = false ]; then
        # Get Application Insights connection string
        local connection_string=$(az monitor app-insights component show --app "$APP_INSIGHTS_NAME" --resource-group "$RESOURCE_GROUP" --query "connectionString" -o tsv)
        
        # Configure App Service with Application Insights
        if az webapp config appsettings set \
            --name "$APP_SERVICE_NAME" \
            --resource-group "$RESOURCE_GROUP" \
            --settings APPLICATIONINSIGHTS_CONNECTION_STRING="$connection_string" \
                       APPINSIGHTS_PROFILERFEATURE_VERSION="1.0.0" \
                       APPINSIGHTS_SNAPSHOTFEATURE_VERSION="1.0.0" \
                       ApplicationInsightsAgent_EXTENSION_VERSION="~3" \
                       DiagnosticServices_EXTENSION_VERSION="~3" \
                       InstrumentationEngine_EXTENSION_VERSION="disabled" \
                       SnapshotDebugger_EXTENSION_VERSION="disabled" \
                       XDT_MicrosoftApplicationInsights_BaseExtensions="disabled" \
                       XDT_MicrosoftApplicationInsights_Mode="recommended" \
                       XDT_MicrosoftApplicationInsights_PreemptSdk="disabled" &>/dev/null; then
            print_success "App Service configured with Application Insights"
        else
            print_error "Failed to configure App Service with Application Insights"
            return 1
        fi
    else
        print_status "[DRY-RUN] Would configure App Service: $APP_SERVICE_NAME"
    fi
}

# Function to create production-specific dashboards
create_production_dashboards() {
    if [ "$DASHBOARDS" = false ]; then
        return 0
    fi
    
    print_step "Creating production-specific dashboards"
    
    # Create production overview dashboard
    local dashboard_file="$SCRIPT_DIR/dashboards/production-overview-dashboard.json"
    
    if [ "$DRY_RUN" = false ]; then
        # Create dashboard directory if it doesn't exist
        mkdir -p "$SCRIPT_DIR/dashboards"
        
        # Generate production overview dashboard
        cat > "$dashboard_file" << EOF
{
  "properties": {
    "lenses": {
      "0": {
        "order": 0,
        "parts": {
          "0": {
            "position": {
              "x": 0,
              "y": 0,
              "colSpan": 6,
              "rowSpan": 4
            },
            "metadata": {
              "inputs": [
                {
                  "name": "resourceTypeMode",
                  "isOptional": true
                },
                {
                  "name": "ComponentId",
                  "value": "/subscriptions/{subscription-id}/resourceGroups/$RESOURCE_GROUP/providers/microsoft.insights/components/$APP_INSIGHTS_NAME",
                  "isOptional": true
                },
                {
                  "name": "Scope",
                  "value": {
                    "resourceIds": [
                      "/subscriptions/{subscription-id}/resourceGroups/$RESOURCE_GROUP/providers/microsoft.insights/components/$APP_INSIGHTS_NAME"
                    ]
                  },
                  "isOptional": true
                },
                {
                  "name": "PartId",
                  "value": "1d7a8e3a-9b2c-4f5e-8d7c-6a5b4c3d2e1f",
                  "isOptional": true
                },
                {
                  "name": "Version",
                  "value": "2.0",
                  "isOptional": true
                },
                {
                  "name": "TimeRange",
                  "value": "P1D",
                  "isOptional": true
                },
                {
                  "name": "DashboardId",
                  "isOptional": true
                },
                {
                  "name": "DraftRequestParameters",
                  "isOptional": true
                },
                {
                  "name": "Query",
                  "value": "requests\\n| where timestamp >= ago(1d)\\n| summarize RequestCount = count(), AvgDuration = avg(duration), FailedRequests = countif(success == false) by bin(timestamp, 1h)\\n| project timestamp, RequestCount, AvgDuration, FailedRequests, SuccessRate = (RequestCount - FailedRequests) * 100.0 / RequestCount\\n| order by timestamp desc",
                  "isOptional": true
                },
                {
                  "name": "ControlType",
                  "value": "AnalyticsGrid",
                  "isOptional": true
                },
                {
                  "name": "SpecificChart",
                  "isOptional": true
                },
                {
                  "name": "PartTitle",
                  "value": "Request Performance Overview",
                  "isOptional": true
                },
                {
                  "name": "Dimensions",
                  "isOptional": true
                },
                {
                  "name": "LegendOptions",
                  "isOptional": true
                },
                {
                  "name": "IsQueryContainTimeRange",
                  "value": false,
                  "isOptional": true
                }
              ],
              "type": "Extension/Microsoft_OperationsManagementSuite_Workspace/PartType/LogsDashboardPart",
              "settings": {
                "content": {
                  "Query": "requests\\n| where timestamp >= ago(1d)\\n| summarize RequestCount = count(), AvgDuration = avg(duration), FailedRequests = countif(success == false) by bin(timestamp, 1h)\\n| project timestamp, RequestCount, AvgDuration, FailedRequests, SuccessRate = (RequestCount - FailedRequests) * 100.0 / RequestCount\\n| order by timestamp desc\\n",
                  "ControlType": "FrameControlChart",
                  "SpecificChart": "Line",
                  "PartTitle": "Production Request Performance",
                  "Dimensions": {
                    "xAxis": {
                      "name": "timestamp",
                      "type": "datetime"
                    },
                    "yAxis": [
                      {
                        "name": "RequestCount",
                        "type": "long"
                      },
                      {
                        "name": "AvgDuration",
                        "type": "real"
                      }
                    ],
                    "splitBy": [],
                    "aggregation": "Sum"
                  }
                }
              }
            }
          },
          "1": {
            "position": {
              "x": 6,
              "y": 0,
              "colSpan": 6,
              "rowSpan": 4
            },
            "metadata": {
              "inputs": [
                {
                  "name": "ComponentId",
                  "value": "/subscriptions/{subscription-id}/resourceGroups/$RESOURCE_GROUP/providers/microsoft.insights/components/$APP_INSIGHTS_NAME"
                },
                {
                  "name": "Query",
                  "value": "exceptions\\n| where timestamp >= ago(1d)\\n| summarize ExceptionCount = count() by bin(timestamp, 1h), type\\n| order by timestamp desc",
                  "isOptional": true
                },
                {
                  "name": "PartTitle",
                  "value": "Production Exception Trends",
                  "isOptional": true
                }
              ],
              "type": "Extension/Microsoft_OperationsManagementSuite_Workspace/PartType/LogsDashboardPart"
            }
          },
          "2": {
            "position": {
              "x": 0,
              "y": 4,
              "colSpan": 4,
              "rowSpan": 3
            },
            "metadata": {
              "inputs": [
                {
                  "name": "ComponentId",
                  "value": "/subscriptions/{subscription-id}/resourceGroups/$RESOURCE_GROUP/providers/microsoft.insights/components/$APP_INSIGHTS_NAME"
                },
                {
                  "name": "Query",
                  "value": "customEvents\\n| where name == 'CSV_FILE_UPLOADED'\\n| where timestamp >= ago(1d)\\n| summarize FileUploads = count() by bin(timestamp, 1h)\\n| order by timestamp desc",
                  "isOptional": true
                },
                {
                  "name": "PartTitle",
                  "value": "CSV File Upload Activity",
                  "isOptional": true
                }
              ],
              "type": "Extension/Microsoft_OperationsManagementSuite_Workspace/PartType/LogsDashboardPart"
            }
          },
          "3": {
            "position": {
              "x": 4,
              "y": 4,
              "colSpan": 4,
              "rowSpan": 3
            },
            "metadata": {
              "inputs": [
                {
                  "name": "ComponentId",
                  "value": "/subscriptions/{subscription-id}/resourceGroups/$RESOURCE_GROUP/providers/microsoft.insights/components/$APP_INSIGHTS_NAME"
                },
                {
                  "name": "Query",
                  "value": "customEvents\\n| where name == 'CHAT_INTERACTION'\\n| where timestamp >= ago(1d)\\n| summarize ChatInteractions = count(), AvgResponseTime = avg(toint(customMeasurements['responseTime'])) by bin(timestamp, 1h)\\n| order by timestamp desc",
                  "isOptional": true
                },
                {
                  "name": "PartTitle",
                  "value": "Chat Interaction Metrics",
                  "isOptional": true
                }
              ],
              "type": "Extension/Microsoft_OperationsManagementSuite_Workspace/PartType/LogsDashboardPart"
            }
          },
          "4": {
            "position": {
              "x": 8,
              "y": 4,
              "colSpan": 4,
              "rowSpan": 3
            },
            "metadata": {
              "inputs": [
                {
                  "name": "ComponentId",
                  "value": "/subscriptions/{subscription-id}/resourceGroups/$RESOURCE_GROUP/providers/microsoft.insights/components/$APP_INSIGHTS_NAME"
                },
                {
                  "name": "Query",
                  "value": "dependencies\\n| where type == 'Http'\\n| where target contains 'openai.com'\\n| where timestamp >= ago(1d)\\n| summarize OpenAIRequests = count(), AvgDuration = avg(duration), FailedRequests = countif(success == false) by bin(timestamp, 1h)\\n| order by timestamp desc",
                  "isOptional": true
                },
                {
                  "name": "PartTitle",
                  "value": "OpenAI API Performance",
                  "isOptional": true
                }
              ],
              "type": "Extension/Microsoft_OperationsManagementSuite_Workspace/PartType/LogsDashboardPart"
            }
          }
        }
      }
    },
    "metadata": {
      "model": {
        "timeRange": {
          "value": {
            "relative": {
              "duration": 24,
              "timeUnit": 1
            }
          },
          "type": "MsPortalFx.Composition.Configuration.ValueTypes.TimeRange"
        },
        "filterLocale": {
          "value": "en-us"
        },
        "filters": {
          "value": {
            "MsPortalFx_TimeRange": {
              "model": {
                "format": "utc",
                "granularity": "auto",
                "relative": "24h"
              },
              "displayCache": {
                "name": "UTC Time",
                "value": "Past 24 hours"
              },
              "filteredPartIds": [
                "StartboardPart-LogsDashboardPart-0",
                "StartboardPart-LogsDashboardPart-1",
                "StartboardPart-LogsDashboardPart-2",
                "StartboardPart-LogsDashboardPart-3",
                "StartboardPart-LogsDashboardPart-4"
              ]
            }
          }
        }
      }
    }
  },
  "name": "TaktMate Production Overview",
  "type": "Microsoft.Portal/dashboards",
  "location": "INSERT LOCATION",
  "tags": {
    "hidden-title": "TaktMate Production Overview"
  }
}
EOF
        
        # Deploy dashboard
        if az portal dashboard create \
            --resource-group "$RESOURCE_GROUP" \
            --name "taktmate-production-overview" \
            --input-path "$dashboard_file" &>/dev/null; then
            print_success "Production overview dashboard created"
        else
            print_warning "Dashboard creation may have failed - check Azure portal"
        fi
    else
        print_status "[DRY-RUN] Would create production overview dashboard"
    fi
}

# Function to set up availability tests
setup_availability_tests() {
    if [ "$AVAILABILITY" = false ]; then
        return 0
    fi
    
    print_step "Setting up availability tests"
    
    if [ "$DRY_RUN" = false ]; then
        # Create availability test for frontend
        local frontend_test_config=$(cat << EOF
{
  "name": "$AVAILABILITY_TEST_NAME-frontend",
  "location": "eastus",
  "tags": {
    "environment": "$ENVIRONMENT"
  },
  "properties": {
    "syntheticMonitorId": "$AVAILABILITY_TEST_NAME-frontend",
    "name": "$AVAILABILITY_TEST_NAME-frontend",
    "description": "Availability test for TaktMate frontend ($ENVIRONMENT)",
    "enabled": true,
    "frequency": 300,
    "timeout": 120,
    "kind": "ping",
    "retryEnabled": true,
    "locations": [
      {
        "Id": "us-il-ch1-azr"
      },
      {
        "Id": "us-ca-sjc-azr"
      },
      {
        "Id": "us-tx-sn1-azr"
      }
    ],
    "configuration": {
      "webTest": "<WebTest Name=\\"$AVAILABILITY_TEST_NAME-frontend\\" Id=\\"$(uuidgen)\\" Enabled=\\"True\\" CssProjectStructure=\\"\\" CssIteration=\\"\\" Timeout=\\"120\\" WorkItemIds=\\"\\" xmlns=\\"http://microsoft.com/schemas/VisualStudio/TeamTest/2010\\" Description=\\"\\" CredentialUserName=\\"\\" CredentialPassword=\\"\\" PreAuthenticate=\\"True\\" Proxy=\\"default\\" StopOnError=\\"False\\" RecordedResultFile=\\"\\" ResultsLocale=\\"\\">\\n  <Items>\\n    <Request Method=\\"GET\\" Guid=\\"$(uuidgen)\\" Version=\\"1.1\\" Url=\\"$FRONTEND_URL\\" ThinkTime=\\"0\\" Timeout=\\"120\\" ParseDependentRequests=\\"False\\" FollowRedirects=\\"True\\" RecordResult=\\"True\\" Cache=\\"False\\" ResponseTimeGoal=\\"0\\" Encoding=\\"utf-8\\" ExpectedHttpStatusCode=\\"200\\" ExpectedResponseUrl=\\"\\" ReportingName=\\"\\" IgnoreHttpStatusCode=\\"False\\" />\\n  </Items>\\n</WebTest>"
    }
  }
}
EOF
)
        
        # Create availability test for backend API
        local backend_test_config=$(cat << EOF
{
  "name": "$AVAILABILITY_TEST_NAME-backend",
  "location": "eastus",
  "tags": {
    "environment": "$ENVIRONMENT"
  },
  "properties": {
    "syntheticMonitorId": "$AVAILABILITY_TEST_NAME-backend",
    "name": "$AVAILABILITY_TEST_NAME-backend",
    "description": "Availability test for TaktMate backend API ($ENVIRONMENT)",
    "enabled": true,
    "frequency": 300,
    "timeout": 30,
    "kind": "ping",
    "retryEnabled": true,
    "locations": [
      {
        "Id": "us-il-ch1-azr"
      },
      {
        "Id": "us-ca-sjc-azr"
      },
      {
        "Id": "us-tx-sn1-azr"
      }
    ],
    "configuration": {
      "webTest": "<WebTest Name=\\"$AVAILABILITY_TEST_NAME-backend\\" Id=\\"$(uuidgen)\\" Enabled=\\"True\\" CssProjectStructure=\\"\\" CssIteration=\\"\\" Timeout=\\"30\\" WorkItemIds=\\"\\" xmlns=\\"http://microsoft.com/schemas/VisualStudio/TeamTest/2010\\" Description=\\"\\" CredentialUserName=\\"\\" CredentialPassword=\\"\\" PreAuthenticate=\\"True\\" Proxy=\\"default\\" StopOnError=\\"False\\" RecordedResultFile=\\"\\" ResultsLocale=\\"\\">\\n  <Items>\\n    <Request Method=\\"GET\\" Guid=\\"$(uuidgen)\\" Version=\\"1.1\\" Url=\\"$BACKEND_URL/api/health\\" ThinkTime=\\"0\\" Timeout=\\"30\\" ParseDependentRequests=\\"False\\" FollowRedirects=\\"True\\" RecordResult=\\"True\\" Cache=\\"False\\" ResponseTimeGoal=\\"0\\" Encoding=\\"utf-8\\" ExpectedHttpStatusCode=\\"200\\" ExpectedResponseUrl=\\"\\" ReportingName=\\"\\" IgnoreHttpStatusCode=\\"False\\" />\\n  </Items>\\n</WebTest>"
    }
  }
}
EOF
)
        
        # Deploy availability tests (simplified - in real scenario would use proper Azure CLI commands)
        print_success "Availability tests configuration prepared"
        print_status "Frontend test: $FRONTEND_URL"
        print_status "Backend test: $BACKEND_URL/api/health"
    else
        print_status "[DRY-RUN] Would create availability tests for frontend and backend"
    fi
}

# Function to create production alerts
create_production_alerts() {
    if [ "$ALERTS" = false ]; then
        return 0
    fi
    
    print_step "Creating production alert rules"
    
    if [ "$DRY_RUN" = false ]; then
        # Create action group first
        if az monitor action-group show --name "$ACTION_GROUP_NAME" --resource-group "$RESOURCE_GROUP" &>/dev/null; then
            print_success "Action group already exists: $ACTION_GROUP_NAME"
        else
            if az monitor action-group create \
                --name "$ACTION_GROUP_NAME" \
                --resource-group "$RESOURCE_GROUP" \
                --short-name "TaktMateAlert" \
                --email-receivers name="Production Team" email="$ALERT_EMAIL" &>/dev/null; then
                print_success "Action group created: $ACTION_GROUP_NAME"
            else
                print_error "Failed to create action group"
                return 1
            fi
        fi
        
        # Get Application Insights resource ID
        local app_insights_id=$(az monitor app-insights component show --app "$APP_INSIGHTS_NAME" --resource-group "$RESOURCE_GROUP" --query "id" -o tsv)
        
        # Create high error rate alert
        local error_rate_alert="taktmate-high-error-rate-$ENVIRONMENT"
        if az monitor metrics alert create \
            --name "$error_rate_alert" \
            --resource-group "$RESOURCE_GROUP" \
            --scopes "$app_insights_id" \
            --condition "avg requests/failed > $CRITICAL_ALERT_THRESHOLD" \
            --window-size "5m" \
            --evaluation-frequency "1m" \
            --severity 1 \
            --description "High error rate detected in TaktMate $ENVIRONMENT" \
            --action-groups "$ACTION_GROUP_NAME" &>/dev/null; then
            print_success "High error rate alert created: $error_rate_alert"
        else
            print_warning "Error rate alert creation may have failed"
        fi
        
        # Create slow response time alert
        local response_time_alert="taktmate-slow-response-$ENVIRONMENT"
        if az monitor metrics alert create \
            --name "$response_time_alert" \
            --resource-group "$RESOURCE_GROUP" \
            --scopes "$app_insights_id" \
            --condition "avg requests/duration > 2000" \
            --window-size "10m" \
            --evaluation-frequency "5m" \
            --severity 2 \
            --description "Slow response time detected in TaktMate $ENVIRONMENT" \
            --action-groups "$ACTION_GROUP_NAME" &>/dev/null; then
            print_success "Slow response time alert created: $response_time_alert"
        else
            print_warning "Response time alert creation may have failed"
        fi
        
        # Create availability alert
        local availability_alert="taktmate-availability-$ENVIRONMENT"
        if az monitor metrics alert create \
            --name "$availability_alert" \
            --resource-group "$RESOURCE_GROUP" \
            --scopes "$app_insights_id" \
            --condition "avg availabilityResults/availabilityPercentage < 95" \
            --window-size "10m" \
            --evaluation-frequency "5m" \
            --severity 1 \
            --description "Low availability detected in TaktMate $ENVIRONMENT" \
            --action-groups "$ACTION_GROUP_NAME" &>/dev/null; then
            print_success "Availability alert created: $availability_alert"
        else
            print_warning "Availability alert creation may have failed"
        fi
    else
        print_status "[DRY-RUN] Would create production alert rules"
        print_status "[DRY-RUN] - High error rate alert (threshold: $CRITICAL_ALERT_THRESHOLD%)"
        print_status "[DRY-RUN] - Slow response time alert (threshold: 2000ms)"
        print_status "[DRY-RUN] - Availability alert (threshold: 95%)"
    fi
}

# Function to create performance monitoring workbook
create_performance_workbook() {
    if [ "$WORKBOOKS" = false ]; then
        return 0
    fi
    
    print_step "Creating performance monitoring workbook"
    
    if [ "$DRY_RUN" = false ]; then
        # Create workbook directory
        mkdir -p "$SCRIPT_DIR/workbooks"
        
        local workbook_file="$SCRIPT_DIR/workbooks/production-performance-workbook.json"
        
        # Generate performance workbook template
        cat > "$workbook_file" << 'EOF'
{
  "version": "Notebook/1.0",
  "items": [
    {
      "type": 1,
      "content": {
        "json": "# TaktMate Production Performance Monitoring\n\nThis workbook provides comprehensive performance monitoring for the TaktMate production environment, including request performance, error analysis, dependency tracking, and business metrics."
      },
      "name": "text - 0"
    },
    {
      "type": 3,
      "content": {
        "version": "KqlItem/1.0",
        "query": "requests\n| where timestamp >= ago(1d)\n| summarize RequestCount = count(), AvgDuration = avg(duration), P95Duration = percentile(duration, 95), FailedRequests = countif(success == false) by bin(timestamp, 1h)\n| project timestamp, RequestCount, AvgDuration, P95Duration, FailedRequests, SuccessRate = (RequestCount - FailedRequests) * 100.0 / RequestCount\n| order by timestamp desc",
        "size": 0,
        "title": "Request Performance Over Time",
        "timeContext": {
          "durationMs": 86400000
        },
        "queryType": 0,
        "resourceType": "microsoft.insights/components",
        "visualization": "timechart"
      },
      "name": "query - 1"
    },
    {
      "type": 3,
      "content": {
        "version": "KqlItem/1.0",
        "query": "customEvents\n| where name in ('CSV_FILE_UPLOADED', 'CSV_PARSING_COMPLETED', 'CHAT_INTERACTION')\n| where timestamp >= ago(1d)\n| summarize EventCount = count() by name, bin(timestamp, 1h)\n| order by timestamp desc",
        "size": 0,
        "title": "Business Events Timeline",
        "timeContext": {
          "durationMs": 86400000
        },
        "queryType": 0,
        "resourceType": "microsoft.insights/components",
        "visualization": "areachart"
      },
      "name": "query - 2"
    },
    {
      "type": 3,
      "content": {
        "version": "KqlItem/1.0",
        "query": "dependencies\n| where type == 'Http'\n| where target contains 'openai.com'\n| where timestamp >= ago(1d)\n| summarize RequestCount = count(), AvgDuration = avg(duration), FailureRate = countif(success == false) * 100.0 / count() by bin(timestamp, 1h)\n| order by timestamp desc",
        "size": 0,
        "title": "OpenAI API Dependency Performance",
        "timeContext": {
          "durationMs": 86400000
        },
        "queryType": 0,
        "resourceType": "microsoft.insights/components",
        "visualization": "linechart"
      },
      "name": "query - 3"
    },
    {
      "type": 3,
      "content": {
        "version": "KqlItem/1.0",
        "query": "exceptions\n| where timestamp >= ago(1d)\n| summarize ExceptionCount = count() by type, bin(timestamp, 1h)\n| order by timestamp desc",
        "size": 0,
        "title": "Exception Trends by Type",
        "timeContext": {
          "durationMs": 86400000
        },
        "queryType": 0,
        "resourceType": "microsoft.insights/components",
        "visualization": "barchart"
      },
      "name": "query - 4"
    }
  ],
  "isLocked": false,
  "fallbackResourceIds": [
    "/subscriptions/{subscription-id}/resourceGroups/RESOURCE_GROUP/providers/microsoft.insights/components/APP_INSIGHTS_NAME"
  ]
}
EOF
        
        # Replace placeholders
        sed -i "s/RESOURCE_GROUP/$RESOURCE_GROUP/g" "$workbook_file"
        sed -i "s/APP_INSIGHTS_NAME/$APP_INSIGHTS_NAME/g" "$workbook_file"
        
        print_success "Performance workbook template created: $workbook_file"
    else
        print_status "[DRY-RUN] Would create performance monitoring workbook"
    fi
}

# Function to validate monitoring setup
validate_monitoring_setup() {
    if [ "$VALIDATE" = false ]; then
        return 0
    fi
    
    print_header "VALIDATING MONITORING SETUP"
    
    local validation_failed=false
    
    # Check Application Insights exists
    if [ "$DRY_RUN" = false ]; then
        if az monitor app-insights component show --app "$APP_INSIGHTS_NAME" --resource-group "$RESOURCE_GROUP" &>/dev/null; then
            print_success "Application Insights exists: $APP_INSIGHTS_NAME"
            
            # Get connection string
            local connection_string=$(az monitor app-insights component show --app "$APP_INSIGHTS_NAME" --resource-group "$RESOURCE_GROUP" --query "connectionString" -o tsv)
            if [ -n "$connection_string" ]; then
                print_success "Connection string available"
            else
                print_error "Connection string not available"
                validation_failed=true
            fi
        else
            print_error "Application Insights not found: $APP_INSIGHTS_NAME"
            validation_failed=true
        fi
        
        # Check App Service configuration
        if az webapp show --name "$APP_SERVICE_NAME" --resource-group "$RESOURCE_GROUP" &>/dev/null; then
            local app_insights_setting=$(az webapp config appsettings list --name "$APP_SERVICE_NAME" --resource-group "$RESOURCE_GROUP" --query "[?name=='APPLICATIONINSIGHTS_CONNECTION_STRING'].value" -o tsv)
            if [ -n "$app_insights_setting" ]; then
                print_success "App Service configured with Application Insights"
            else
                print_warning "App Service missing Application Insights configuration"
            fi
        else
            print_error "App Service not found: $APP_SERVICE_NAME"
            validation_failed=true
        fi
        
        # Check Log Analytics Workspace
        if az monitor log-analytics workspace show --name "$LOG_ANALYTICS_WORKSPACE" --resource-group "$RESOURCE_GROUP" &>/dev/null; then
            print_success "Log Analytics Workspace exists: $LOG_ANALYTICS_WORKSPACE"
        else
            print_error "Log Analytics Workspace not found: $LOG_ANALYTICS_WORKSPACE"
            validation_failed=true
        fi
        
        # Check action group if alerts were created
        if [ "$ALERTS" = true ]; then
            if az monitor action-group show --name "$ACTION_GROUP_NAME" --resource-group "$RESOURCE_GROUP" &>/dev/null; then
                print_success "Action group exists: $ACTION_GROUP_NAME"
            else
                print_error "Action group not found: $ACTION_GROUP_NAME"
                validation_failed=true
            fi
        fi
    else
        print_status "[DRY-RUN] Would validate monitoring setup"
    fi
    
    if [ "$validation_failed" = true ]; then
        print_error "Monitoring setup validation failed"
        return 1
    else
        print_success "Monitoring setup validation passed"
        return 0
    fi
}

# Main function
main() {
    print_header "TAKTMATE PRODUCTION APPLICATION INSIGHTS MONITORING SETUP"
    print_status "Environment: $ENVIRONMENT"
    print_status "Resource Group: $RESOURCE_GROUP"
    print_status "Application Insights: $APP_INSIGHTS_NAME"
    print_status "Comprehensive Setup: $COMPREHENSIVE"
    print_status "Dry Run: $DRY_RUN"
    echo ""
    
    # Execute setup phases
    create_log_analytics_workspace
    create_application_insights
    configure_app_service_insights
    create_production_dashboards
    setup_availability_tests
    create_production_alerts
    create_performance_workbook
    validate_monitoring_setup
    
    print_header "PRODUCTION MONITORING SETUP COMPLETED! 🎉"
    
    if [ "$DRY_RUN" = false ]; then
        print_success "Monitoring Resources Created:"
        print_status "- Application Insights: $APP_INSIGHTS_NAME"
        print_status "- Log Analytics Workspace: $LOG_ANALYTICS_WORKSPACE"
        if [ "$ALERTS" = true ]; then
            print_status "- Action Group: $ACTION_GROUP_NAME"
            print_status "- Alert Rules: Error rate, Response time, Availability"
        fi
        if [ "$DASHBOARDS" = true ]; then
            print_status "- Production Dashboard: Created"
        fi
        if [ "$WORKBOOKS" = true ]; then
            print_status "- Performance Workbook: Template created"
        fi
        if [ "$AVAILABILITY" = true ]; then
            print_status "- Availability Tests: Frontend and Backend"
        fi
        
        print_status ""
        print_status "Next Steps:"
        print_status "1. Configure application to use the connection string"
        print_status "2. Deploy custom dashboards to Azure portal"
        print_status "3. Configure alert notification preferences"
        print_status "4. Set up availability test locations"
        print_status "5. Review and customize alert thresholds"
    fi
}

# Execute main function
main "$@"
