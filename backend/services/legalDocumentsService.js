// TaktMate Legal Documents Service
// Manages privacy policy and terms of service with versioning and compliance tracking

const fs = require('fs').promises;
const path = require('path');
const { config: azureConfig } = require('../config/entraExternalId');

/**
 * Legal Documents Service
 * Manages privacy policy and terms of service with versioning and user acceptance tracking
 */
class LegalDocumentsService {
    constructor(appInsights = null) {
        this.appInsights = appInsights;
        
        // Legal documents configuration
        this.config = {
            // Document management settings
            enableVersioning: process.env.ENABLE_LEGAL_DOCUMENT_VERSIONING !== 'false',
            enableUserAcceptanceTracking: process.env.ENABLE_USER_ACCEPTANCE_TRACKING !== 'false',
            enableComplianceReporting: process.env.ENABLE_COMPLIANCE_REPORTING !== 'false',
            
            // Document storage settings
            documentsDirectory: process.env.LEGAL_DOCUMENTS_DIRECTORY || path.join(__dirname, '..', 'legal-documents'),
            enableDocumentCaching: process.env.ENABLE_DOCUMENT_CACHING !== 'false',
            cacheTimeout: parseInt(process.env.DOCUMENT_CACHE_TIMEOUT) || 60 * 60 * 1000, // 1 hour
            
            // Compliance settings
            gdprCompliant: process.env.GDPR_COMPLIANT !== 'false',
            ccpaCompliant: process.env.CCPA_COMPLIANT !== 'false',
            requireExplicitConsent: process.env.REQUIRE_EXPLICIT_CONSENT !== 'false',
            
            // Notification settings
            enableUpdateNotifications: process.env.ENABLE_UPDATE_NOTIFICATIONS !== 'false',
            notificationRetentionPeriod: parseInt(process.env.NOTIFICATION_RETENTION_PERIOD) || 90 * 24 * 60 * 60 * 1000, // 90 days
            
            // Document generation settings
            companyName: process.env.COMPANY_NAME || 'TaktMate',
            companyEmail: process.env.COMPANY_EMAIL || 'legal@taktmate.com',
            companyAddress: process.env.COMPANY_ADDRESS || '123 Business St, Suite 100, Business City, BC 12345',
            websiteUrl: process.env.WEBSITE_URL || 'https://taktmate.com',
            supportEmail: process.env.SUPPORT_EMAIL || 'support@taktmate.com',
            privacyOfficerEmail: process.env.PRIVACY_OFFICER_EMAIL || 'privacy@taktmate.com'
        };
        
        // Document versions and metadata
        this.documentVersions = new Map();
        this.userAcceptances = new Map();
        this.documentCache = new Map();
        
        // Legal document templates
        this.documentTypes = {
            PRIVACY_POLICY: 'privacy-policy',
            TERMS_OF_SERVICE: 'terms-of-service',
            COOKIE_POLICY: 'cookie-policy',
            DATA_PROCESSING_AGREEMENT: 'data-processing-agreement'
        };
        
        // Document statistics
        this.documentStats = {
            documentsServed: 0,
            acceptancesRecorded: 0,
            versionsCreated: 0,
            complianceReportsGenerated: 0,
            cacheHits: 0,
            cacheMisses: 0
        };
        
        console.log('📋 Legal Documents Service initialized');
        console.log(`   Versioning: ${this.config.enableVersioning ? '✅' : '❌'}`);
        console.log(`   User Acceptance Tracking: ${this.config.enableUserAcceptanceTracking ? '✅' : '❌'}`);
        console.log(`   GDPR Compliant: ${this.config.gdprCompliant ? '✅' : '❌'}`);
        console.log(`   CCPA Compliant: ${this.config.ccpaCompliant ? '✅' : '❌'}`);
    }
    
    /**
     * Initialize the legal documents service
     */
    async initialize() {
        try {
            // Ensure documents directory exists
            await this.ensureDocumentsDirectory();
            
            // Load existing document versions
            await this.loadDocumentVersions();
            
            // Generate default documents if they don't exist
            await this.generateDefaultDocuments();
            
            // Start periodic cleanup
            this.startPeriodicCleanup();
            
            console.log('✅ Legal Documents Service initialized successfully');
            
        } catch (error) {
            console.error('❌ Failed to initialize Legal Documents Service:', error.message);
            throw error;
        }
    }
    
    /**
     * Ensure documents directory exists
     */
    async ensureDocumentsDirectory() {
        try {
            await fs.access(this.config.documentsDirectory);
        } catch (error) {
            // Directory doesn't exist, create it
            await fs.mkdir(this.config.documentsDirectory, { recursive: true });
            console.log(`📁 Created legal documents directory: ${this.config.documentsDirectory}`);
        }
    }
    
