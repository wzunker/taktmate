const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const MicrosoftStrategy = require('passport-microsoft').Strategy;
const User = require('../models/User');
const AuthService = require('../services/authService');

// Initialize auth service
const authService = new AuthService();

/**
 * Passport.js configuration for TaktMate authentication
 */

// Serialize user for session
passport.serializeUser((user, done) => {
  done(null, user.id);
});

// Deserialize user from session
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

/**
 * Local Strategy (Email/Password)
 */
passport.use(new LocalStrategy(
  {
    usernameField: 'email',
    passwordField: 'password',
    passReqToCallback: true
  },
  async (req, email, password, done) => {
    try {
      const result = await authService.authenticateUser(email, password, {
        ipAddress: req.clientInfo?.ipAddress,
        userAgent: req.clientInfo?.userAgent
      });

      return done(null, result);
    } catch (error) {
      return done(null, false, { message: error.message });
    }
  }
));

/**
 * Google OAuth Strategy
 */
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL || '/auth/google/callback',
      scope: ['profile', 'email'],
      passReqToCallback: true
    },
    async (req, accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails[0].value;
        const name = profile.displayName;
        
        // Check if user already exists
        let user = await User.findByEmail(email);
        
        if (user) {
          // User exists, check if they have Google OAuth linked
          const { executeQuery } = require('./database');
          const oauthCheck = await executeQuery(
            'SELECT * FROM OAuthTokens WHERE user_id = @userId AND provider = @provider',
            { userId: user.id, provider: 'google' }
          );
          
          if (oauthCheck.recordset.length === 0) {
            // Link Google account to existing user
            await executeQuery(
              `INSERT INTO OAuthTokens (user_id, provider, provider_user_id, access_token, refresh_token, scope, created_at)
               VALUES (@userId, @provider, @providerUserId, @accessToken, @refreshToken, @scope, GETUTCDATE())`,
              {
                userId: user.id,
                provider: 'google',
                providerUserId: profile.id,
                accessToken: accessToken,
                refreshToken: refreshToken,
                scope: profile._json.scope || 'profile email'
              }
            );
          } else {
            // Update existing OAuth tokens
            await executeQuery(
              `UPDATE OAuthTokens 
               SET access_token = @accessToken, refresh_token = @refreshToken, updated_at = GETUTCDATE()
               WHERE user_id = @userId AND provider = @provider`,
              {
                userId: user.id,
                provider: 'google',
                accessToken: accessToken,
                refreshToken: refreshToken
              }
            );
          }
          
          // Update last login
          await user.updateLastLogin();
          
        } else {
          // Create new user
          user = await User.create({
            name: name,
            email: email,
            company: profile._json.organization || null,
            // No password for OAuth users
          });
          
          // Set email as verified since it's from Google
          await user.verifyEmail(user.email_verification_token);
          
          // Create OAuth record
          await executeQuery(
            `INSERT INTO OAuthTokens (user_id, provider, provider_user_id, access_token, refresh_token, scope, created_at)
             VALUES (@userId, @provider, @providerUserId, @accessToken, @refreshToken, @scope, GETUTCDATE())`,
            {
              userId: user.id,
              provider: 'google',
              providerUserId: profile.id,
              accessToken: accessToken,
              refreshToken: refreshToken,
              scope: profile._json.scope || 'profile email'
            }
          );
        }

        // Log OAuth login
        await User.logAuditEvent(user.id, 'oauth_login', 'Users', req.clientInfo?.ipAddress, {
          provider: 'google',
          email: user.email,
          provider_user_id: profile.id
        });

        const authResult = {
          user,
          token: authService.generateJWT(user),
          provider: 'google',
          isNewUser: !user.last_login
        };

        return done(null, authResult);
        
      } catch (error) {
        console.error('Google OAuth error:', error);
        return done(error, null);
      }
    }
  ));
} else {
  console.warn('Google OAuth not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables.');
}

/**
 * Microsoft OAuth Strategy
 */
