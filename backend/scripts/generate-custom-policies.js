#!/usr/bin/env node

/**
 * Azure AD B2C Custom Policy Generator for TaktMate
 * 
 * This script generates custom policy XML files for Azure AD B2C
 * with enhanced user attribute collection and validation.
 */

const fs = require('fs');
const path = require('path');
const { config } = require('../config/azureAdB2C');

/**
 * Colors for console output
 */
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

/**
 * Log with colors
 */
function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

/**
 * Generate TrustFrameworkExtensions.xml
 */
function generateTrustFrameworkExtensions(tenantName) {
  return `<?xml version="1.0" encoding="utf-8" ?>
<TrustFrameworkPolicy 
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" 
  xmlns:xsd="http://www.w3.org/2001/XMLSchema" 
  xmlns="http://schemas.microsoft.com/online/cpim/schemas/2013/06" 
  PolicySchemaVersion="0.3.0.0" 
  TenantId="${tenantName}.onmicrosoft.com" 
  PolicyId="B2C_1A_TrustFrameworkExtensions" 
  PublicPolicyUri="http://${tenantName}.onmicrosoft.com/B2C_1A_TrustFrameworkExtensions">

  <BasePolicy>
    <TenantId>${tenantName}.onmicrosoft.com</TenantId>
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
          <Pattern RegularExpression="^[a-zA-Z0-9\\s\\-&amp;.,'()]{2,100}$" HelpText="Company name must be 2-100 characters and contain only letters, numbers, spaces, and common punctuation." />
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
          <Pattern RegularExpression="^[a-zA-Z0-9\\s\\-&amp;.,'()]{2,50}$" HelpText="Role must be 2-50 characters and contain only letters, numbers, spaces, and common punctuation." />
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
          <Item Key="DisplayName">TaktMate Signin and Signup</Item>
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
</TrustFrameworkPolicy>`;
}

/**
 * Generate SignUpOrSignIn.xml
 */
function generateSignUpOrSignIn(tenantName) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<TrustFrameworkPolicy 
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" 
  xmlns:xsd="http://www.w3.org/2001/XMLSchema" 
  xmlns="http://schemas.microsoft.com/online/cpim/schemas/2013/06" 
  PolicySchemaVersion="0.3.0.0" 
  TenantId="${tenantName}.onmicrosoft.com" 
  PolicyId="B2C_1A_TaktMate_SignUpOrSignIn" 
  PublicPolicyUri="http://${tenantName}.onmicrosoft.com/B2C_1A_TaktMate_SignUpOrSignIn">

  <BasePolicy>
    <TenantId>${tenantName}.onmicrosoft.com</TenantId>
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
</TrustFrameworkPolicy>`;
}

/**
 * Generate ProfileEdit.xml (Optional)
 */
function generateProfileEdit(tenantName) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<TrustFrameworkPolicy 
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" 
  xmlns:xsd="http://www.w3.org/2001/XMLSchema" 
  xmlns="http://schemas.microsoft.com/online/cpim/schemas/2013/06" 
  PolicySchemaVersion="0.3.0.0" 
  TenantId="${tenantName}.onmicrosoft.com" 
  PolicyId="B2C_1A_TaktMate_ProfileEdit" 
  PublicPolicyUri="http://${tenantName}.onmicrosoft.com/B2C_1A_TaktMate_ProfileEdit">

  <BasePolicy>
    <TenantId>${tenantName}.onmicrosoft.com</TenantId>
    <PolicyId>B2C_1A_TrustFrameworkExtensions</PolicyId>
  </BasePolicy>

  <RelyingParty>
    <DefaultUserJourney ReferenceId="ProfileEdit" />
    <TechnicalProfile Id="PolicyProfile">
      <DisplayName>PolicyProfile</DisplayName>
      <Protocol Name="OpenIdConnect" />
      <OutputClaims>
        <OutputClaim ClaimTypeReferenceId="objectId" PartnerClaimType="sub"/>
        <OutputClaim ClaimTypeReferenceId="displayName" />
        <OutputClaim ClaimTypeReferenceId="givenName" />
        <OutputClaim ClaimTypeReferenceId="surname" />
        <OutputClaim ClaimTypeReferenceId="email" />
        <!-- Allow editing of custom attributes -->
        <OutputClaim ClaimTypeReferenceId="extension_Company" PartnerClaimType="company" />
        <OutputClaim ClaimTypeReferenceId="extension_Role" PartnerClaimType="jobTitle" />
        <OutputClaim ClaimTypeReferenceId="extension_Industry" PartnerClaimType="industry" />
      </OutputClaims>
      <SubjectNamingInfo ClaimType="sub" />
    </TechnicalProfile>
  </RelyingParty>
</TrustFrameworkPolicy>`;
}