    /**
     * Load existing document versions
     */
    async loadDocumentVersions() {
        try {
            const versionsFile = path.join(this.config.documentsDirectory, 'versions.json');
            
            try {
                const versionsData = await fs.readFile(versionsFile, 'utf8');
                const versions = JSON.parse(versionsData);
                
                for (const [docType, versionData] of Object.entries(versions)) {
                    this.documentVersions.set(docType, versionData);
                }
                
                console.log(`📄 Loaded ${Object.keys(versions).length} document version records`);
            } catch (error) {
                // Versions file doesn't exist, will be created when first document is saved
                console.log('📄 No existing document versions found, starting fresh');
            }
        } catch (error) {
            console.error('❌ Failed to load document versions:', error.message);
        }
    }
    
    /**
     * Save document versions to file
     */
    async saveDocumentVersions() {
        try {
            const versionsFile = path.join(this.config.documentsDirectory, 'versions.json');
            const versions = Object.fromEntries(this.documentVersions);
            
            await fs.writeFile(versionsFile, JSON.stringify(versions, null, 2));
            console.log('💾 Document versions saved');
        } catch (error) {
            console.error('❌ Failed to save document versions:', error.message);
        }
    }
    
    /**
     * Generate default legal documents
     */
    async generateDefaultDocuments() {
        try {
            // Generate privacy policy if it doesn't exist
            if (!this.documentVersions.has(this.documentTypes.PRIVACY_POLICY)) {
                await this.generatePrivacyPolicy();
            }
            
            // Generate terms of service if it doesn't exist
            if (!this.documentVersions.has(this.documentTypes.TERMS_OF_SERVICE)) {
                await this.generateTermsOfService();
            }
            
            // Generate cookie policy if it doesn't exist
            if (!this.documentVersions.has(this.documentTypes.COOKIE_POLICY)) {
                await this.generateCookiePolicy();
            }
            
            console.log('✅ Default legal documents generated');
            
        } catch (error) {
            console.error('❌ Failed to generate default documents:', error.message);
            throw error;
        }
    }
    
