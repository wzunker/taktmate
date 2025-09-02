#!/usr/bin/env node

/**
 * Session management utility for TaktMate
 * Usage: node scripts/manage-sessions.js [command] [options]
 */

require('dotenv').config();
const { initializeDatabase, closeDatabase } = require('../config/database');
const Session = require('../models/Session');
const User = require('../models/User');

async function showHelp() {
  console.log('TaktMate Session Management Utility');
  console.log('');
  console.log('Usage:');
  console.log('  node scripts/manage-sessions.js [command] [options]');
  console.log('');
  console.log('Commands:');
  console.log('  stats                    Show session statistics');
  console.log('  list                     List all active sessions');
  console.log('  cleanup                  Clean up expired sessions');
  console.log('  invalidate-user <email>  Invalidate all sessions for a user');
  console.log('  suspicious               Check for suspicious session activity');
  console.log('  help, -h, --help         Show this help message');
  console.log('');
  console.log('Examples:');
  console.log('  node scripts/manage-sessions.js stats');
  console.log('  node scripts/manage-sessions.js list');
  console.log('  node scripts/manage-sessions.js cleanup');
  console.log('  node scripts/manage-sessions.js invalidate-user john@example.com');
}

async function showStats() {
  try {
    console.log('📊 Session Statistics');
    console.log('=' .repeat(50));
    
    const stats = await Session.getStatistics();
    
    console.log(`Total Sessions:           ${stats.total_sessions}`);
    console.log(`Active Sessions:          ${stats.active_sessions}`);
    console.log(`Expired Sessions:         ${stats.expired_sessions}`);
    console.log(`Inactive Sessions:        ${stats.inactive_sessions}`);
    console.log(`Sessions (Last 24h):      ${stats.sessions_last_24h}`);
    console.log(`Sessions (Last Hour):     ${stats.sessions_last_hour}`);
    
    console.log('');
    console.log('📈 Health Indicators:');
    const activeRatio = stats.total_sessions > 0 ? (stats.active_sessions / stats.total_sessions * 100).toFixed(1) : 0;
    console.log(`Active Session Ratio:     ${activeRatio}%`);
    
    if (stats.active_sessions > 1000) {
      console.log('⚠️  High number of active sessions detected');
    }
    
    if (stats.sessions_last_hour > 100) {
      console.log('⚠️  High session creation rate in last hour');
    }
    
  } catch (error) {
    console.error('❌ Error getting session statistics:', error.message);
  }
}

async function listActiveSessions() {
  try {
    console.log('📋 Active Sessions');
    console.log('=' .repeat(80));
    
    const sessions = await Session.getActiveSessions();
    
    if (sessions.length === 0) {
      console.log('No active sessions found.');
      return;
    }
    
    console.log(`Found ${sessions.length} active sessions:\n`);
    
    sessions.forEach((session, index) => {
      console.log(`${index + 1}. ${session.user_name} (${session.user_email})`);
      console.log(`   Session ID: ${session.session_id.substring(0, 20)}...`);
      console.log(`   Created:    ${new Date(session.created_at).toLocaleString()}`);
      console.log(`   Last Access: ${new Date(session.last_accessed).toLocaleString()}`);
      console.log(`   Expires:    ${new Date(session.expires_at).toLocaleString()}`);
      console.log(`   IP Address: ${session.ip_address || 'N/A'}`);
      console.log(`   Inactive:   ${session.minutes_inactive} minutes`);
      console.log('');
    });
    
  } catch (error) {
    console.error('❌ Error listing active sessions:', error.message);
  }
}

async function cleanupExpiredSessions() {
  try {
    console.log('🧹 Cleaning up expired sessions...');
    
    const deletedCount = await Session.cleanupExpired();
    
    console.log(`✅ Cleaned up ${deletedCount} expired sessions`);
    
    if (deletedCount > 0) {
      // Show updated stats
      console.log('\n📊 Updated Statistics:');
      const stats = await Session.getStatistics();
      console.log(`Active Sessions:    ${stats.active_sessions}`);
      console.log(`Total Sessions:     ${stats.total_sessions}`);
    }
    
  } catch (error) {
    console.error('❌ Error cleaning up sessions:', error.message);
  }
}