/**
 * Generate PasswordReset.xml (Optional)
 */
function generatePasswordReset(tenantName) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<TrustFrameworkPolicy 
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" 
  xmlns:xsd="http://www.w3.org/2001/XMLSchema" 
  xmlns="http://schemas.microsoft.com/online/cpim/schemas/2013/06" 
  PolicySchemaVersion="0.3.0.0" 
  TenantId="${tenantName}.onmicrosoft.com" 
  PolicyId="B2C_1A_TaktMate_PasswordReset" 
  PublicPolicyUri="http://${tenantName}.onmicrosoft.com/B2C_1A_TaktMate_PasswordReset">

  <BasePolicy>
    <TenantId>${tenantName}.onmicrosoft.com</TenantId>
    <PolicyId>B2C_1A_TrustFrameworkExtensions</PolicyId>
  </BasePolicy>

  <RelyingParty>
    <DefaultUserJourney ReferenceId="PasswordReset" />
    <TechnicalProfile Id="PolicyProfile">
      <DisplayName>PolicyProfile</DisplayName>
      <Protocol Name="OpenIdConnect" />
      <OutputClaims>
        <OutputClaim ClaimTypeReferenceId="objectId" PartnerClaimType="sub"/>
        <OutputClaim ClaimTypeReferenceId="email" />
      </OutputClaims>
      <SubjectNamingInfo ClaimType="sub" />
    </TechnicalProfile>
  </RelyingParty>