    /**
     * Generate comprehensive privacy policy
     */
    async generatePrivacyPolicy() {
        const version = this.generateVersion();
        const effectiveDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
        
        const privacyPolicy = `# Privacy Policy

**Effective Date:** ${effectiveDate}
**Version:** ${version}

## 1. Introduction

Welcome to ${this.config.companyName} ("we," "our," or "us"). We are committed to protecting your personal information and your right to privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our service.

## 2. Information We Collect

### 2.1 Information You Provide to Us
- **Account Information:** When you create an account, we collect information such as your name, email address, and authentication credentials through Microsoft Entra External ID.
- **Profile Information:** Additional profile information you choose to provide, including job title, company, and other professional details.
- **Content:** Data files (CSV files) you upload and process through our service.
- **Communications:** Messages, feedback, and other communications you send to us.

### 2.2 Information Automatically Collected
- **Usage Information:** Information about how you use our service, including features accessed, time spent, and interaction patterns.
- **Device Information:** Information about your device, including IP address, browser type, operating system, and device identifiers.
- **Log Information:** Server logs that include details about your requests, crashes, and system activity.
- **Analytics Data:** Performance metrics, error tracking, and usage analytics through Azure Application Insights.

### 2.3 Information from Third Parties
- **Microsoft Entra External ID:** Authentication and identity information from Microsoft Microsoft Entra External ID.
- **OpenAI Services:** Processing results and interaction data from OpenAI API services.

## 3. How We Use Your Information

We use your information for the following purposes:

### 3.1 Service Provision
- Providing, maintaining, and improving our CSV processing and AI chat services
- Authenticating your identity and managing your account
- Processing and analyzing your uploaded CSV data
- Generating AI-powered insights and responses

### 3.2 Communication
- Sending you service-related notifications and updates
- Responding to your inquiries and providing customer support
- Sending important notices about changes to our terms or policies

### 3.3 Security and Compliance
- Protecting against fraud, abuse, and security threats
- Monitoring for suspicious activities and policy violations
- Complying with legal obligations and regulatory requirements
- Conducting security audits and risk assessments

### 3.4 Analytics and Improvement
- Analyzing usage patterns to improve our services
- Conducting research and development for new features
- Generating anonymized analytics and performance reports
- Optimizing user experience and service performance

## 4. Legal Basis for Processing (GDPR)

Under the General Data Protection Regulation (GDPR), we process your personal data based on the following legal grounds:

- **Contract Performance:** Processing necessary to perform our service contract with you
- **Legitimate Interests:** Our legitimate business interests in providing and improving our services
- **Consent:** Where you have given explicit consent for specific processing activities
- **Legal Compliance:** Processing required to comply with legal obligations

## 5. How We Share Your Information

### 5.1 Service Providers
We may share your information with trusted third-party service providers who assist us in operating our service:

- **Microsoft Azure:** Cloud infrastructure, authentication (Microsoft Entra External ID), and analytics (Application Insights)
- **OpenAI:** AI processing services for chat and data analysis features
- **Security Providers:** Services that help us detect and prevent fraud and security threats

### 5.2 Legal Requirements
We may disclose your information if required by law or in response to:
- Valid legal process (subpoenas, court orders)
- Government investigations or regulatory requests
- Protection of our rights, property, or safety
- Prevention of fraud or illegal activities

### 5.3 Business Transfers
In the event of a merger, acquisition, or sale of assets, your information may be transferred as part of the business transaction.

## 6. Data Retention

We retain your personal information for as long as necessary to provide our services and comply with legal obligations:

- **Account Data:** Retained while your account is active and for ${this.config.gdprCompliant ? '30 days' : '90 days'} after account deletion
- **Usage Data:** Retained for up to 2 years for analytics and service improvement purposes
- **Security Logs:** Retained for up to 1 year for security and fraud prevention
- **Legal Compliance:** Some data may be retained longer to comply with legal requirements

## 7. Your Rights and Choices

### 7.1 Access and Control
You have the following rights regarding your personal information:

- **Access:** Request access to your personal data we hold
- **Correction:** Request correction of inaccurate or incomplete data
- **Deletion:** Request deletion of your personal data (subject to legal requirements)
- **Portability:** Request a copy of your data in a structured, machine-readable format
- **Restriction:** Request restriction of processing in certain circumstances
- **Objection:** Object to processing based on legitimate interests

### 7.2 How to Exercise Your Rights
To exercise these rights, please contact us at ${this.config.privacyOfficerEmail} or use our in-app data export and deletion tools.

### 7.3 Account Management
You can manage your account settings and preferences through your user dashboard, including:
- Updating profile information
- Managing consent preferences
- Downloading your data
- Requesting account deletion

## 8. Data Security

We implement appropriate technical and organizational measures to protect your personal information:

### 8.1 Technical Safeguards
- **Encryption:** Data encrypted in transit and at rest using industry-standard encryption
- **Access Controls:** Role-based access controls and multi-factor authentication
- **Network Security:** Firewalls, intrusion detection, and network monitoring
- **Regular Updates:** Regular security updates and vulnerability assessments

### 8.2 Organizational Safeguards
- **Privacy Training:** Regular privacy and security training for our team
- **Data Minimization:** We collect and process only the data necessary for our services
- **Incident Response:** Established procedures for security incident response
- **Third-Party Security:** Due diligence on third-party service providers' security practices

## 9. International Data Transfers

Your information may be transferred to and processed in countries other than your country of residence. We ensure appropriate safeguards are in place for international transfers:

- **Adequacy Decisions:** Transfers to countries with adequate data protection laws
- **Standard Contractual Clauses:** Use of EU-approved standard contractual clauses
- **Certification Programs:** Transfers under recognized certification programs

## 10. Children's Privacy

Our service is not intended for children under 13 years of age. We do not knowingly collect personal information from children under 13. If we become aware that we have collected personal information from a child under 13, we will take steps to delete such information.

## 11. California Privacy Rights (CCPA)

${this.config.ccpaCompliant ? `
If you are a California resident, you have additional rights under the California Consumer Privacy Act (CCPA):

- **Right to Know:** Request information about the categories and specific pieces of personal information we collect
- **Right to Delete:** Request deletion of your personal information
- **Right to Opt-Out:** Opt-out of the sale of your personal information (we do not sell personal information)
- **Right to Non-Discrimination:** We will not discriminate against you for exercising your privacy rights

To exercise these rights, please contact us at ${this.config.privacyOfficerEmail}.
` : 'This section applies to California residents and will be updated as needed to comply with applicable state privacy laws.'}

## 12. Changes to This Privacy Policy

We may update this Privacy Policy from time to time. When we make changes:

- We will notify you of material changes via email or through our service
- The updated policy will include a new effective date
- Your continued use of our service after changes become effective constitutes acceptance
- Previous versions will remain available for your reference

## 13. Contact Information

If you have questions, concerns, or requests regarding this Privacy Policy or our privacy practices, please contact us:

**${this.config.companyName}**
Email: ${this.config.privacyOfficerEmail}
Support: ${this.config.supportEmail}
Address: ${this.config.companyAddress}

**Data Protection Officer:** ${this.config.privacyOfficerEmail}

## 14. Effective Date and Acknowledgment

This Privacy Policy is effective as of ${effectiveDate} and supersedes all previous versions. By using our service, you acknowledge that you have read, understood, and agree to be bound by this Privacy Policy.

---

*Last updated: ${effectiveDate}*
*Version: ${version}*
`;

        await this.saveDocument(this.documentTypes.PRIVACY_POLICY, privacyPolicy, version);
        console.log(`✅ Generated Privacy Policy version ${version}`);
    }
    
