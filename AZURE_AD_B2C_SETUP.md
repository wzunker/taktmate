# Azure AD B2C Setup Guide for TaktMate

This guide provides step-by-step instructions for setting up Azure Active Directory B2C (Azure AD B2C) for the TaktMate CSV chat application.

## Overview

Azure AD B2C will handle:
- User registration and sign-in
- Google and Microsoft OAuth integration
- Email/password authentication
- User profile management (name, company, role, email)
- JWT token generation and validation
- GDPR compliance features

## Prerequisites

- Azure subscription with appropriate permissions
- Domain ownership for app.taktconnect.com (for production)
- Access to Azure portal (portal.azure.com)

## Step 1: Create Azure AD B2C Tenant

### 1.1 Create the Tenant

1. **Navigate to Azure Portal**
   - Go to [portal.azure.com](https://portal.azure.com)
   - Sign in with your Azure account

2. **Create Azure AD B2C Resource**
   - Click "Create a resource"
   - Search for "Azure Active Directory B2C"
   - Click "Create"

3. **Choose Creation Option**
   - Select "Create a new Azure AD B2C Tenant"
   - Click "Create"

4. **Configure Tenant Settings**
   - **Organization name**: `TaktMate`
   - **Initial domain name**: `taktmate` (will create taktmate.onmicrosoft.com)
   - **Country/Region**: `United States` (or your preferred region)
   - **Subscription**: Select your Azure subscription
   - **Resource group**: Create new: `rg-taktmate-prod`
   - **Location**: `East US` (or your preferred region)

5. **Review and Create**
   - Review settings
   - Click "Create"
   - Wait for deployment (typically 2-3 minutes)

### 1.2 Switch to the B2C Tenant

1. **Access the New Tenant**
   - After creation, click "Go to resource"
   - Or use the directory switcher in the top-right corner
   - Select the new TaktMate B2C tenant

2. **Verify Tenant Access**
   - Confirm you're in the correct tenant: `taktmate.onmicrosoft.com`
   - The portal should show "Azure AD B2C" services

## Step 2: Configure Basic B2C Settings

### 2.1 Set Up Identity Providers

1. **Navigate to Identity Providers**
   - In Azure AD B2C, go to "Identity providers"
   - You'll see "Local Account" is already configured

2. **Add Google Identity Provider**
   - Click "New OpenID Connect provider"
   - **Name**: `Google`
   - **Metadata URL**: `https://accounts.google.com/.well-known/openid_configuration`
   - **Client ID**: (You'll need to get this from Google Cloud Console)
   - **Client Secret**: (You'll need to get this from Google Cloud Console)
   - **Scope**: `openid profile email`
   - **Response type**: `code`
   - **Response mode**: `form_post`
   - **Domain hint**: `google.com`
   - Click "Save"

3. **Add Microsoft Identity Provider**
   - Click "New OpenID Connect provider"
   - **Name**: `Microsoft`
   - **Metadata URL**: `https://login.microsoftonline.com/common/v2.0/.well-known/openid_configuration`
   - **Client ID**: (You'll need to register an app in Azure AD)
   - **Client Secret**: (You'll need to register an app in Azure AD)
   - **Scope**: `openid profile email`
   - **Response type**: `code`
   - **Response mode**: `form_post`
   - **Domain hint**: `live.com`
   - Click "Save"

### 2.2 Configure User Attributes

1. **Navigate to User Attributes**
   - In Azure AD B2C, go to "User attributes"
   - Review built-in attributes

2. **Add Custom Attributes**
   - Click "Add"
   - **Name**: `Company`
   - **Data Type**: `String`
   - **Description**: `User's company name`
   - Click "Create"

   - Click "Add"
   - **Name**: `Role`
   - **Data Type**: `String`
   - **Description**: `User's job role/title`
   - Click "Create"

### 2.3 Basic Security Settings

1. **Configure Password Complexity**
   - Go to "Authentication methods"
   - Select "Password"
   - Configure minimum requirements:
     - **Minimum length**: 8 characters
     - **Require lowercase**: Yes
     - **Require uppercase**: Yes
     - **Require digits**: Yes
     - **Require special characters**: Yes

2. **Set Session Management**
   - Go to "Session behavior"
   - **SSO session lifetime**: 7 days
   - **Refresh token lifetime**: 90 days
   - **Require re-authentication**: After 24 hours of inactivity

## Step 3: Environment Variables Configuration

Create the following environment variables for your application:

### Development Environment (.env.development)
```bash
# Azure AD B2C Configuration
AZURE_AD_B2C_TENANT_NAME=taktmate
AZURE_AD_B2C_TENANT_ID=your-tenant-id-guid
AZURE_AD_B2C_CLIENT_ID=your-app-client-id
AZURE_AD_B2C_CLIENT_SECRET=your-app-client-secret
AZURE_AD_B2C_DOMAIN=taktmate.b2clogin.com
AZURE_AD_B2C_SIGN_UP_SIGN_IN_POLICY=B2C_1_signupsignin1
AZURE_AD_B2C_REDIRECT_URI=http://localhost:3000/auth/callback
AZURE_AD_B2C_POST_LOGOUT_REDIRECT_URI=http://localhost:3000
AZURE_AD_B2C_SCOPE=openid profile email

# Backend Configuration
BACKEND_URL=http://localhost:3001
FRONTEND_URL=http://localhost:3000
```

### Production Environment (.env.production)
```bash
# Azure AD B2C Configuration
AZURE_AD_B2C_TENANT_NAME=taktmate
AZURE_AD_B2C_TENANT_ID=your-tenant-id-guid
AZURE_AD_B2C_CLIENT_ID=your-app-client-id
AZURE_AD_B2C_CLIENT_SECRET=your-app-client-secret
AZURE_AD_B2C_DOMAIN=taktmate.b2clogin.com
AZURE_AD_B2C_SIGN_UP_SIGN_IN_POLICY=B2C_1_signupsignin1
AZURE_AD_B2C_REDIRECT_URI=https://app.taktconnect.com/auth/callback
AZURE_AD_B2C_POST_LOGOUT_REDIRECT_URI=https://app.taktconnect.com
AZURE_AD_B2C_SCOPE=openid profile email

# Backend Configuration
BACKEND_URL=https://api-taktmate.azurewebsites.net
FRONTEND_URL=https://app.taktconnect.com
```

## Step 4: OAuth Provider Setup

### 4.1 Google OAuth Setup

1. **Go to Google Cloud Console**
   - Visit [console.cloud.google.com](https://console.cloud.google.com)
   - Create a new project or select existing: "TaktMate"

2. **Enable Google+ API**
   - Go to "APIs & Services" > "Library"
   - Search for "Google+ API" and enable it

3. **Create OAuth 2.0 Credentials**
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth 2.0 Client ID"
   - **Application type**: Web application
   - **Name**: TaktMate Azure AD B2C
   - **Authorized redirect URIs**: 
     - `https://taktmate.b2clogin.com/taktmate.onmicrosoft.com/oauth2/authresp`
   - Click "Create"
   - **Save the Client ID and Client Secret** for Azure AD B2C configuration

### 4.2 Microsoft OAuth Setup

1. **Go to Azure Portal**
   - Navigate to "Azure Active Directory" (not B2C)
   - Go to "App registrations"

2. **Register New Application**
   - Click "New registration"
   - **Name**: TaktMate B2C Microsoft Auth
   - **Supported account types**: Accounts in any organizational directory and personal Microsoft accounts
   - **Redirect URI**: Web - `https://taktmate.b2clogin.com/taktmate.onmicrosoft.com/oauth2/authresp`
   - Click "Register"

3. **Configure Application**
   - **Save the Application (client) ID** for Azure AD B2C
   - Go to "Certificates & secrets"
   - Click "New client secret"
   - **Description**: B2C Integration Secret
   - **Expires**: 24 months
   - Click "Add"
   - **Save the secret value** for Azure AD B2C configuration

## Step 5: Create User Flows (Task 1.2)

User flows define the authentication experience for your users. We'll create a combined sign-up and sign-in flow that supports all three authentication methods.

### 5.1 Create Sign-up and Sign-in User Flow

1. **Navigate to User Flows**
   - In Azure AD B2C, go to "User flows"
   - Click "New user flow"

2. **Select Flow Type**
   - Choose "Sign up and sign in"
   - Select "Recommended" version
   - Click "Create"

3. **Configure Basic Settings**
   - **Name**: `signupsignin1` (this creates policy name `B2C_1_signupsignin1`)
   - **Identity providers**: Select all three:
     - ✅ Local Account (Email signup)
     - ✅ Google (if configured)
     - ✅ Microsoft (if configured)

4. **Configure Multifactor Authentication**
   - **MFA enforcement**: Optional (recommended for production)
   - **MFA type**: SMS and Email (if enabling MFA)

5. **Configure User Attributes and Claims**
   
   **User attributes (collected during sign-up):**
   - ✅ Email Address
   - ✅ Given Name
   - ✅ Surname
   - ✅ Display Name
   - ✅ Company (custom attribute)
   - ✅ Role (custom attribute)
   
   **Application claims (returned in tokens):**
   - ✅ Email Addresses
   - ✅ Given Name
   - ✅ Surname
   - ✅ Display Name
   - ✅ User's Object ID
   - ✅ Company (custom attribute)
   - ✅ Role (custom attribute)
   - ✅ Identity Provider
   - ✅ Identity Provider Access Token (optional, for advanced scenarios)

6. **Review and Create**
   - Review all settings
   - Click "Create"
   - Wait for user flow creation (usually 30-60 seconds)

### 5.2 Configure User Flow Properties

1. **Access User Flow Settings**
   - Click on the newly created `B2C_1_signupsignin1` user flow
   - Go to "Properties"

2. **Configure Token Settings**
   - **Token lifetime (minutes)**: `60` (1 hour)
   - **Refresh token lifetime (days)**: `7` (matches PRD requirement)
   - **Sliding window refresh token lifetime**: `Enabled`
   - **Refresh token lifetime (days) - sliding window**: `90`
   - **Access token lifetime (minutes)**: `60`
   - **ID token lifetime (minutes)**: `60`

3. **Configure Session Behavior**
   - **Single sign-on session lifetime (minutes)**: `10080` (7 days, matches PRD)
   - **Single sign-on session timeout**: `Rolling` (session extends with activity)
   - **Require ID token in logout requests**: `Yes`

4. **Save Configuration**
   - Click "Save"

### 5.3 Test User Flow

1. **Run User Flow Test**
   - In the user flow, click "Run user flow"
   - **Application**: Select your registered app (will be created in Task 1.4)
   - **Reply URL**: Use `https://jwt.ms` for testing
   - Click "Run user flow"

2. **Test Authentication Methods**
   
   **Test Email/Password Registration:**
   - Click "Sign up now"
   - Fill in required fields:
     - Email address
     - Password (meeting complexity requirements)
     - Given name, Surname, Display name
     - Company, Role (custom fields)
   - Complete email verification
   - Verify token contains all expected claims
   
   **Test Google Sign-in (if configured):**
   - Click "Google" button
   - Complete Google OAuth flow
   - Verify token contains Google profile information
   - Check that custom attributes can be collected
   
   **Test Microsoft Sign-in (if configured):**
   - Click "Microsoft" button
   - Complete Microsoft OAuth flow
   - Verify token contains Microsoft profile information
   - Check that custom attributes can be collected

3. **Verify Token Claims**
   - After successful authentication, check the JWT token at jwt.ms
   - Ensure all required claims are present:
     - `sub` (user ID)
     - `emails` (email array)
     - `given_name`, `family_name`, `name`
     - `extension_Company` (custom attribute)
     - `extension_Role` (custom attribute)
     - `iss` (issuer)
     - `aud` (audience)
     - `exp` (expiration)

### 5.4 Create Additional User Flows (Optional)

For better user experience, you can create separate flows:

1. **Password Reset Flow**
   - Create new user flow: "Password reset"
   - Name: `passwordreset1`
   - Configure to collect email and new password
   - Set appropriate claims for password reset tokens

2. **Profile Edit Flow**
   - Create new user flow: "Profile editing"
   - Name: `profileedit1`
   - Allow users to update: Display name, Company, Role
   - Configure appropriate claims

### 5.5 User Flow Configuration Summary

After completing this step, you should have:

- **Primary Flow**: `B2C_1_signupsignin1`
  - Supports email/password, Google, and Microsoft authentication
  - Collects all required user attributes (name, company, role, email)
  - Returns comprehensive JWT tokens with all necessary claims
  - Configured for 7-day session lifetime matching PRD requirements

- **Token Configuration**:
  - Access tokens valid for 1 hour
  - Refresh tokens valid for 7 days (rolling window up to 90 days)
  - Single sign-on sessions last 7 days with rolling timeout

- **Custom Attributes Integration**:
  - Company field collected during registration
  - Role field collected during registration
  - Both fields included in JWT token claims

## Step 6: Verification Checklist

Before proceeding to the next task, verify:

### Task 1.1 Checklist:
- [x] Azure AD B2C tenant created successfully
- [x] Tenant domain: `taktmate.onmicrosoft.com`
- [x] Custom attributes added: Company, Role
- [x] Google OAuth credentials obtained
- [x] Microsoft OAuth credentials obtained
- [x] Environment variables documented
- [x] Basic security settings configured

### Task 1.2 Checklist:
- [ ] Sign-up and sign-in user flow created (`B2C_1_signupsignin1`)
- [ ] All three identity providers configured (Local, Google, Microsoft)
- [ ] Custom attributes (Company, Role) added to user flow
- [ ] Token lifetime configured (7-day sessions, 1-hour tokens)
- [ ] User flow tested with all authentication methods
- [ ] JWT tokens verified to contain all required claims
- [ ] Session behavior configured for rolling 7-day timeout

## Step 7: Configure Custom Policies for Enhanced User Attributes (Task 1.3)

While user flows provide basic functionality, custom policies offer more control over the user experience and attribute collection. This step enhances the Company and Role attribute collection with validation and better UX.

### 7.1 Enable Custom Policy Framework

1. **Enable Identity Experience Framework**
   - In Azure AD B2C, go to "Identity Experience Framework"
   - If not enabled, follow the setup wizard
   - This creates the necessary applications for custom policies

2. **Download Starter Pack**
   - Download the Azure AD B2C Custom Policy Starter Pack from Microsoft
   - Extract to a local directory for editing
   - We'll use the "SocialAndLocalAccounts" starter pack

### 7.2 Create Custom Policy Files

Create the following custom policy files to enhance user attribute collection:

#### 7.2.1 Base Policy Extensions (TrustFrameworkExtensions.xml)

```xml
<?xml version="1.0" encoding="utf-8" ?>
<TrustFrameworkPolicy 
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" 
  xmlns:xsd="http://www.w3.org/2001/XMLSchema" 
  xmlns="http://schemas.microsoft.com/online/cpim/schemas/2013/06" 
  PolicySchemaVersion="0.3.0.0" 
  TenantId="taktmate.onmicrosoft.com" 
  PolicyId="B2C_1A_TrustFrameworkExtensions" 
  PublicPolicyUri="http://taktmate.onmicrosoft.com/B2C_1A_TrustFrameworkExtensions">

  <BasePolicy>
    <TenantId>taktmate.onmicrosoft.com</TenantId>
    <PolicyId>B2C_1A_TrustFrameworkBase</PolicyId>
  </BasePolicy>

  <BuildingBlocks>
    <ClaimsSchema>
      <!-- Enhanced Company Claim -->
      <ClaimType Id="extension_Company">
        <DisplayName>Company</DisplayName>
        <DataType>string</DataType>
        <AdminHelpText>The company/organization the user works for</AdminHelpText>
        <UserHelpText>Enter your company or organization name</UserHelpText>
        <UserInputType>TextBox</UserInputType>
        <Restriction>
          <Pattern RegularExpression="^[a-zA-Z0-9\s\-&amp;.,'()]{2,100}$" HelpText="Company name must be 2-100 characters and contain only letters, numbers, spaces, and common punctuation." />
        </Restriction>
      </ClaimType>

      <!-- Enhanced Role Claim -->
      <ClaimType Id="extension_Role">
        <DisplayName>Job Title/Role</DisplayName>
        <DataType>string</DataType>
        <AdminHelpText>The user's job title or role</AdminHelpText>
        <UserHelpText>Enter your job title or role</UserHelpText>
        <UserInputType>TextBox</UserInputType>
        <Restriction>
          <Pattern RegularExpression="^[a-zA-Z0-9\s\-&amp;.,'()]{2,50}$" HelpText="Role must be 2-50 characters and contain only letters, numbers, spaces, and common punctuation." />
        </Restriction>
      </ClaimType>

      <!-- Industry Claim (Optional Enhancement) -->
      <ClaimType Id="extension_Industry">
        <DisplayName>Industry</DisplayName>
        <DataType>string</DataType>
        <AdminHelpText>The industry sector</AdminHelpText>
        <UserHelpText>Select your industry</UserHelpText>
        <UserInputType>DropdownSingleSelect</UserInputType>
        <Restriction>
          <Enumeration Text="Technology" Value="technology" />
          <Enumeration Text="Finance" Value="finance" />
          <Enumeration Text="Healthcare" Value="healthcare" />
          <Enumeration Text="Education" Value="education" />
          <Enumeration Text="Manufacturing" Value="manufacturing" />
          <Enumeration Text="Retail" Value="retail" />
          <Enumeration Text="Consulting" Value="consulting" />
          <Enumeration Text="Government" Value="government" />
          <Enumeration Text="Non-profit" Value="nonprofit" />
          <Enumeration Text="Other" Value="other" />
        </Restriction>
      </ClaimType>
    </ClaimsSchema>

    <ContentDefinitions>
      <!-- Custom Content Definition for Enhanced Signup -->
      <ContentDefinition Id="api.signuporsignin.enhanced">
        <LoadUri>~/tenant/templates/AzureBlue/selfAsserted.cshtml</LoadUri>
        <RecoveryUri>~/common/default_page_error.html</RecoveryUri>
        <DataUri>urn:com:microsoft:aad:b2c:elements:contract:unifiedssp:2.1.0</DataUri>
        <Metadata>
          <Item Key="DisplayName">Signin and Signup</Item>
        </Metadata>
      </ContentDefinition>
    </ContentDefinitions>
  </BuildingBlocks>

  <ClaimsProviders>
    <ClaimsProvider>
      <DisplayName>Local Account SignIn</DisplayName>
      <TechnicalProfiles>
        <TechnicalProfile Id="SelfAsserted-LocalAccountSignin-Email">
          <Metadata>
            <Item Key="SignUpTarget">SignUpWithLogonEmailExchange</Item>
            <Item Key="setting.operatingMode">Email</Item>
            <Item Key="ContentDefinitionReferenceId">api.signuporsignin.enhanced</Item>
          </Metadata>
        </TechnicalProfile>

        <!-- Enhanced Signup Technical Profile -->
        <TechnicalProfile Id="LocalAccountSignUpWithLogonEmail-Enhanced">
          <DisplayName>Email signup</DisplayName>
          <Protocol Name="Proprietary" Handler="Web.TPEngine.Providers.SelfAssertedAttributeProvider, Web.TPEngine, Version=1.0.0.0, Culture=neutral, PublicKeyToken=null" />
          <Metadata>
            <Item Key="IpAddressClaimReferenceId">IpAddress</Item>
            <Item Key="ContentDefinitionReferenceId">api.localaccountsignup</Item>
            <Item Key="language.button_continue">Create Account</Item>
            <Item Key="EnforceEmailVerification">True</Item>
          </Metadata>
          <InputClaims>
            <InputClaim ClaimTypeReferenceId="email" />
          </InputClaims>
          <OutputClaims>
            <OutputClaim ClaimTypeReferenceId="objectId" />
            <OutputClaim ClaimTypeReferenceId="email" PartnerClaimType="Verified.Email" Required="true" />
            <OutputClaim ClaimTypeReferenceId="newPassword" Required="true" />
            <OutputClaim ClaimTypeReferenceId="reenterPassword" Required="true" />
            <OutputClaim ClaimTypeReferenceId="displayName" Required="true" />
            <OutputClaim ClaimTypeReferenceId="givenName" Required="true" />
            <OutputClaim ClaimTypeReferenceId="surName" Required="true" />
            <!-- Enhanced Custom Claims -->
            <OutputClaim ClaimTypeReferenceId="extension_Company" Required="true" />
            <OutputClaim ClaimTypeReferenceId="extension_Role" Required="true" />
            <OutputClaim ClaimTypeReferenceId="extension_Industry" Required="false" />
          </OutputClaims>
          <ValidationTechnicalProfiles>
            <ValidationTechnicalProfile ReferenceId="AAD-UserWriteUsingLogonEmail" />
          </ValidationTechnicalProfiles>
        </TechnicalProfile>
      </TechnicalProfiles>
    </ClaimsProvider>

    <!-- Azure Active Directory Claims Provider -->
    <ClaimsProvider>
      <DisplayName>Azure Active Directory</DisplayName>
      <TechnicalProfiles>
        <TechnicalProfile Id="AAD-UserWriteUsingLogonEmail">
          <PersistedClaims>
            <PersistedClaim ClaimTypeReferenceId="email" PartnerClaimType="signInNames.emailAddress" />
            <PersistedClaim ClaimTypeReferenceId="newPassword" PartnerClaimType="password"/>
            <PersistedClaim ClaimTypeReferenceId="displayName" DefaultValue="unknown" />
            <PersistedClaim ClaimTypeReferenceId="givenName" />
            <PersistedClaim ClaimTypeReferenceId="surname" />
            <!-- Persist Custom Attributes -->
            <PersistedClaim ClaimTypeReferenceId="extension_Company" />
            <PersistedClaim ClaimTypeReferenceId="extension_Role" />
            <PersistedClaim ClaimTypeReferenceId="extension_Industry" />
          </PersistedClaims>
        </TechnicalProfile>

        <TechnicalProfile Id="AAD-UserReadUsingEmailAddress">
          <OutputClaims>
            <OutputClaim ClaimTypeReferenceId="objectId" />
            <OutputClaim ClaimTypeReferenceId="authenticationSource" DefaultValue="localAccountAuthentication" />
            <OutputClaim ClaimTypeReferenceId="userPrincipalName" />
            <OutputClaim ClaimTypeReferenceId="displayName" />
            <OutputClaim ClaimTypeReferenceId="givenName" />
            <OutputClaim ClaimTypeReferenceId="surname" />
            <!-- Read Custom Attributes -->
            <OutputClaim ClaimTypeReferenceId="extension_Company" />
            <OutputClaim ClaimTypeReferenceId="extension_Role" />
            <OutputClaim ClaimTypeReferenceId="extension_Industry" />
          </OutputClaims>
        </TechnicalProfile>
      </TechnicalProfiles>
    </ClaimsProvider>
  </ClaimsProviders>
</TrustFrameworkPolicy>
```

#### 7.2.2 Sign Up Sign In Policy (SignUpOrSignIn.xml)

```xml
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<TrustFrameworkPolicy 
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" 
  xmlns:xsd="http://www.w3.org/2001/XMLSchema" 
  xmlns="http://schemas.microsoft.com/online/cpim/schemas/2013/06" 
  PolicySchemaVersion="0.3.0.0" 
  TenantId="taktmate.onmicrosoft.com" 
  PolicyId="B2C_1A_TaktMate_SignUpOrSignIn" 
  PublicPolicyUri="http://taktmate.onmicrosoft.com/B2C_1A_TaktMate_SignUpOrSignIn">

  <BasePolicy>
    <TenantId>taktmate.onmicrosoft.com</TenantId>
    <PolicyId>B2C_1A_TrustFrameworkExtensions</PolicyId>
  </BasePolicy>

  <RelyingParty>
    <DefaultUserJourney ReferenceId="SignUpOrSignIn" />
    <TechnicalProfile Id="PolicyProfile">
      <DisplayName>PolicyProfile</DisplayName>
      <Protocol Name="OpenIdConnect" />
      <OutputClaims>
        <OutputClaim ClaimTypeReferenceId="displayName" />
        <OutputClaim ClaimTypeReferenceId="givenName" />
        <OutputClaim ClaimTypeReferenceId="surname" />
        <OutputClaim ClaimTypeReferenceId="email" />
        <OutputClaim ClaimTypeReferenceId="objectId" PartnerClaimType="sub"/>
        <OutputClaim ClaimTypeReferenceId="identityProvider" />
        <OutputClaim ClaimTypeReferenceId="tenantId" AlwaysUseDefaultValue="true" DefaultValue="{Policy:TenantObjectId}" />
        <!-- Enhanced Custom Claims in JWT -->
        <OutputClaim ClaimTypeReferenceId="extension_Company" PartnerClaimType="company" />
        <OutputClaim ClaimTypeReferenceId="extension_Role" PartnerClaimType="jobTitle" />
        <OutputClaim ClaimTypeReferenceId="extension_Industry" PartnerClaimType="industry" />
      </OutputClaims>
      <SubjectNamingInfo ClaimType="sub" />
    </TechnicalProfile>
  </RelyingParty>
</TrustFrameworkPolicy>
```

### 7.3 Upload and Configure Custom Policies

1. **Upload Base Policies**
   - Upload TrustFrameworkBase.xml (from starter pack)
   - Upload TrustFrameworkExtensions.xml (created above)
   - Upload SignUpOrSignIn.xml (created above)

2. **Update Policy References**
   - Ensure all tenant IDs are correct (`taktmate.onmicrosoft.com`)
   - Verify policy inheritance chain is correct
   - Test policy upload for validation errors

3. **Configure Application to Use Custom Policy**
   - Update application registration to use `B2C_1A_TaktMate_SignUpOrSignIn`
   - Test custom policy flow
   - Verify enhanced attribute collection

### 7.4 Custom Policy Benefits

**Enhanced User Experience:**
- Better validation for Company and Role fields
- Industry dropdown for categorization
- Improved error messages and help text
- Consistent branding and styling

**Better Data Quality:**
- Regex validation for Company and Role fields
- Required field enforcement
- Length restrictions (2-100 chars for company, 2-50 for role)
- Character set restrictions to prevent injection

**Enhanced JWT Claims:**
- Custom claim mapping (company, jobTitle, industry)
- Consistent claim names across all authentication methods
- Additional metadata for user categorization

### 7.5 Alternative: Enhanced User Flow Configuration

If custom policies are too complex, enhance the existing user flow:

1. **Update User Flow Attributes**
   - Go to existing `B2C_1_signupsignin1` user flow
   - In "User attributes", ensure Company and Role are selected
   - In "Application claims", ensure both are returned in tokens

2. **Add Validation Rules**
   - Configure attribute validation in user flow settings
   - Set Company as required field
   - Set Role as required field
   - Configure appropriate display names

3. **Test Enhanced Flow**
   - Run user flow test
   - Verify both fields are collected during registration
   - Check JWT token contains both claims with proper names

### 7.6 Custom Policy Testing

1. **Test Custom Policy Flow**
   - Navigate to Identity Experience Framework
   - Select `B2C_1A_TaktMate_SignUpOrSignIn`
   - Click "Run now"
   - Test with `https://jwt.ms` as reply URL

2. **Verify Enhanced Attributes**
   - Complete signup flow with Company and Role
   - Check JWT token contains:
     - `company` claim (from extension_Company)
     - `jobTitle` claim (from extension_Role)
     - `industry` claim (from extension_Industry, if provided)

3. **Test Validation**
   - Try invalid Company names (too short, special characters)
   - Try invalid Role names (too long, invalid characters)
   - Verify appropriate error messages are shown

## Step 8: Verification Checklist

Before proceeding to the next task, verify:

### Task 1.1 Checklist:
- [x] Azure AD B2C tenant created successfully
- [x] Tenant domain: `taktmate.onmicrosoft.com`
- [x] Custom attributes added: Company, Role
- [x] Google OAuth credentials obtained
- [x] Microsoft OAuth credentials obtained
- [x] Environment variables documented
- [x] Basic security settings configured

### Task 1.2 Checklist:
- [x] Sign-up and sign-in user flow created (`B2C_1_signupsignin1`)
- [x] All three identity providers configured (Local, Google, Microsoft)
- [x] Custom attributes (Company, Role) added to user flow
- [x] Token lifetime configured (7-day sessions, 1-hour tokens)
- [x] User flow tested with all authentication methods
- [x] JWT tokens verified to contain all required claims
- [x] Session behavior configured for rolling 7-day timeout

### Task 1.3 Checklist:
- [ ] Custom policies framework enabled (Identity Experience Framework)
- [ ] Custom policy files created with enhanced attribute validation
- [ ] Company and Role fields have proper validation rules
- [ ] Custom policies uploaded and configured
- [ ] Enhanced JWT claims mapping configured (company, jobTitle)
- [ ] Custom policy tested with all authentication methods
- [ ] Validation rules tested (field requirements, character limits)

## Step 9: Register TaktMate Application in Azure AD B2C (Task 1.4)

The application registration configures Azure AD B2C to recognize and authenticate the TaktMate application with proper redirect URLs and security settings.

### 9.1 Create Application Registration

1. **Navigate to App Registrations**
   - In Azure AD B2C, go to "App registrations"
   - Click "New registration"

2. **Configure Basic Application Settings**
   - **Name**: `TaktMate CSV Chat Application`
   - **Supported account types**: `Accounts in any identity provider or organizational directory (for authenticating users with user flows)`
   - **Redirect URI**: 
     - **Type**: `Web`
     - **Development URL**: `http://localhost:3000/auth/callback`
   - Click "Register"

3. **Note Application Details**
   - **Application (client) ID**: Save this for environment variables
   - **Directory (tenant) ID**: Save this for environment variables
   - **Object ID**: Note for reference

### 9.2 Configure Authentication Settings

1. **Access Authentication Settings**
   - In the registered app, go to "Authentication"
   - Review the redirect URI that was created

2. **Add Additional Redirect URIs**
   - Click "Add URI" and add the following:
     - **Development**: `http://localhost:3000/auth/callback`
     - **Production**: `https://app.taktconnect.com/auth/callback`
     - **Testing**: `https://jwt.ms` (for testing tokens)

3. **Configure Advanced Settings**
   - **Allow public client flows**: `No` (keep disabled for security)
   - **Supported account types**: Keep as selected during registration
   - **Live SDK support**: `No` (not needed)

4. **Configure Token Settings**
   - **Access tokens**: ✅ Enabled
   - **ID tokens**: ✅ Enabled
   - Click "Save"

### 9.3 Create Client Secret

1. **Navigate to Certificates & Secrets**
   - In the registered app, go to "Certificates & secrets"
   - Click "New client secret"

2. **Configure Client Secret**
   - **Description**: `TaktMate Production Secret`
   - **Expires**: `24 months` (recommended for production)
   - Click "Add"

3. **Save Client Secret**
   - **Copy the secret value immediately** (it won't be shown again)
   - Save this for environment variables as `AZURE_AD_B2C_CLIENT_SECRET`

### 9.4 Configure API Permissions

1. **Navigate to API Permissions**
   - In the registered app, go to "API permissions"
   - Review default permissions

2. **Add Required Permissions**
   - Click "Add a permission"
   - Select "Microsoft Graph"
   - Choose "Delegated permissions"
   - Add the following permissions:
     - ✅ `openid` (Sign users in)
     - ✅ `profile` (View users' basic profile)
     - ✅ `email` (View users' email address)
     - ✅ `offline_access` (Maintain access to data you have given it access to)

3. **Grant Admin Consent**
   - Click "Grant admin consent for [tenant-name]"
   - Confirm the consent
   - Verify all permissions show "Granted for [tenant-name]"

### 9.5 Configure Token Configuration (Optional)

1. **Navigate to Token Configuration**
   - In the registered app, go to "Token configuration"
   - This allows you to customize claims in tokens

2. **Add Optional Claims (if needed)**
   - Click "Add optional claim"
   - **Token type**: `ID`
   - Select additional claims if needed:
     - `family_name`
     - `given_name`
     - `email`
   - Click "Add"

### 9.6 Configure Application for User Flows

1. **Return to Azure AD B2C User Flows**
   - Go to "User flows"
   - Select your `B2C_1_signupsignin1` user flow

2. **Configure Application**
   - Go to "Applications"
   - Click "Add"
   - Select the `TaktMate CSV Chat Application` you just registered
   - Click "OK"

3. **Test User Flow with Application**
   - In the user flow, click "Run user flow"
   - **Application**: Select `TaktMate CSV Chat Application`
   - **Reply URL**: Choose `http://localhost:3000/auth/callback` or `https://jwt.ms` for testing
   - Click "Run user flow"
   - Complete the authentication process
   - Verify the callback works correctly

### 9.7 Configure Application for Custom Policies (If Using)

1. **Update Custom Policies**
   - If using custom policies, ensure the application is referenced
   - The policies should automatically recognize registered applications

2. **Test Custom Policies**
   - Go to "Identity Experience Framework"
   - Select `B2C_1A_TaktMate_SignUpOrSignIn` (if created)
   - Click "Run now"
   - **Application**: Select `TaktMate CSV Chat Application`
   - **Reply URL**: Choose appropriate callback URL
   - Test the flow and verify token generation

### 9.8 Environment Variable Configuration

Update your environment variables with the application registration details:

```bash
# Azure AD B2C Application Registration
AZURE_AD_B2C_TENANT_ID=your-directory-tenant-id-here
AZURE_AD_B2C_CLIENT_ID=your-application-client-id-here
AZURE_AD_B2C_CLIENT_SECRET=your-client-secret-here

# Development URLs
AZURE_AD_B2C_REDIRECT_URI=http://localhost:3000/auth/callback
AZURE_AD_B2C_POST_LOGOUT_REDIRECT_URI=http://localhost:3000

# Production URLs (when deploying)
# AZURE_AD_B2C_REDIRECT_URI=https://app.taktconnect.com/auth/callback
# AZURE_AD_B2C_POST_LOGOUT_REDIRECT_URI=https://app.taktconnect.com
```

### 9.9 Security Considerations

1. **Client Secret Security**
   - Store client secret securely (Azure Key Vault in production)
   - Never commit client secrets to version control
   - Rotate client secrets regularly (every 6-12 months)

2. **Redirect URI Security**
   - Only add trusted redirect URIs
   - Use HTTPS in production
   - Validate redirect URIs match exactly

3. **Scope Limitations**
   - Only request necessary permissions
   - Review permissions regularly
   - Use least privilege principle

### 9.10 Application Registration Summary

After completing this step, you should have:

- **Application Registration**: `TaktMate CSV Chat Application`
- **Client ID**: Configured in environment variables
- **Client Secret**: Securely stored and configured
- **Redirect URIs**: Configured for development and production
- **API Permissions**: Granted for OpenID Connect authentication
- **User Flow Integration**: Application configured with user flows
- **Testing**: Successfully tested authentication flow

## Step 10: Verification Checklist

Before proceeding to the next task, verify:

### Task 1.1 Checklist:
- [x] Azure AD B2C tenant created successfully
- [x] Tenant domain: `taktmate.onmicrosoft.com`
- [x] Custom attributes added: Company, Role
- [x] Google OAuth credentials obtained
- [x] Microsoft OAuth credentials obtained
- [x] Environment variables documented
- [x] Basic security settings configured

### Task 1.2 Checklist:
- [x] Sign-up and sign-in user flow created (`B2C_1_signupsignin1`)
- [x] All three identity providers configured (Local, Google, Microsoft)
- [x] Custom attributes (Company, Role) added to user flow
- [x] Token lifetime configured (7-day sessions, 1-hour tokens)
- [x] User flow tested with all authentication methods
- [x] JWT tokens verified to contain all required claims
- [x] Session behavior configured for rolling 7-day timeout

### Task 1.3 Checklist:
- [x] Custom policies framework enabled (Identity Experience Framework)
- [x] Custom policy files created with enhanced attribute validation
- [x] Company and Role fields have proper validation rules
- [x] Custom policies uploaded and configured
- [x] Enhanced JWT claims mapping configured (company, jobTitle)
- [x] Custom policy tested with all authentication methods
- [x] Validation rules tested (field requirements, character limits)

### Task 1.4 Checklist:
- [ ] Application registered in Azure AD B2C (`TaktMate CSV Chat Application`)
- [ ] Client ID and Client Secret obtained and configured
- [ ] Redirect URIs configured for development and production
- [ ] API permissions granted (openid, profile, email, offline_access)
- [ ] Application configured with user flows
- [ ] Authentication flow tested with registered application
- [ ] Environment variables updated with application details

## Step 11: Configure JWT Token Claims (Task 1.5)

JWT token claims configuration ensures that all required user profile information is included in authentication tokens and properly validated by the application.

### 11.1 Understanding Azure AD B2C JWT Token Structure

Azure AD B2C issues JWT tokens with the following structure:

```json
{
  "typ": "JWT",
  "alg": "RS256",
  "kid": "X5eXk4xyojNFum1kl2Ytv8dlNP4-c57dO6QGTVBwaNk"
}
{
  "exp": 1704067200,
  "nbf": 1704063600,
  "ver": "1.0",
  "iss": "https://taktmate.b2clogin.com/12345678-1234-1234-1234-123456789012/v2.0/",
  "sub": "12345678-1234-1234-1234-123456789012",
  "aud": "your-client-id",
  "nonce": "defaultNonce",
  "iat": 1704063600,
  "auth_time": 1704063600,
  "emails": ["user@example.com"],
  "given_name": "John",
  "family_name": "Doe",
  "name": "John Doe",
  "extension_Company": "TechCorp Inc",
  "extension_Role": "Software Engineer",
  "tfp": "B2C_1_signupsignin1"
}
```

### 11.2 Configure User Flow Claims

1. **Access User Flow Configuration**
   - Go to Azure AD B2C > User flows
   - Select `B2C_1_signupsignin1`
   - Go to "Application claims"

2. **Configure Required Claims**
   Ensure these claims are selected (✅):
   - ✅ Email Addresses
   - ✅ Given Name
   - ✅ Surname
   - ✅ Display Name
   - ✅ User's Object ID
   - ✅ Company (custom attribute)
   - ✅ Role (custom attribute)
   - ✅ Identity Provider
   - ✅ Identity Provider Access Token (optional)

3. **Save Configuration**
   - Click "Save"
   - The changes will apply to new tokens issued by this user flow

### 11.3 Configure Custom Policy Claims (If Using Custom Policies)

If using custom policies, ensure the RelyingParty section includes all required claims:

```xml
<OutputClaims>
  <OutputClaim ClaimTypeReferenceId="displayName" />
  <OutputClaim ClaimTypeReferenceId="givenName" />
  <OutputClaim ClaimTypeReferenceId="surname" />
  <OutputClaim ClaimTypeReferenceId="email" />
  <OutputClaim ClaimTypeReferenceId="objectId" PartnerClaimType="sub"/>
  <OutputClaim ClaimTypeReferenceId="identityProvider" />
  <OutputClaim ClaimTypeReferenceId="tenantId" AlwaysUseDefaultValue="true" DefaultValue="{Policy:TenantObjectId}" />
  <!-- Enhanced Custom Claims in JWT -->
  <OutputClaim ClaimTypeReferenceId="extension_Company" PartnerClaimType="company" />
  <OutputClaim ClaimTypeReferenceId="extension_Role" PartnerClaimType="jobTitle" />
  <OutputClaim ClaimTypeReferenceId="extension_Industry" PartnerClaimType="industry" />
</OutputClaims>
```

### 11.4 JWT Token Validation Configuration

The application needs to validate JWT tokens from Azure AD B2C. Here's the validation configuration:

#### Required Validation Parameters:
- **Issuer**: `https://taktmate.b2clogin.com/{tenant-id}/v2.0/`
- **Audience**: Your application client ID
- **JWKS URI**: `https://taktmate.b2clogin.com/taktmate.onmicrosoft.com/B2C_1_signupsignin1/discovery/v2.0/keys`
- **Algorithm**: RS256
- **Clock Tolerance**: 300 seconds (5 minutes)

#### Token Lifetime Settings:
- **Access Token**: 1 hour (3600 seconds)
- **ID Token**: 1 hour (3600 seconds)  
- **Refresh Token**: 7 days (rolling window up to 90 days)
- **Session Lifetime**: 7 days (10080 minutes)

### 11.5 User Profile Claims Mapping

Configure how JWT claims map to user profile information:

```javascript
// Standard Claims
const userProfile = {
  id: token.sub,                    // User ID
  email: token.emails[0],           // Primary email
  name: token.name,                 // Full name
  givenName: token.given_name,      // First name
  familyName: token.family_name,    // Last name
  
  // Custom Claims (User Flow Format)
  company: token.extension_Company, // Company name
  role: token.extension_Role,       // Job title/role
  
  // Custom Claims (Custom Policy Format)
  company: token.company,           // Company name (custom policy)
  role: token.jobTitle,             // Job title (custom policy)
  industry: token.industry,         // Industry (custom policy)
  
  // Authentication Metadata
  identityProvider: token.idp,      // Authentication provider
  emailVerified: token.email_verified || false,
  
  // Token Metadata
  issuer: token.iss,
  audience: token.aud,
  issuedAt: token.iat,
  expiresAt: token.exp,
  notBefore: token.nbf
};
```

### 11.6 Token Validation Implementation

The backend application should validate tokens using these steps:

1. **Fetch JWKS Keys**
   - Retrieve public keys from Azure AD B2C JWKS endpoint
   - Cache keys and refresh periodically
   - Validate token signature using appropriate key

2. **Validate Token Claims**
   - **Issuer**: Must match expected B2C tenant issuer
   - **Audience**: Must match application client ID
   - **Expiration**: Token must not be expired
   - **Not Before**: Token must be valid (nbf <= current time)
   - **Issued At**: Token must not be issued in the future

3. **Extract User Profile**
   - Map JWT claims to user profile object
   - Handle both user flow and custom policy claim formats
   - Provide default values for optional claims

### 11.7 Claims Validation Examples

#### Valid Token Claims Example:
```json
{
  "iss": "https://taktmate.b2clogin.com/12345678-1234-1234-1234-123456789012/v2.0/",
  "aud": "your-client-id",
  "sub": "user-object-id",
  "emails": ["john.doe@techcorp.com"],
  "given_name": "John",
  "family_name": "Doe", 
  "name": "John Doe",
  "extension_Company": "TechCorp Inc",
  "extension_Role": "Software Engineer",
  "email_verified": true,
  "idp": "local",
  "exp": 1704067200,
  "iat": 1704063600,
  "nbf": 1704063600
}
```

#### Extracted User Profile:
```json
{
  "id": "user-object-id",
  "email": "john.doe@techcorp.com",
  "name": "John Doe",
  "givenName": "John",
  "familyName": "Doe",
  "company": "TechCorp Inc",
  "role": "Software Engineer",
  "emailVerified": true,
  "identityProvider": "local",
  "issuer": "https://taktmate.b2clogin.com/12345678-1234-1234-1234-123456789012/v2.0/",
  "audience": "your-client-id",
  "issuedAt": 1704063600,
  "expiresAt": 1704067200
}
```

### 11.8 Error Handling for Token Validation

Implement proper error handling for common token validation scenarios:

#### Common Token Validation Errors:
1. **Expired Token**: `exp` claim is in the past
2. **Invalid Issuer**: `iss` claim doesn't match expected issuer
3. **Invalid Audience**: `aud` claim doesn't match client ID
4. **Invalid Signature**: Token signature verification fails
5. **Missing Claims**: Required claims are not present
6. **Malformed Token**: Token structure is invalid

#### Error Response Format:
```json
{
  "success": false,
  "error": "Token validation failed",
  "code": "INVALID_TOKEN",
  "details": {
    "reason": "Token has expired",
    "claim": "exp",
    "expected": "future timestamp",
    "actual": "1704063600"
  }
}
```

### 11.9 Testing JWT Token Claims

1. **Generate Test Token**
   - Use Azure AD B2C user flow test feature
   - Complete authentication process
   - Copy JWT token from callback

2. **Validate Token Structure**
   - Use https://jwt.ms to decode token
   - Verify all required claims are present
   - Check claim values are correct

3. **Test Token Validation**
   - Use backend validation endpoint
   - Verify token is accepted and user profile extracted
   - Test with expired tokens to verify rejection

### 11.10 Production Considerations

#### Security Considerations:
- **Always validate token signature** using JWKS keys
- **Check token expiration** and reject expired tokens
- **Validate issuer and audience** to prevent token reuse
- **Use HTTPS only** for token transmission
- **Implement proper error handling** without exposing sensitive information

#### Performance Considerations:
- **Cache JWKS keys** to avoid repeated API calls
- **Set appropriate cache TTL** (1-24 hours recommended)
- **Handle JWKS key rotation** gracefully
- **Use efficient JWT libraries** for validation

#### Monitoring Considerations:
- **Log token validation failures** for security monitoring
- **Monitor token validation performance** 
- **Track authentication success rates**
- **Alert on unusual authentication patterns**

## Step 12: Test Azure AD B2C User Flows and Token Generation (Task 1.6)

Comprehensive testing of Azure AD B2C user flows ensures that authentication works correctly and tokens contain all required claims.

### 12.1 User Flow Testing Prerequisites

Before testing user flows, ensure you have completed:

1. **Azure AD B2C Tenant Setup** (Task 1.1)
   - Tenant created and configured
   - Custom attributes defined
   - Identity providers configured

2. **User Flow Configuration** (Task 1.2)
   - Sign-up and sign-in user flow created
   - Identity providers enabled (Local, Google, Microsoft)
   - User attributes and application claims configured

3. **Application Registration** (Task 1.4)
   - TaktMate application registered
   - Redirect URIs configured
   - Client secret generated
   - API permissions granted

4. **JWT Token Claims** (Task 1.5)
   - Application claims configured in user flow
   - Token validation parameters set
   - Claims mapping implemented

### 12.2 User Flow Testing Methods

#### Method 1: Azure Portal User Flow Test

1. **Access User Flow Test Feature**
   - Go to Azure AD B2C > User flows
   - Select `B2C_1_signupsignin1`
   - Click "Run user flow"

2. **Configure Test Parameters**
   - **Application**: Select your registered TaktMate application
   - **Reply URL**: Use `https://jwt.ms` for token inspection
   - **Domain**: Use your custom domain if configured

3. **Execute Test Flow**
   - Click "Run user flow"
   - Complete authentication process
   - Verify token is returned to jwt.ms

#### Method 2: Direct URL Testing

Generate and test user flow URLs directly:

```javascript
// Sign-up/Sign-in URL
https://taktmate.b2clogin.com/taktmate.onmicrosoft.com/oauth2/v2.0/authorize?
  p=B2C_1_signupsignin1
  &client_id=your-client-id
  &nonce=defaultNonce
  &redirect_uri=https%3A%2F%2Fjwt.ms
  &scope=openid
  &response_type=id_token
  &prompt=login

// Password Reset URL
https://taktmate.b2clogin.com/taktmate.onmicrosoft.com/oauth2/v2.0/authorize?
  p=B2C_1_passwordreset1
  &client_id=your-client-id
  &nonce=defaultNonce
  &redirect_uri=https%3A%2F%2Fjwt.ms
  &scope=openid
  &response_type=id_token

// Profile Edit URL
https://taktmate.b2clogin.com/taktmate.onmicrosoft.com/oauth2/v2.0/authorize?
  p=B2C_1_profileedit1
  &client_id=your-client-id
  &nonce=defaultNonce
  &redirect_uri=https%3A%2F%2Fjwt.ms
  &scope=openid
  &response_type=id_token
```

#### Method 3: Automated Testing Script

Use the testing script to validate configuration and generate test URLs:

```bash
# Test user flow configuration
npm run test:user-flows

# Test JWT claims configuration
npm run test:jwt-claims

# Validate application registration
npm run validate:app
```

### 12.3 Authentication Flow Testing Scenarios

#### Scenario 1: New User Registration (Email/Password)

**Test Steps:**
1. Navigate to sign-up/sign-in URL
2. Click "Sign up now"
3. Enter required information:
   - Email address
   - Password (meeting complexity requirements)
   - Given name
   - Surname
   - Company name
   - Job title/role
4. Complete email verification (if required)
5. Verify successful registration and token generation

**Expected Results:**
- ✅ User can complete registration process
- ✅ Email verification sent (if configured)
- ✅ JWT token returned with all required claims
- ✅ Custom attributes (company, role) present in token
- ✅ User profile accessible in subsequent logins

#### Scenario 2: Existing User Login (Email/Password)

**Test Steps:**
1. Navigate to sign-up/sign-in URL
2. Enter existing user credentials
3. Complete authentication
4. Verify token generation

**Expected Results:**
- ✅ User can login with correct credentials
- ✅ Authentication fails with incorrect credentials
- ✅ JWT token contains updated user profile information
- ✅ Session established successfully

#### Scenario 3: Social Login (Google)

**Test Steps:**
1. Navigate to sign-up/sign-in URL
2. Click "Google" authentication button
3. Complete Google OAuth flow
4. Provide additional required information (company, role) if first login
5. Verify token generation

**Expected Results:**
- ✅ Google OAuth flow completes successfully
- ✅ User profile information imported from Google
- ✅ Additional attributes collected during first login
- ✅ JWT token contains both Google and custom claims

#### Scenario 4: Social Login (Microsoft)

**Test Steps:**
1. Navigate to sign-up/sign-in URL
2. Click "Microsoft" authentication button
3. Complete Microsoft OAuth flow
4. Provide additional required information if needed
5. Verify token generation

**Expected Results:**
- ✅ Microsoft OAuth flow completes successfully
- ✅ User profile information imported from Microsoft
- ✅ Work/school account integration works correctly
- ✅ JWT token contains both Microsoft and custom claims

#### Scenario 5: Password Reset Flow

**Test Steps:**
1. Navigate to password reset URL or click "Forgot password?"
2. Enter email address
3. Check email for reset link
4. Complete password reset process
5. Login with new password

**Expected Results:**
- ✅ Password reset email sent successfully
- ✅ Reset link works and is secure
- ✅ New password meets complexity requirements
- ✅ User can login with new password

#### Scenario 6: Profile Edit Flow

**Test Steps:**
1. Navigate to profile edit URL (authenticated user)
2. Modify profile information (name, company, role)
3. Save changes
4. Verify updates in subsequent tokens

**Expected Results:**
- ✅ Profile edit form loads with current information
- ✅ Changes can be saved successfully
- ✅ Updated information appears in new JWT tokens
- ✅ Changes persist across sessions

### 12.4 JWT Token Validation Testing

#### Token Structure Verification

For each authentication scenario, verify the JWT token contains:

**Standard Claims:**
```json
{
  "iss": "https://taktmate.b2clogin.com/{tenant-id}/v2.0/",
  "aud": "your-client-id",
  "sub": "user-object-id",
  "exp": 1704067200,
  "iat": 1704063600,
  "nbf": 1704063600,
  "ver": "1.0",
  "tfp": "B2C_1_signupsignin1"
}
```

**User Profile Claims:**
```json
{
  "emails": ["user@example.com"],
  "given_name": "John",
  "family_name": "Doe",
  "name": "John Doe",
  "extension_Company": "TechCorp Inc",
  "extension_Role": "Software Engineer"
}
```

**Authentication Metadata:**
```json
{
  "idp": "local|google.com|microsoft.com",
  "email_verified": true,
  "auth_time": 1704063600,
  "nonce": "defaultNonce"
}
```

#### Token Validation Testing

Use the JWT validation middleware to test:

```javascript
// Test token validation
const { validateJwtToken } = require('./middleware/jwtValidation');

// Valid token test
const validToken = "eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiIs...";
const validation = await validateJwtToken(validToken);

console.log('Validation Result:', validation);
// Expected: { valid: true, payload: {...}, userProfile: {...} }

// Invalid token test
const invalidToken = "invalid.jwt.token";
const invalidValidation = await validateJwtToken(invalidToken);

console.log('Invalid Token Result:', invalidValidation);
// Expected: { valid: false, error: "...", code: "INVALID_TOKEN" }
```

### 12.5 Error Scenario Testing

#### Authentication Errors

Test various error conditions:

1. **Invalid Credentials**
   - Wrong email/password combination
   - Expected: Authentication failure with appropriate error

2. **Expired Password Reset Link**
   - Use old password reset link
   - Expected: Link expired error with option to request new link

3. **Account Lockout**
   - Multiple failed login attempts
   - Expected: Account temporarily locked with clear messaging

4. **Social Login Errors**
   - Cancel OAuth flow
   - Deny permissions
   - Expected: Graceful error handling with retry options

#### Token Validation Errors

Test JWT token validation errors:

1. **Expired Token**
   - Use token past expiration time
   - Expected: TOKEN_EXPIRED error

2. **Invalid Signature**
   - Modify token signature
   - Expected: INVALID_SIGNATURE error

3. **Wrong Issuer**
   - Token from different tenant
   - Expected: INVALID_ISSUER error

4. **Missing Claims**
   - Token without required claims
   - Expected: Validation failure with missing claim details

### 12.6 Performance Testing

#### Load Testing Scenarios

1. **Concurrent Authentications**
   - Multiple users signing in simultaneously
   - Measure response times and success rates

2. **JWKS Key Retrieval**
   - Test JWKS endpoint performance under load
   - Verify caching effectiveness

3. **Token Validation Performance**
   - Measure JWT validation latency
   - Test with various token sizes

#### Performance Benchmarks

**Target Performance Metrics:**
- **Authentication Flow**: < 3 seconds end-to-end
- **JWT Token Validation**: < 100ms per token
- **JWKS Key Retrieval**: < 500ms (cached: < 10ms)
- **User Profile Extraction**: < 50ms per token

### 12.7 Security Testing

#### Security Validation Checklist

1. **Token Security**
   - ✅ Tokens are properly signed with RS256
   - ✅ Token expiration is enforced
   - ✅ Tokens cannot be modified without detection
   - ✅ JWKS keys rotate properly

2. **Authentication Security**
   - ✅ Password complexity requirements enforced
   - ✅ Brute force protection active
   - ✅ Account lockout mechanisms working
   - ✅ Email verification required (if configured)

3. **Session Security**
   - ✅ Sessions expire appropriately
   - ✅ Logout invalidates sessions
   - ✅ Concurrent session limits respected
   - ✅ Session hijacking protection active

4. **Data Protection**
   - ✅ User data encrypted in transit (HTTPS)
   - ✅ Sensitive claims not exposed in logs
   - ✅ Personal data handling complies with GDPR
   - ✅ Audit logging captures security events

### 12.8 Cross-Browser and Device Testing

#### Browser Compatibility Testing

Test authentication flows across browsers:

1. **Desktop Browsers**
   - Chrome (latest)
   - Firefox (latest)
   - Safari (latest)
   - Edge (latest)

2. **Mobile Browsers**
   - Chrome Mobile (Android)
   - Safari Mobile (iOS)
   - Samsung Internet
   - Firefox Mobile

3. **Specific Test Cases**
   - Social login popup handling
   - Redirect flow completion
   - Token storage and retrieval
   - Session persistence

### 12.9 Integration Testing

#### End-to-End Integration Tests

1. **Frontend Integration**
   - Test authentication from React application
   - Verify token storage in browser
   - Test protected route access
   - Verify logout functionality

2. **Backend Integration**
   - Test API endpoint protection
   - Verify user profile extraction
   - Test role-based access control
   - Verify audit logging

3. **Azure Services Integration**
   - Test with Azure Static Web Apps
   - Verify Azure App Service integration
   - Test Application Insights logging
   - Verify Key Vault secret access

### 12.10 Testing Automation and CI/CD

#### Automated Testing Setup

Create automated tests for continuous validation:

```javascript
// Example automated test
describe('Azure AD B2C User Flow Tests', () => {
  test('should complete sign-up flow successfully', async () => {
    // Test implementation
  });
  
  test('should validate JWT token correctly', async () => {
    // Test implementation
  });
  
  test('should handle authentication errors gracefully', async () => {
    // Test implementation
  });
});
```

#### CI/CD Integration

Include Azure AD B2C testing in deployment pipeline:

1. **Pre-deployment Testing**
   - Validate configuration
   - Test user flow URLs
   - Verify JWKS connectivity

2. **Post-deployment Testing**
   - End-to-end authentication flow
   - Token validation testing
   - Performance benchmarking

3. **Monitoring and Alerts**
   - Authentication success rate monitoring
   - Token validation error tracking
   - Performance degradation alerts

### 12.11 Testing Documentation and Reporting

#### Test Results Documentation

Document all test results including:

1. **Test Execution Summary**
   - Total tests run
   - Pass/fail rates
   - Performance metrics
   - Error categories

2. **Issue Tracking**
   - Identified issues
   - Resolution status
   - Impact assessment
   - Remediation timeline

3. **Compliance Verification**
   - Security requirements met
   - Performance targets achieved
   - Functionality requirements satisfied
   - User experience validation

## Step 13: Verification Checklist

Before proceeding to the next task, verify:

### Task 1.1-1.5 Checklists:
- [x] All previous tasks completed successfully

### Task 1.6 Checklist:
- [ ] Azure portal user flow testing completed successfully
- [ ] Direct URL testing validated for all user flows
- [ ] New user registration flow tested with email/password
- [ ] Existing user login flow tested and verified
- [ ] Social login flows tested (Google and Microsoft)
- [ ] Password reset flow tested and validated
- [ ] Profile edit flow tested and verified
- [ ] JWT token structure validated for all scenarios
- [ ] Token validation testing completed with valid and invalid tokens
- [ ] Error scenarios tested and handled appropriately
- [ ] Performance testing completed with acceptable results
- [ ] Security testing validated all requirements
- [ ] Cross-browser testing completed
- [ ] Integration testing with frontend and backend completed
- [ ] Automated tests created and passing
- [ ] Test documentation completed

## Next Steps

After completing user flow and token generation testing:
1. Task 1.7: Document Azure AD B2C configuration and setup process

## Troubleshooting

### Common Issues

1. **Cannot switch to B2C tenant**
   - Ensure you have proper permissions
   - Try signing out and back in to Azure portal
   - Check if tenant creation completed successfully

2. **OAuth provider setup issues**
   - Verify redirect URIs match exactly
   - Ensure proper scopes are configured
   - Check that APIs are enabled (Google+ API for Google)

3. **Custom attributes not appearing**
   - Wait a few minutes for propagation
   - Refresh the Azure portal
   - Verify attribute names don't conflict with built-in attributes

### Support Resources

- [Azure AD B2C Documentation](https://docs.microsoft.com/en-us/azure/active-directory-b2c/)
- [Google OAuth Setup Guide](https://developers.google.com/identity/protocols/oauth2)
- [Microsoft Identity Platform](https://docs.microsoft.com/en-us/azure/active-directory/develop/)

---

**Created for TaktMate Online Hosting Project**  
**Task 1.1: Azure AD B2C Tenant Setup**  
**Last Updated**: $(date)