</TrustFrameworkPolicy>`;
}

/**
 * Create output directory
 */
function ensureOutputDirectory() {
  const outputDir = path.join(process.cwd(), 'azure-b2c-policies');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  return outputDir;
}

/**
 * Write policy file
 */
function writePolicyFile(outputDir, filename, content) {
  const filePath = path.join(outputDir, filename);
  fs.writeFileSync(filePath, content, 'utf8');
  return filePath;
}

/**
 * Generate all policy files
 */
function generateAllPolicies(tenantName) {
  log('\n🔧 Generating Azure AD B2C Custom Policy Files', colors.cyan);
  log('=' .repeat(50), colors.cyan);

  const outputDir = ensureOutputDirectory();
  log(`\nOutput directory: ${outputDir}`, colors.blue);

  const policies = [
    {
      name: 'TrustFrameworkExtensions.xml',
      content: generateTrustFrameworkExtensions(tenantName),
      description: 'Base policy extensions with custom claims and validation'
    },
    {
      name: 'SignUpOrSignIn.xml',
      content: generateSignUpOrSignIn(tenantName),
      description: 'Main sign-up and sign-in policy with enhanced attributes'
    },
    {
      name: 'ProfileEdit.xml',
      content: generateProfileEdit(tenantName),
      description: 'Profile editing policy (optional)'
    },
    {
      name: 'PasswordReset.xml',
      content: generatePasswordReset(tenantName),
      description: 'Password reset policy (optional)'
    }
  ];

  const generatedFiles = [];

  policies.forEach(policy => {
    try {
      const filePath = writePolicyFile(outputDir, policy.name, policy.content);
      generatedFiles.push(filePath);
      log(`✅ ${policy.name}`, colors.green);
      log(`   ${policy.description}`, colors.blue);
    } catch (error) {
      log(`❌ Failed to generate ${policy.name}: ${error.message}`, colors.red);
    }
  });

  return { outputDir, generatedFiles };
}

/**
 * Display upload instructions
 */
function displayUploadInstructions(outputDir, tenantName) {
  log('\n📋 Upload Instructions', colors.cyan);
  log('=' .repeat(50), colors.cyan);

  log('\n1. **Prerequisites:**', colors.yellow);
  log('   - Ensure Identity Experience Framework is enabled in Azure AD B2C', colors.blue);
  log('   - Download and upload the base TrustFrameworkBase.xml from Microsoft starter pack', colors.blue);

  log('\n2. **Upload Order (Important!):**', colors.yellow);
  log('   a) TrustFrameworkBase.xml (from Microsoft starter pack)', colors.green);
  log('   b) TrustFrameworkExtensions.xml (generated)', colors.green);
  log('   c) SignUpOrSignIn.xml (generated)', colors.green);
  log('   d) ProfileEdit.xml (optional)', colors.green);
  log('   e) PasswordReset.xml (optional)', colors.green);

  log('\n3. **Upload Process:**', colors.yellow);
  log('   - Go to Azure AD B2C > Identity Experience Framework', colors.blue);
  log('   - Click "Upload custom policy"', colors.blue);
  log('   - Upload each file in the order above', colors.blue);
  log('   - Wait for validation to complete before uploading next file', colors.blue);

  log('\n4. **Testing:**', colors.yellow);
  log('   - After upload, test the B2C_1A_TaktMate_SignUpOrSignIn policy', colors.blue);
  log('   - Use https://jwt.ms as the reply URL for testing', colors.blue);
  log('   - Verify custom claims (company, jobTitle, industry) in JWT token', colors.blue);

  log('\n5. **Application Configuration:**', colors.yellow);
  log('   - Update your app registration to use the custom policy', colors.blue);
  log('   - Update environment variables:', colors.blue);
  log('     AZURE_AD_B2C_SIGN_UP_SIGN_IN_POLICY=B2C_1A_TaktMate_SignUpOrSignIn', colors.green);

  log(`\n📁 Generated files location: ${outputDir}`, colors.magenta);
}

/**
 * Display custom policy benefits
 */
function displayPolicyBenefits() {
  log('\n🎯 Custom Policy Benefits', colors.cyan);
  log('=' .repeat(50), colors.cyan);

  const benefits = [
    '✅ Enhanced validation for Company and Role fields (2-100 chars, 2-50 chars)',
    '✅ Industry dropdown with predefined options for better data quality',
    '✅ Improved error messages and user help text',
    '✅ Custom JWT claim mapping (company, jobTitle, industry)',
    '✅ Consistent claim names across all authentication methods',
    '✅ Better user experience with enhanced content definitions',
    '✅ Full control over authentication flow and validation rules'
  ];

  benefits.forEach(benefit => {
    log(benefit, colors.green);
  });
}

/**
 * Main function
 */
function main() {
  const command = process.argv[2];
  const tenantName = process.argv[3] || config.tenantName || 'taktmate';

  log('🚀 TaktMate Azure AD B2C Custom Policy Generator', colors.bright);
  log(`Tenant: ${tenantName}`, colors.blue);

  if (command === 'help' || command === '--help') {
    log('\nUsage: node generate-custom-policies.js [command] [tenant-name]', colors.yellow);
    log('\nCommands:', colors.yellow);
    log('  generate   - Generate all custom policy files (default)', colors.blue);
    log('  benefits   - Display custom policy benefits', colors.blue);
    log('  help       - Display this help', colors.blue);
    log('\nExamples:', colors.yellow);
    log('  npm run generate:policies', colors.green);
    log('  npm run generate:policies generate taktmate', colors.green);
    return;
  }

  if (command === 'benefits') {
    displayPolicyBenefits();
    return;
  }

  // Default: generate policies
  try {
    const { outputDir, generatedFiles } = generateAllPolicies(tenantName);
    
    log(`\n🎉 Successfully generated ${generatedFiles.length} custom policy files!`, colors.green);
    
    displayUploadInstructions(outputDir, tenantName);
    displayPolicyBenefits();
    
    log('\n📖 Next Steps:', colors.cyan);
    log('1. Review generated policy files', colors.blue);
    log('2. Upload policies to Azure AD B2C in the specified order', colors.blue);
    log('3. Test the custom policies with jwt.ms', colors.blue);
    log('4. Update application configuration to use custom policies', colors.blue);
    log('5. Proceed to Task 1.4: Register TaktMate application', colors.blue);
    
  } catch (error) {
    log(`\n❌ Error generating policies: ${error.message}`, colors.red);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = {
  generateTrustFrameworkExtensions,
  generateSignUpOrSignIn,
  generateProfileEdit,
  generatePasswordReset,
  generateAllPolicies
};