    /**
     * Generate comprehensive terms of service
     */
    async generateTermsOfService() {
        const version = this.generateVersion();
        const effectiveDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
        
        const termsOfService = `# Terms of Service

**Effective Date:** ${effectiveDate}
**Version:** ${version}

## 1. Agreement to Terms

Welcome to ${this.config.companyName} ("we," "our," or "us"). These Terms of Service ("Terms") govern your use of our CSV processing and AI chat service ("Service") operated by ${this.config.companyName}.

By accessing or using our Service, you agree to be bound by these Terms. If you disagree with any part of these terms, then you may not access the Service.

## 2. Description of Service

${this.config.companyName} provides a cloud-based service that allows users to:

- Upload and process CSV (Comma-Separated Values) files
- Interact with AI-powered chat functionality for data analysis
- Generate insights and reports from uploaded data
- Manage data processing workflows through a web interface

## 3. User Accounts and Authentication

### 3.1 Account Creation
- You must create an account to use our Service
- Authentication is provided through Microsoft Microsoft Entra External ID
- You must provide accurate and complete information when creating your account
- You are responsible for maintaining the security of your account credentials

### 3.2 Account Responsibilities
- You are responsible for all activities that occur under your account
- You must notify us immediately of any unauthorized use of your account
- You must not share your account credentials with others
- You must comply with all applicable laws and regulations

### 3.3 Account Termination
- You may terminate your account at any time through your account settings
- We may terminate or suspend your account for violations of these Terms
- Upon termination, your data will be handled according to our Privacy Policy

## 4. Acceptable Use Policy

### 4.1 Permitted Uses
You may use our Service only for lawful purposes and in accordance with these Terms. Permitted uses include:

- Processing legitimate business data for analysis and insights
- Using AI chat features for data-related questions and analysis
- Generating reports and visualizations from your uploaded data
- Collaborating with team members on data processing projects

### 4.2 Prohibited Uses
You may not use our Service:

- For any unlawful purpose or to solicit unlawful acts
- To violate any international, federal, state, or local laws or regulations
- To transmit or procure the sending of any advertising or promotional material without prior written consent
- To impersonate or attempt to impersonate the Company, employees, other users, or any other person or entity
- To process personal data without proper legal basis and consent
- To upload malicious code, viruses, or any harmful software
- To attempt to gain unauthorized access to our systems or other users' accounts

### 4.3 Data Content Restrictions
You are solely responsible for the content of data you upload. You must not upload:

- Personal data without proper legal basis and consent
- Copyrighted material without authorization
- Confidential or proprietary information belonging to third parties
- Data containing malicious code or harmful content
- Data that violates any applicable laws or regulations

## 5. Data Processing and Privacy

### 5.1 Your Data
- You retain ownership of all data you upload to our Service
- We process your data only as necessary to provide our Service
- Our data processing practices are governed by our Privacy Policy
- You grant us a limited license to process your data for service provision

### 5.2 Data Security
- We implement industry-standard security measures to protect your data
- Data is encrypted in transit and at rest
- We regularly monitor and audit our security practices
- However, no method of transmission or storage is 100% secure

### 5.3 Data Retention
- We retain your data only as long as necessary to provide our Service
- You can delete your data at any time through your account settings
- We will delete your data within 30 days of account termination
- Some data may be retained longer for legal compliance purposes

## 6. Intellectual Property Rights

### 6.1 Our Rights
- The Service and its original content, features, and functionality are owned by ${this.config.companyName}
- The Service is protected by copyright, trademark, and other laws
- Our trademarks may not be used without our prior written consent

### 6.2 Your Rights
- You retain all rights to data you upload to our Service
- You grant us a limited, non-exclusive license to process your data
- This license terminates when you delete your data or terminate your account

### 6.3 Third-Party Content
- Our Service may contain links to third-party websites or services
- We do not endorse or assume responsibility for third-party content
- Third-party services are governed by their own terms and privacy policies

## 7. Service Availability and Performance

### 7.1 Service Availability
- We strive to maintain high service availability but do not guarantee 100% uptime
- Planned maintenance will be announced in advance when possible
- We are not liable for service interruptions beyond our reasonable control

### 7.2 Performance
- Service performance may vary based on factors including data size and complexity
- We do not guarantee specific processing times or performance metrics
- We reserve the right to implement reasonable usage limits

### 7.3 Support
- We provide support through email and our help documentation
- Support is provided during regular business hours
- We will make reasonable efforts to respond to support requests promptly

## 8. Fees and Payment

### 8.1 Service Fees
- Our Service may be offered under various pricing plans
- Current pricing information is available on our website
- Fees are subject to change with reasonable notice

### 8.2 Payment Terms
- Payment is due according to the terms of your selected plan
- We use third-party payment processors to handle payment transactions
- You are responsible for all taxes and fees associated with your use of the Service

### 8.3 Refunds
- Refund policies are outlined in your service agreement
- Refunds, if applicable, will be processed according to our refund policy
- We reserve the right to modify our refund policy with reasonable notice

## 9. Limitation of Liability

### 9.1 Disclaimer of Warranties
- The Service is provided "as is" and "as available" without warranties of any kind
- We disclaim all warranties, whether express, implied, statutory, or otherwise
- We do not warrant that the Service will be uninterrupted, error-free, or secure

### 9.2 Limitation of Damages
- In no event shall ${this.config.companyName} be liable for any indirect, incidental, special, consequential, or punitive damages
- Our total liability to you for any claims arising from these Terms or your use of the Service shall not exceed the amount you paid us in the 12 months preceding the claim
- Some jurisdictions do not allow the exclusion of certain warranties or limitation of damages

### 9.3 Indemnification
- You agree to indemnify and hold harmless ${this.config.companyName} from any claims arising from your use of the Service
- This includes claims related to your violation of these Terms or infringement of third-party rights
- We will provide reasonable notice of any such claims

## 10. Termination

### 10.1 Termination by You
- You may terminate your account at any time through your account settings
- Upon termination, your access to the Service will cease immediately
- Your data will be handled according to our Privacy Policy

### 10.2 Termination by Us
- We may terminate or suspend your account immediately for violations of these Terms
- We may terminate your account with reasonable notice for business reasons
- We will provide notice of termination except in cases of serious violations

### 10.3 Effect of Termination
- Upon termination, all rights and licenses granted to you will cease
- Provisions that should survive termination will remain in effect
- You remain liable for any charges incurred before termination

## 11. Governing Law and Dispute Resolution

### 11.1 Governing Law
- These Terms are governed by and construed in accordance with applicable laws
- Any disputes will be resolved in the courts of competent jurisdiction

### 11.2 Dispute Resolution
- We encourage you to contact us first to resolve any disputes informally
- If informal resolution is not possible, disputes may be subject to binding arbitration
- Class action lawsuits and jury trials are waived to the extent permitted by law

## 12. Changes to Terms

### 12.1 Modifications
- We reserve the right to modify these Terms at any time
- Material changes will be communicated via email or through the Service
- Your continued use of the Service after changes constitutes acceptance

### 12.2 Notice Period
- We will provide at least 30 days' notice for material changes
- Non-material changes may be implemented immediately
- Previous versions of these Terms will remain available for reference

## 13. General Provisions

### 13.1 Severability
- If any provision of these Terms is found to be unenforceable, the remaining provisions will remain in effect
- Invalid provisions will be replaced with enforceable provisions that achieve the same intent

### 13.2 Entire Agreement
- These Terms, together with our Privacy Policy, constitute the entire agreement between you and ${this.config.companyName}
- These Terms supersede all prior agreements and understandings

### 13.3 Assignment
- You may not assign your rights under these Terms without our written consent
- We may assign our rights and obligations under these Terms without restriction

### 13.4 Waiver
- Our failure to enforce any provision of these Terms does not constitute a waiver
- Waivers must be in writing and signed by an authorized representative

## 14. Contact Information

If you have any questions about these Terms of Service, please contact us:

**${this.config.companyName}**
Email: ${this.config.companyEmail}
Support: ${this.config.supportEmail}
Address: ${this.config.companyAddress}
Website: ${this.config.websiteUrl}

## 15. Acknowledgment

By using our Service, you acknowledge that you have read these Terms of Service, understand them, and agree to be bound by them.

---

*Last updated: ${effectiveDate}*
*Version: ${version}*
`;

        await this.saveDocument(this.documentTypes.TERMS_OF_SERVICE, termsOfService, version);
        console.log(`✅ Generated Terms of Service version ${version}`);
    }
    