if (process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET) {
  passport.use(new MicrosoftStrategy(
    {
      clientID: process.env.MICROSOFT_CLIENT_ID,
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
      callbackURL: process.env.MICROSOFT_CALLBACK_URL || '/auth/microsoft/callback',
      scope: ['user.read'],
      passReqToCallback: true
    },
    async (req, accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails[0].value;
        const name = profile.displayName;
        
        // Check if user already exists
        let user = await User.findByEmail(email);
        
        if (user) {
          // User exists, check if they have Microsoft OAuth linked
          const { executeQuery } = require('./database');
          const oauthCheck = await executeQuery(
            'SELECT * FROM OAuthTokens WHERE user_id = @userId AND provider = @provider',
            { userId: user.id, provider: 'microsoft' }
          );
          
          if (oauthCheck.recordset.length === 0) {
            // Link Microsoft account to existing user
            await executeQuery(
              `INSERT INTO OAuthTokens (user_id, provider, provider_user_id, access_token, refresh_token, scope, created_at)
               VALUES (@userId, @provider, @providerUserId, @accessToken, @refreshToken, @scope, GETUTCDATE())`,
              {
                userId: user.id,
                provider: 'microsoft',
                providerUserId: profile.id,
                accessToken: accessToken,
                refreshToken: refreshToken,
                scope: 'user.read'
              }
            );
          } else {
            // Update existing OAuth tokens
            await executeQuery(
              `UPDATE OAuthTokens 
               SET access_token = @accessToken, refresh_token = @refreshToken, updated_at = GETUTCDATE()
               WHERE user_id = @userId AND provider = @provider`,
              {
                userId: user.id,
                provider: 'microsoft',
                accessToken: accessToken,
                refreshToken: refreshToken
              }
            );
          }
          
          // Update last login
          await user.updateLastLogin();
          
        } else {
          // Create new user
          user = await User.create({
            name: name,
            email: email,
            company: profile._json.companyName || null,
            role: profile._json.jobTitle || null,
            // No password for OAuth users
          });
          
          // Set email as verified since it's from Microsoft
          await user.verifyEmail(user.email_verification_token);
          
          // Create OAuth record
          await executeQuery(
            `INSERT INTO OAuthTokens (user_id, provider, provider_user_id, access_token, refresh_token, scope, created_at)
             VALUES (@userId, @provider, @providerUserId, @accessToken, @refreshToken, @scope, GETUTCDATE())`,
            {
              userId: user.id,
              provider: 'microsoft',
              providerUserId: profile.id,
              accessToken: accessToken,
              refreshToken: refreshToken,
              scope: 'user.read'
            }
          );
        }

        // Log OAuth login
        await User.logAuditEvent(user.id, 'oauth_login', 'Users', req.clientInfo?.ipAddress, {
          provider: 'microsoft',
          email: user.email,
          provider_user_id: profile.id
        });

        const authResult = {
          user,
          token: authService.generateJWT(user),
          provider: 'microsoft',
          isNewUser: !user.last_login
        };

        return done(null, authResult);
        
      } catch (error) {
        console.error('Microsoft OAuth error:', error);
        return done(error, null);
      }
    }
  ));
} else {
  console.warn('Microsoft OAuth not configured. Set MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET environment variables.');
}

/**
 * Helper function to get OAuth providers configuration
 */
function getOAuthProviders() {
  const providers = [];
  
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    providers.push({
      name: 'google',
      displayName: 'Google',
      authUrl: '/auth/google',
      configured: true
    });
  } else {
    providers.push({
      name: 'google',
      displayName: 'Google',
      configured: false,
      error: 'Not configured'
    });
  }
  
  if (process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET) {
    providers.push({
      name: 'microsoft',
      displayName: 'Microsoft',
      authUrl: '/auth/microsoft',
      configured: true
    });
  } else {
    providers.push({
      name: 'microsoft',
      displayName: 'Microsoft',
      configured: false,
      error: 'Not configured'
    });
  }
  
  return providers;
}

/**
 * Middleware to initialize Passport
 */
function initializePassport(app) {
  app.use(passport.initialize());
  app.use(passport.session());
  
  console.log('✅ Passport.js initialized');
  
  const providers = getOAuthProviders();
  const configuredProviders = providers.filter(p => p.configured);
  const unconfiguredProviders = providers.filter(p => !p.configured);
  
  if (configuredProviders.length > 0) {
    console.log('🔑 OAuth providers configured:', configuredProviders.map(p => p.displayName).join(', '));
  }
  
  if (unconfiguredProviders.length > 0) {
    console.log('⚠️  OAuth providers not configured:', unconfiguredProviders.map(p => p.displayName).join(', '));
  }
}

module.exports = {
  passport,
  initializePassport,
  getOAuthProviders
};