async function invalidateUserSessions(email) {
  try {
    console.log(`🔒 Invalidating all sessions for user: ${email}`);
    
    // Find user by email
    const user = await User.findByEmail(email);
    if (!user) {
      console.log('❌ User not found');
      return;
    }
    
    // Get current active sessions count
    const currentSessions = await Session.findByUserId(user.id);
    console.log(`Found ${currentSessions.length} active sessions for user`);
    
    if (currentSessions.length === 0) {
      console.log('No active sessions to invalidate');
      return;
    }
    
    // Invalidate all sessions
    const invalidatedCount = await Session.invalidateAllForUser(user.id);
    
    console.log(`✅ Invalidated ${invalidatedCount} sessions for ${user.name} (${user.email})`);
    
  } catch (error) {
    console.error('❌ Error invalidating user sessions:', error.message);
  }
}

async function checkSuspiciousActivity() {
  try {
    console.log('🔍 Checking for suspicious session activity...');
    console.log('=' .repeat(50));
    
    // Get all active sessions
    const sessions = await Session.getActiveSessions();
    
    if (sessions.length === 0) {
      console.log('No active sessions to analyze');
      return;
    }
    
    // Group sessions by user
    const userSessions = {};
    sessions.forEach(session => {
      if (!userSessions[session.user_id]) {
        userSessions[session.user_id] = {
          user: {
            id: session.user_id,
            name: session.user_name,
            email: session.user_email
          },
          sessions: []
        };
      }
      userSessions[session.user_id].sessions.push(session);
    });
    
    let suspiciousCount = 0;
    
    for (const [userId, userData] of Object.entries(userSessions)) {
      const userSessionList = userData.sessions;
      const uniqueIPs = new Set(userSessionList.map(s => s.ip_address).filter(ip => ip)).size;
      
      // Check for suspicious patterns
      let suspicious = false;
      let reasons = [];
      
      if (userSessionList.length > 5) {
        suspicious = true;
        reasons.push(`${userSessionList.length} concurrent sessions`);
      }
      
      if (uniqueIPs > 3) {
        suspicious = true;
        reasons.push(`${uniqueIPs} different IP addresses`);
      }
      
      // Check for sessions from very different locations (basic check)
      const recentSessions = userSessionList.filter(s => 
        new Date(s.last_accessed).getTime() > Date.now() - 60 * 60 * 1000 // Last hour
      );
      
      if (recentSessions.length > 3) {
        suspicious = true;
        reasons.push(`${recentSessions.length} sessions active in last hour`);
      }
      
      if (suspicious) {
        suspiciousCount++;
        console.log(`⚠️  SUSPICIOUS: ${userData.user.name} (${userData.user.email})`);
        console.log(`   Reasons: ${reasons.join(', ')}`);
        console.log(`   Sessions: ${userSessionList.length}`);
        console.log(`   Unique IPs: ${uniqueIPs}`);
        console.log('');
      }
    }
    
    if (suspiciousCount === 0) {
      console.log('✅ No suspicious session activity detected');
    } else {
      console.log(`Found ${suspiciousCount} users with suspicious session patterns`);
    }
    
  } catch (error) {
    console.error('❌ Error checking suspicious activity:', error.message);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  if (!command || command === 'help' || command === '-h' || command === '--help') {
    await showHelp();
    return;
  }
  
  try {
    console.log('🔌 Connecting to database...');
    await initializeDatabase();
    
    switch (command) {
      case 'stats':
        await showStats();
        break;
        
      case 'list':
        await listActiveSessions();
        break;
        
      case 'cleanup':
        await cleanupExpiredSessions();
        break;
        
      case 'invalidate-user':
        const email = args[1];
        if (!email) {
          console.error('❌ Email address required');
          console.log('Usage: node scripts/manage-sessions.js invalidate-user <email>');
          process.exit(1);
        }
        await invalidateUserSessions(email);
        break;
        
      case 'suspicious':
        await checkSuspiciousActivity();
        break;
        
      default:
        console.error(`❌ Unknown command: ${command}`);
        console.log('Run with --help to see available commands');
        process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Script execution failed:', error.message);
    process.exit(1);
  } finally {
    await closeDatabase();
  }
}

// Run the script
main();