    /**
     * Generate comprehensive cookie policy
     */
    async generateCookiePolicy() {
        const version = this.generateVersion();
        const effectiveDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
        
        const cookiePolicy = `# Cookie Policy

**Effective Date:** ${effectiveDate}
**Version:** ${version}

## 1. Introduction

This Cookie Policy explains how ${this.config.companyName} ("we," "our," or "us") uses cookies and similar technologies when you visit our website and use our service. This policy should be read together with our Privacy Policy and Terms of Service.

## 2. What Are Cookies

Cookies are small text files that are placed on your device (computer, tablet, or mobile) when you visit a website. They are widely used to make websites work more efficiently and to provide information to website owners.

### 2.1 Types of Cookies We Use

#### Essential Cookies
These cookies are necessary for the website to function properly and cannot be disabled:
- **Authentication cookies:** Keep you logged in during your session
- **Security cookies:** Protect against cross-site request forgery (CSRF) attacks
- **Session management:** Maintain your session state and preferences

#### Analytics Cookies
These cookies help us understand how visitors interact with our website:
- **Azure Application Insights:** Collects usage statistics and performance data
- **Error tracking:** Helps us identify and fix technical issues
- **Performance monitoring:** Measures page load times and user interactions

#### Functional Cookies
These cookies enhance your experience by remembering your preferences:
- **User preferences:** Remember your language and display settings
- **Feature toggles:** Enable or disable specific features based on your choices
- **UI state:** Remember collapsed/expanded sections and layout preferences

## 3. How We Use Cookies

### 3.1 Authentication and Security
- Maintain your login session securely
- Protect against unauthorized access
- Implement multi-factor authentication when enabled
- Prevent cross-site request forgery attacks

### 3.2 Service Functionality
- Remember your file processing preferences
- Maintain chat conversation history during your session
- Store temporary data for ongoing operations
- Preserve your workspace state between visits

### 3.3 Analytics and Improvement
- Measure website performance and usage patterns
- Identify popular features and areas for improvement
- Track error rates and system reliability
- Generate anonymized usage reports

## 4. Third-Party Cookies

Our service may use third-party cookies from the following providers:

### 4.1 Microsoft Azure Services
- **Microsoft Entra External ID:** Authentication and identity management
- **Azure Application Insights:** Performance monitoring and analytics
- **Azure CDN:** Content delivery and caching

### 4.2 OpenAI Services
- **API session management:** Maintain context for AI interactions
- **Usage tracking:** Monitor API usage for billing and optimization

## 5. Cookie Management

### 5.1 Browser Settings
You can control cookies through your browser settings:

#### Google Chrome
1. Click the three dots menu → Settings → Privacy and security → Cookies and other site data
2. Choose your preferred cookie settings
3. Manage exceptions for specific sites

#### Mozilla Firefox
1. Click the menu button → Options → Privacy & Security
2. Under Cookies and Site Data, choose your settings
3. Manage individual site permissions

#### Safari
1. Safari menu → Preferences → Privacy
2. Choose your cookie and website data settings
3. Manage website-specific settings

#### Microsoft Edge
1. Click the three dots menu → Settings → Cookies and site permissions
2. Configure cookie settings and exceptions
3. Manage permissions for individual sites

### 5.2 Our Cookie Consent Management
${this.config.requireExplicitConsent ? `
We provide a cookie consent banner that allows you to:
- Accept or reject non-essential cookies
- Customize your cookie preferences by category
- Change your preferences at any time through account settings
- View detailed information about each cookie type
` : `
We use cookies in accordance with applicable laws and regulations. You can manage your cookie preferences through your browser settings or by contacting us at ${this.config.supportEmail}.
`}

### 5.3 Impact of Disabling Cookies
Disabling certain cookies may affect your experience:

- **Essential cookies:** Disabling these may prevent you from using core features
- **Analytics cookies:** Disabling these won't affect functionality but limits our ability to improve the service
- **Functional cookies:** Disabling these may require you to re-enter preferences each visit

## 6. Cookie Retention

### 6.1 Session Cookies
- Deleted when you close your browser
- Used for temporary session management
- Do not persist between browser sessions

### 6.2 Persistent Cookies
- **Authentication cookies:** Up to 30 days or until logout
- **Preference cookies:** Up to 1 year or until changed
- **Analytics cookies:** Up to 2 years for trend analysis

### 6.3 Automatic Cleanup
- Expired cookies are automatically removed
- We regularly review and update cookie retention periods
- You can manually clear cookies through browser settings

## 7. Updates to This Cookie Policy

### 7.1 Policy Changes
- We may update this Cookie Policy to reflect changes in our practices
- Material changes will be communicated through our website or via email
- The effective date at the top of this policy indicates when it was last updated

### 7.2 Notification of Changes
- Significant changes will be announced with at least 30 days' notice
- Continued use of our service after changes constitutes acceptance
- Previous versions will remain available for reference

## 8. Legal Basis for Cookie Use

### 8.1 GDPR Compliance
Under the General Data Protection Regulation (GDPR), we use cookies based on:
- **Consent:** For non-essential cookies where consent is required
- **Legitimate interests:** For analytics and service improvement
- **Contractual necessity:** For cookies essential to service provision

### 8.2 Other Regulations
We comply with applicable cookie laws and regulations, including:
- ePrivacy Directive (Cookie Law)
- California Consumer Privacy Act (CCPA)
- Other applicable local privacy laws

## 9. Your Rights

### 9.1 Access and Control
You have the right to:
- Know what cookies we use and why
- Control which cookies are set on your device
- Withdraw consent for non-essential cookies
- Request information about our cookie practices

### 9.2 Data Subject Rights
Under GDPR and other privacy laws, you may have additional rights regarding data collected through cookies. Please refer to our Privacy Policy for more information.

## 10. Contact Information

If you have questions about our use of cookies or this Cookie Policy, please contact us:

**${this.config.companyName}**
Email: ${this.config.privacyOfficerEmail}
Support: ${this.config.supportEmail}
Address: ${this.config.companyAddress}

## 11. Technical Information

### 11.1 Cookie Details
For technical users, here are details about the specific cookies we use:

#### Essential Cookies
- **session_id:** Session identifier (HttpOnly, Secure, SameSite=Strict)
- **csrf_token:** CSRF protection token (HttpOnly, Secure, SameSite=Strict)
- **auth_token:** Authentication token (HttpOnly, Secure, SameSite=Strict)

#### Analytics Cookies
- **ai_session:** Application Insights session tracking
- **ai_user:** Application Insights user identification
- **performance_metrics:** Performance monitoring data

#### Functional Cookies
- **user_preferences:** JSON object with user settings
- **ui_state:** Interface state and layout preferences
- **feature_flags:** Enabled/disabled feature toggles

### 11.2 Cookie Attributes
All cookies set by our service use appropriate security attributes:
- **Secure:** Only transmitted over HTTPS connections
- **HttpOnly:** Not accessible via JavaScript (where appropriate)
- **SameSite:** Protection against cross-site request attacks

---

*Last updated: ${effectiveDate}*
*Version: ${version}*
`;

        await this.saveDocument(this.documentTypes.COOKIE_POLICY, cookiePolicy, version);
        console.log(`✅ Generated Cookie Policy version ${version}`);
    }
    
    /**
     * Save document with versioning
     */
    async saveDocument(documentType, content, version) {
        try {
            const filename = `${documentType}-v${version}.md`;
            const filepath = path.join(this.config.documentsDirectory, filename);
            
            // Save document content
            await fs.writeFile(filepath, content, 'utf8');
            
            // Update version metadata
            const versionData = {
                currentVersion: version,
                versions: this.documentVersions.get(documentType)?.versions || [],
                lastUpdated: new Date().toISOString(),
                filepath: filepath
            };
            
            versionData.versions.push({
                version: version,
                createdAt: new Date().toISOString(),
                filepath: filepath,
                checksum: this.generateChecksum(content)
            });
            
            this.documentVersions.set(documentType, versionData);
            
            // Save versions metadata
            await this.saveDocumentVersions();
            
            // Update statistics
            this.documentStats.versionsCreated++;
            
            // Track in Application Insights
            if (this.appInsights) {
                this.appInsights.telemetry.trackEvent('Legal_Document_Created', {
                    documentType: documentType,
                    version: version,
                    contentLength: content.length.toString()
                });
            }
            
        } catch (error) {
            console.error(`❌ Failed to save document ${documentType}:`, error.message);
            throw error;
        }
    }
    
    /**
     * Get document by type and version
     */
    async getDocument(documentType, version = null) {
        try {
            // Check cache first
            const cacheKey = `${documentType}_${version || 'current'}`;
            if (this.config.enableDocumentCaching && this.documentCache.has(cacheKey)) {
                const cached = this.documentCache.get(cacheKey);
                if (cached.expiresAt > Date.now()) {
                    this.documentStats.cacheHits++;
                    return cached.document;
                }
            }
            
            this.documentStats.cacheMisses++;
            
            const versionData = this.documentVersions.get(documentType);
            if (!versionData) {
                throw new Error(`Document type ${documentType} not found`);
            }
            
            // Use current version if not specified
            const targetVersion = version || versionData.currentVersion;
            
            // Find version info
            const versionInfo = versionData.versions.find(v => v.version === targetVersion);
            if (!versionInfo) {
                throw new Error(`Version ${targetVersion} of ${documentType} not found`);
            }
            
            // Read document content
            const content = await fs.readFile(versionInfo.filepath, 'utf8');
            
            const document = {
                type: documentType,
                version: targetVersion,
                content: content,
                createdAt: versionInfo.createdAt,
                checksum: versionInfo.checksum,
                metadata: {
                    versions: versionData.versions.length,
                    lastUpdated: versionData.lastUpdated
                }
            };
            
            // Cache the document
            if (this.config.enableDocumentCaching) {
                this.documentCache.set(cacheKey, {
                    document: document,
                    expiresAt: Date.now() + this.config.cacheTimeout
                });
            }
            
            // Update statistics
            this.documentStats.documentsServed++;
            
            return document;
            
        } catch (error) {
            console.error(`❌ Failed to get document ${documentType}:`, error.message);
            throw error;
        }
    }
    
    /**
     * Record user acceptance of legal document
     */
    async recordUserAcceptance(userId, documentType, version, metadata = {}) {
        if (!this.config.enableUserAcceptanceTracking) {
            return;
        }
        
        try {
            const acceptanceId = this.generateAcceptanceId();
            const acceptance = {
                acceptanceId: acceptanceId,
                userId: userId,
                documentType: documentType,
                version: version,
                acceptedAt: new Date().toISOString(),
                ipAddress: metadata.ipAddress || 'unknown',
                userAgent: metadata.userAgent || 'unknown',
                source: metadata.source || 'web_app'
            };
            
            // Store acceptance record
            const userAcceptances = this.userAcceptances.get(userId) || [];
            userAcceptances.push(acceptance);
            this.userAcceptances.set(userId, userAcceptances);
            
            // Update statistics
            this.documentStats.acceptancesRecorded++;
            
            // Track in Application Insights
            if (this.appInsights) {
                this.appInsights.telemetry.trackEvent('Legal_Document_Accepted', {
                    userId: userId,
                    documentType: documentType,
                    version: version,
                    acceptanceId: acceptanceId
                });
            }
            
            console.log(`✅ Recorded acceptance of ${documentType} v${version} by user ${userId}`);
            
            return acceptanceId;
            
        } catch (error) {
            console.error('❌ Failed to record user acceptance:', error.message);
            throw error;
        }
    }
    
    /**
     * Get user acceptance history
     */
    getUserAcceptances(userId) {
        if (!this.config.enableUserAcceptanceTracking) {
            return [];
        }
        
        return this.userAcceptances.get(userId) || [];
    }
    
    /**
     * Check if user has accepted current version of document
     */
    hasUserAcceptedCurrentVersion(userId, documentType) {
        if (!this.config.enableUserAcceptanceTracking) {
            return true; // Assume acceptance if tracking is disabled
        }
        
        const versionData = this.documentVersions.get(documentType);
        if (!versionData) {
            return false;
        }
        
        const userAcceptances = this.getUserAcceptances(userId);
        const currentVersionAcceptance = userAcceptances.find(
            acceptance => acceptance.documentType === documentType && 
                         acceptance.version === versionData.currentVersion
        );
        
        return !!currentVersionAcceptance;
    }
    
    /**
     * Generate document version
     */
    generateVersion() {
        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const timestamp = String(Date.now()).slice(-6); // Last 6 digits of timestamp
        
        return `${year}.${month}.${day}.${timestamp}`;
    }
    
    /**
     * Generate acceptance ID
     */
    generateAcceptanceId() {
        return `acc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    /**
     * Generate content checksum
     */
    generateChecksum(content) {
        const crypto = require('crypto');
        return crypto.createHash('sha256').update(content).digest('hex');
    }
    
    /**
     * Start periodic cleanup
     */
    startPeriodicCleanup() {
        setInterval(() => {
            this.cleanupExpiredCache();
        }, 60 * 60 * 1000); // Cleanup every hour
        
        console.log('✅ Periodic cleanup started for legal documents');
    }
    
    /**
     * Cleanup expired cache entries
     */
    cleanupExpiredCache() {
        if (!this.config.enableDocumentCaching) {
            return;
        }
        
        const now = Date.now();
        let cleanedCount = 0;
        
        for (const [key, cached] of this.documentCache.entries()) {
            if (cached.expiresAt <= now) {
                this.documentCache.delete(key);
                cleanedCount++;
            }
        }
        
        if (cleanedCount > 0) {
            console.log(`🧹 Cleaned up ${cleanedCount} expired document cache entries`);
        }
    }
    
    /**
     * Get service statistics
     */
    getStatistics() {
        return {
            ...this.documentStats,
            documentsAvailable: this.documentVersions.size,
            totalVersions: Array.from(this.documentVersions.values())
                .reduce((total, versionData) => total + versionData.versions.length, 0),
            usersWithAcceptances: this.userAcceptances.size,
            cacheSize: this.documentCache.size,
            
            configuration: {
                enableVersioning: this.config.enableVersioning,
                enableUserAcceptanceTracking: this.config.enableUserAcceptanceTracking,
                enableComplianceReporting: this.config.enableComplianceReporting,
                gdprCompliant: this.config.gdprCompliant,
                ccpaCompliant: this.config.ccpaCompliant,
                requireExplicitConsent: this.config.requireExplicitConsent,
                documentsDirectory: this.config.documentsDirectory,
                enableDocumentCaching: this.config.enableDocumentCaching,
                cacheTimeout: this.config.cacheTimeout / 1000 / 60 + ' minutes'
            },
            
            documents: Array.from(this.documentVersions.entries()).map(([type, versionData]) => ({
                type: type,
                currentVersion: versionData.currentVersion,
                versionsCount: versionData.versions.length,
                lastUpdated: versionData.lastUpdated
            }))
        };
    }
}

module.exports = {
    LegalDocumentsService
};
