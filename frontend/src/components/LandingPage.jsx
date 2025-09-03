/**
 * Marketing Landing Page Component for TaktMate
 * 
 * This component provides a comprehensive marketing landing page with
 * hero section, features, benefits, and call-to-action elements.
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import LoginButton from './auth/LoginButton';
import { useAuth } from '../contexts/AuthContext';
import SEOHelmet, { SEOConfigs } from './SEOHelmet';

const LandingPage = () => {
  const [showFloatingCTA, setShowFloatingCTA] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const handleScroll = () => {
      // Show floating CTA after scrolling past the hero section
      const heroHeight = window.innerHeight;
      setShowFloatingCTA(window.scrollY > heroHeight);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Handle authentication success
  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      // Small delay to show success animation
      const timer = setTimeout(() => {
        navigate('/');
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, isLoading, navigate]);

  // Enhanced sign-in handler with visual feedback
  const handleSignIn = async () => {
    setIsSigningIn(true);
    // The actual sign-in is handled by LoginButton
    // This just provides visual feedback
  };

  return (
    <>
      <SEOHelmet 
        title="TaktMate - AI-Powered CSV Data Analysis | Transform Spreadsheets into Conversations"
        description="Upload CSV files and chat with your data using GPT-4. Get instant insights, discover patterns, and make data-driven decisions. Secure, enterprise-ready, with Azure AD B2C authentication."
        keywords="CSV analysis, AI data analysis, GPT-4, business intelligence, data chat, spreadsheet analysis, data insights, Azure AD B2C, secure data platform"
        url="https://taktmate.com/"
      />
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Header/Navigation */}
      <header className="bg-white/80 backdrop-blur-sm shadow-sm border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <div className="flex items-center space-x-2 sm:space-x-3">
                {/* Logo */}
                <div className="h-8 w-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">T</span>
                </div>
                <h1 className="text-lg sm:text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  TaktMate
                </h1>
              </div>
            </div>
            
            {/* Navigation Actions */}
            <div className="flex items-center space-x-2 sm:space-x-4">
              <button className="hidden sm:block text-gray-600 hover:text-gray-800 font-medium px-4 py-2 transition-colors">
                Sign In
              </button>
              <LoginButton 
                variant="primary" 
                size="sm" 
                className="shadow-lg hover:shadow-xl transition-shadow text-sm sm:text-base px-3 sm:px-4 py-2"
              >
                <span className="hidden sm:inline">Start Free Trial</span>
                <span className="sm:hidden">Start Trial</span>
              </LoginButton>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 sm:pt-16 lg:pt-20 pb-12 sm:pb-16">
          <div className="text-center">
            {/* Hero Headline */}
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 mb-6 sm:mb-8 leading-tight">
              <span className="block sm:inline">Stop Wrestling with</span>
              <span className="block bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mt-2 sm:mt-0">
                Spreadsheets & Formulas
              </span>
              <span className="block mt-2">Just Ask Your Data Questions</span>
            </h1>
            
            {/* Hero Subtext */}
            <p className="text-lg sm:text-xl text-gray-600 mb-8 sm:mb-12 max-w-3xl mx-auto leading-relaxed px-4 sm:px-0">
              TaktMate turns your CSV files into an intelligent conversation partner. No more complex formulas, 
              pivot tables, or data analysis paralysis. Simply upload your data and ask questions like 
              <em className="block sm:inline mt-2 sm:mt-0">"What are my top-performing products?"</em> or <em>"Show me sales trends by region"</em> 
              — get instant, accurate insights powered by GPT-4.
            </p>
            
            {/* Hero CTA */}
            <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-6 mb-12 sm:mb-16">
              <LoginButton 
                variant="primary" 
                size="lg" 
                className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 px-8 sm:px-10 py-4 sm:py-5 text-lg sm:text-xl font-bold shadow-2xl hover:shadow-3xl transform hover:-translate-y-1 transition-all duration-200"
              >
                🚀 Start Free Trial
              </LoginButton>
              <button className="w-full sm:w-auto text-gray-600 hover:text-blue-600 font-semibold px-6 py-3 border-2 border-gray-300 hover:border-blue-400 rounded-lg transition-all duration-200 flex items-center justify-center space-x-2">
                <span className="hidden sm:inline">Already have an account? Sign In</span>
                <span className="sm:hidden">Sign In</span>
                <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </button>
            </div>
            
            {/* Value Proposition Badges */}
            <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4 mb-6 sm:mb-8 text-xs sm:text-sm px-4">
              <div className="bg-green-100 text-green-800 px-3 sm:px-4 py-2 rounded-full font-medium flex items-center space-x-1 sm:space-x-2">
                <svg className="h-3 w-3 sm:h-4 sm:w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Free 14-day trial</span>
              </div>
              <div className="bg-blue-100 text-blue-800 px-3 sm:px-4 py-2 rounded-full font-medium flex items-center space-x-1 sm:space-x-2">
                <svg className="h-3 w-3 sm:h-4 sm:w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="hidden sm:inline">No credit card required</span>
                <span className="sm:hidden">No credit card</span>
              </div>
              <div className="bg-purple-100 text-purple-800 px-3 sm:px-4 py-2 rounded-full font-medium flex items-center space-x-1 sm:space-x-2">
                <svg className="h-3 w-3 sm:h-4 sm:w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="hidden sm:inline">Setup in 30 seconds</span>
                <span className="sm:hidden">30s setup</span>
              </div>
            </div>
            
            {/* Trust Indicators */}
            <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-8 text-xs sm:text-sm text-gray-500">
              <div className="flex items-center space-x-1 sm:space-x-2">
                <svg className="h-3 w-3 sm:h-4 sm:w-4 text-green-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="hidden sm:inline">Enterprise Security</span>
                <span className="sm:hidden">Secure</span>
              </div>
              <div className="flex items-center space-x-1 sm:space-x-2">
                <svg className="h-3 w-3 sm:h-4 sm:w-4 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span>GPT-4</span>
              </div>
              <div className="flex items-center space-x-1 sm:space-x-2">
                <svg className="h-3 w-3 sm:h-4 sm:w-4 text-purple-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <span>GDPR</span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Background Elements */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-10 w-72 h-72 bg-blue-200 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-pulse"></div>
          <div className="absolute top-40 right-10 w-72 h-72 bg-purple-200 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-pulse animation-delay-2000"></div>
          <div className="absolute -bottom-8 left-20 w-72 h-72 bg-pink-200 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-pulse animation-delay-4000"></div>
        </div>
      </section>

      {/* Key Features Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Turn Any CSV Into Your Personal Data Analyst
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Whether you're analyzing sales data, customer surveys, financial reports, or research findings — 
              TaktMate understands your data and speaks your language. No PhD in statistics required.
            </p>
          </div>
          
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {/* Feature 1: Secure Upload */}
            <div className="sm:col-span-2 lg:col-span-1 bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl p-6 sm:p-8 hover:shadow-lg transition-shadow">
              <div className="h-12 w-12 bg-blue-600 rounded-xl flex items-center justify-center mb-6">
                <svg className="h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Upload & Forget the Technical Stuff</h3>
              <p className="text-gray-700 leading-relaxed">
                Drop your CSV file and we handle the rest. No data cleaning, no format conversion, no technical setup. 
                Your files are encrypted with bank-level security and never shared with anyone.
              </p>
              <ul className="mt-4 space-y-2 text-sm text-gray-600">
                <li className="flex items-center space-x-2">
                  <svg className="h-4 w-4 text-green-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>End-to-end encryption</span>
                </li>
                <li className="flex items-center space-x-2">
                  <svg className="h-4 w-4 text-green-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Azure AD B2C authentication</span>
                </li>
                <li className="flex items-center space-x-2">
                  <svg className="h-4 w-4 text-green-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>GDPR compliant storage</span>
                </li>
              </ul>
            </div>

            {/* Feature 2: AI Conversations */}
            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-2xl p-6 sm:p-8 hover:shadow-lg transition-shadow">
              <div className="h-12 w-12 bg-green-600 rounded-xl flex items-center justify-center mb-6">
                <svg className="h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Ask Questions Like You're Talking to a Colleague</h3>
              <p className="text-gray-700 leading-relaxed">
                "Which customers bought the most last quarter?" "Are there any weird outliers in my sales data?" 
                "What's the correlation between marketing spend and revenue?" TaktMate understands context and gives you 
                answers that actually make sense.
              </p>
              <ul className="mt-4 space-y-2 text-sm text-gray-600">
                <li className="flex items-center space-x-2">
                  <svg className="h-4 w-4 text-green-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Understands business language, not just tech jargon</span>
                </li>
                <li className="flex items-center space-x-2">
                  <svg className="h-4 w-4 text-green-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Remembers your conversation for follow-up questions</span>
                </li>
                <li className="flex items-center space-x-2">
                  <svg className="h-4 w-4 text-green-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Explains the "why" behind every insight</span>
                </li>
              </ul>
            </div>

            {/* Feature 3: Instant Insights */}
            <div className="sm:col-span-2 lg:col-span-1 bg-gradient-to-br from-purple-50 to-purple-100 rounded-2xl p-6 sm:p-8 hover:shadow-lg transition-shadow">
              <div className="h-12 w-12 bg-purple-600 rounded-xl flex items-center justify-center mb-6">
                <svg className="h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Discover Insights You Never Knew Existed</h3>
              <p className="text-gray-700 leading-relaxed">
                TaktMate doesn't just answer your questions — it spots the patterns you missed. Find hidden trends, 
                identify your best opportunities, and catch problems before they become expensive mistakes. 
                It's like having a data scientist who never sleeps.
              </p>
              <ul className="mt-4 space-y-2 text-sm text-gray-600">
                <li className="flex items-center space-x-2">
                  <svg className="h-4 w-4 text-green-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Spots trends and anomalies automatically</span>
                </li>
                <li className="flex items-center space-x-2">
                  <svg className="h-4 w-4 text-green-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Suggests questions you should be asking</span>
                </li>
                <li className="flex items-center space-x-2">
                  <svg className="h-4 w-4 text-green-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Explains complex relationships in simple terms</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Mid-Page CTA Section */}
      <section className="py-16 bg-gradient-to-r from-blue-600 to-purple-600">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Ready to Try TaktMate?
          </h2>
          <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
            Join thousands of professionals who've already discovered the power of conversational data analysis.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-6">
            <LoginButton 
              variant="primary" 
              size="lg" 
              className="bg-white text-blue-600 hover:bg-gray-50 px-8 py-4 text-lg font-bold shadow-xl hover:shadow-2xl transform hover:-translate-y-1 transition-all duration-200"
            >
              Start Your Free Trial
            </LoginButton>
            <button className="text-white hover:text-blue-100 font-semibold px-6 py-3 border-2 border-white/30 hover:border-white/50 rounded-lg transition-all duration-200 flex items-center space-x-2">
              <span>Existing User? Sign In</span>
              <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </button>
          </div>
          <p className="text-blue-200 text-sm mt-4">
            Free 14-day trial • No credit card required • Cancel anytime
          </p>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              From Spreadsheet Confusion to Clear Answers in Minutes
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              No training required. No complex setup. Just upload your CSV and start getting the insights 
              you need to make better decisions.
            </p>
          </div>
          
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 mb-12 sm:mb-16">
            {/* Step 1 */}
            <div className="sm:col-span-2 lg:col-span-1 bg-white rounded-2xl p-6 sm:p-8 shadow-lg hover:shadow-xl transition-shadow">
              <div className="text-center">
                <div className="relative mb-6">
                  <div className="h-16 w-16 sm:h-20 sm:w-20 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                    <span className="text-xl sm:text-2xl font-bold text-white">1</span>
                  </div>
                  <div className="absolute top-8 sm:top-10 left-1/2 transform translate-x-10 sm:translate-x-12 hidden lg:block">
                    <svg className="h-6 w-16 text-blue-300" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                  </div>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">Drop Your File & Relax</h3>
                <p className="text-gray-600 mb-4">
                  Drag and drop any CSV file up to 5MB. We automatically understand your column headers, 
                  data types, and structure. No formatting required — messy data welcome.
                </p>
                <div className="bg-blue-50 rounded-lg p-3">
                  <h4 className="font-semibold text-blue-900 text-sm mb-2">✨ Key Benefits:</h4>
                  <ul className="text-sm text-blue-800 space-y-1">
                    <li>• Works with any CSV format</li>
                    <li>• Handles missing data gracefully</li>
                    <li>• Instant data validation</li>
                    <li>• Bank-level security</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Step 2 */}
            <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-lg hover:shadow-xl transition-shadow">
              <div className="text-center">
                <div className="relative mb-6">
                  <div className="h-16 w-16 sm:h-20 sm:w-20 bg-gradient-to-r from-green-500 to-green-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                    <span className="text-xl sm:text-2xl font-bold text-white">2</span>
                  </div>
                  <div className="absolute top-8 sm:top-10 left-1/2 transform translate-x-10 sm:translate-x-12 hidden lg:block">
                    <svg className="h-6 w-16 text-green-300" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                  </div>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">Ask Like You're Talking to a Human</h3>
                <p className="text-gray-600 mb-4">
                  "Show me my best customers" or "What happened to sales in March?" TaktMate understands 
                  context, follows up on previous questions, and asks clarifying questions when needed.
                </p>
                <div className="bg-green-50 rounded-lg p-3">
                  <h4 className="font-semibold text-green-900 text-sm mb-2">🧠 Smart Features:</h4>
                  <ul className="text-sm text-green-800 space-y-1">
                    <li>• Remembers conversation context</li>
                    <li>• Suggests follow-up questions</li>
                    <li>• Understands business terminology</li>
                    <li>• Powered by GPT-4</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Step 3 */}
            <div className="sm:col-span-2 lg:col-span-1 bg-white rounded-2xl p-6 sm:p-8 shadow-lg hover:shadow-xl transition-shadow">
              <div className="text-center">
                <div className="mb-6">
                  <div className="h-16 w-16 sm:h-20 sm:w-20 bg-gradient-to-r from-purple-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                    <span className="text-xl sm:text-2xl font-bold text-white">3</span>
                  </div>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">Get Answers That Make Sense</h3>
                <p className="text-gray-600 mb-4">
                  No confusing charts or technical jargon. Get clear explanations, specific recommendations, 
                  and the context you need to take action. Plus suggestions for what to explore next.
                </p>
                <div className="bg-purple-50 rounded-lg p-3">
                  <h4 className="font-semibold text-purple-900 text-sm mb-2">🎯 Results You Get:</h4>
                  <ul className="text-sm text-purple-800 space-y-1">
                    <li>• Plain English explanations</li>
                    <li>• Actionable recommendations</li>
                    <li>• Statistical insights</li>
                    <li>• Export-ready summaries</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Real-World Examples */}
          <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-lg mb-12 sm:mb-16">
            <div className="text-center mb-6 sm:mb-8">
              <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4">See TaktMate in Action</h3>
              <p className="text-sm sm:text-base text-gray-600">Real questions from real users and the insights they discovered</p>
            </div>
            
            <div className="grid sm:grid-cols-2 gap-4 sm:gap-6 lg:gap-8">
              {/* Example 1 */}
              <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-xl p-4 sm:p-6">
                <div className="flex items-start space-x-3 sm:space-x-4">
                  <div className="flex-shrink-0">
                    <div className="h-8 w-8 sm:h-10 sm:w-10 bg-blue-600 rounded-full flex items-center justify-center">
                      <span className="text-white font-bold text-sm sm:text-base">Q</span>
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-blue-900 font-medium mb-2 text-sm sm:text-base">
                      "Which products are my top performers this quarter?"
                    </p>
                    <div className="bg-white rounded-lg p-3 shadow-sm">
                      <p className="text-gray-700 text-xs sm:text-sm mb-2">
                        <strong>TaktMate found:</strong> Your top 3 products generated 67% of revenue. 
                        "Premium Widget Pro" alone accounts for 34% of total sales, with a 23% increase 
                        from last quarter.
                      </p>
                      <p className="text-blue-600 text-xs font-medium">
                        💡 Recommendation: Focus marketing budget on similar premium products
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Example 2 */}
              <div className="bg-gradient-to-r from-green-50 to-green-100 rounded-xl p-4 sm:p-6">
                <div className="flex items-start space-x-3 sm:space-x-4">
                  <div className="flex-shrink-0">
                    <div className="h-8 w-8 sm:h-10 sm:w-10 bg-green-600 rounded-full flex items-center justify-center">
                      <span className="text-white font-bold text-sm sm:text-base">Q</span>
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-green-900 font-medium mb-2 text-sm sm:text-base">
                      "Are there any unusual patterns in my customer data?"
                    </p>
                    <div className="bg-white rounded-lg p-3 shadow-sm">
                      <p className="text-gray-700 text-xs sm:text-sm mb-2">
                        <strong>TaktMate discovered:</strong> 15% of customers make purchases exclusively 
                        on weekends, spending 40% more per transaction. Also found 3 potential data 
                        entry errors in the "Region" column.
                      </p>
                      <p className="text-green-600 text-xs font-medium">
                        💡 Insight: Weekend shoppers are your highest-value segment
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Example 3 */}
              <div className="bg-gradient-to-r from-purple-50 to-purple-100 rounded-xl p-6">
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0">
                    <div className="h-10 w-10 bg-purple-600 rounded-full flex items-center justify-center">
                      <span className="text-white font-bold">Q</span>
                    </div>
                  </div>
                  <div className="flex-1">
                    <p className="text-purple-900 font-medium mb-2">
                      "What's the correlation between marketing spend and sales?"
                    </p>
                    <div className="bg-white rounded-lg p-3 shadow-sm">
                      <p className="text-gray-700 text-sm mb-2">
                        <strong>TaktMate calculated:</strong> Strong correlation (0.78) between digital 
                        ad spend and sales, but diminishing returns after $5K/month. Email marketing 
                        shows highest ROI at 4.2x.
                      </p>
                      <p className="text-purple-600 text-xs font-medium">
                        💡 Strategy: Reallocate budget from high-spend digital to email campaigns
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Example 4 */}
              <div className="bg-gradient-to-r from-orange-50 to-orange-100 rounded-xl p-6">
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0">
                    <div className="h-10 w-10 bg-orange-600 rounded-full flex items-center justify-center">
                      <span className="text-white font-bold">Q</span>
                    </div>
                  </div>
                  <div className="flex-1">
                    <p className="text-orange-900 font-medium mb-2">
                      "Can you predict next month's sales based on current trends?"
                    </p>
                    <div className="bg-white rounded-lg p-3 shadow-sm">
                      <p className="text-gray-700 text-sm mb-2">
                        <strong>TaktMate projected:</strong> Based on 6-month trend analysis, next 
                        month's sales likely $127K-$142K (confidence: 85%). Growth rate slowing 
                        but still positive at 3.2%.
                      </p>
                      <p className="text-orange-600 text-xs font-medium">
                        💡 Planning: Prepare inventory for $135K target, monitor weekly performance
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Time Comparison */}
          <div className="bg-gradient-to-r from-gray-800 to-gray-900 rounded-2xl p-8 text-white">
            <div className="text-center mb-8">
              <h3 className="text-2xl font-bold mb-4">The Old Way vs. The TaktMate Way</h3>
              <p className="text-gray-300">See how TaktMate transforms your data analysis workflow</p>
            </div>
            
            <div className="grid md:grid-cols-2 gap-8">
              {/* Old Way */}
              <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-6">
                <h4 className="text-red-300 font-bold mb-4 flex items-center">
                  😤 The Traditional Approach
                </h4>
                <ul className="space-y-3 text-gray-300">
                  <li className="flex items-start space-x-3">
                    <span className="text-red-400 font-bold">⏰</span>
                    <span><strong>2-3 hours:</strong> Clean and format your data</span>
                  </li>
                  <li className="flex items-start space-x-3">
                    <span className="text-red-400 font-bold">📊</span>
                    <span><strong>1-2 hours:</strong> Create pivot tables and formulas</span>
                  </li>
                  <li className="flex items-start space-x-3">
                    <span className="text-red-400 font-bold">🤔</span>
                    <span><strong>30+ minutes:</strong> Interpret confusing results</span>
                  </li>
                  <li className="flex items-start space-x-3">
                    <span className="text-red-400 font-bold">❌</span>
                    <span><strong>High risk:</strong> Manual errors and missed insights</span>
                  </li>
                </ul>
                <div className="mt-4 text-center">
                  <span className="bg-red-500 text-white px-4 py-2 rounded-full text-lg font-bold">
                    Total: 4-6 hours
                  </span>
                </div>
              </div>

              {/* TaktMate Way */}
              <div className="bg-green-900/20 border border-green-500/30 rounded-xl p-6">
                <h4 className="text-green-300 font-bold mb-4 flex items-center">
                  🚀 The TaktMate Way
                </h4>
                <ul className="space-y-3 text-gray-300">
                  <li className="flex items-start space-x-3">
                    <span className="text-green-400 font-bold">⚡</span>
                    <span><strong>30 seconds:</strong> Upload your messy CSV file</span>
                  </li>
                  <li className="flex items-start space-x-3">
                    <span className="text-green-400 font-bold">💬</span>
                    <span><strong>2-3 minutes:</strong> Ask questions in plain English</span>
                  </li>
                  <li className="flex items-start space-x-3">
                    <span className="text-green-400 font-bold">🎯</span>
                    <span><strong>Instant:</strong> Get clear, actionable insights</span>
                  </li>
                  <li className="flex items-start space-x-3">
                    <span className="text-green-400 font-bold">✅</span>
                    <span><strong>AI-powered:</strong> Discover hidden patterns automatically</span>
                  </li>
                </ul>
                <div className="mt-4 text-center">
                  <span className="bg-green-500 text-white px-4 py-2 rounded-full text-lg font-bold">
                    Total: 5 minutes
                  </span>
                </div>
              </div>
            </div>
            
            <div className="text-center mt-8">
              <div className="bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl p-4 inline-block">
                <p className="text-xl font-bold">
                  ⚡ TaktMate is <span className="text-yellow-300">48-72x faster</span> than traditional methods
                </p>
                <p className="text-blue-100 text-sm mt-1">
                  Spend your time making decisions, not wrestling with spreadsheets
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof / Benefits Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Finally, Data Analysis That Doesn't Require a PhD
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              We built TaktMate for busy professionals who need answers, not another tool to learn. 
              Get enterprise-grade insights without the enterprise-grade complexity.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {/* Benefit 1 */}
            <div className="text-center">
              <div className="h-16 w-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg className="h-8 w-8 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 0h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Your Data Stays Yours</h3>
              <p className="text-gray-600 text-sm">
                Military-grade encryption, zero data sharing, and GDPR compliance. We never see your actual data — only you do.
              </p>
            </div>

            {/* Benefit 2 */}
            <div className="text-center">
              <div className="h-16 w-16 bg-gradient-to-br from-green-500 to-green-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg className="h-8 w-8 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Answers in Seconds, Not Hours</h3>
              <p className="text-gray-600 text-sm">
                No waiting for reports to run. Ask a question, get an answer immediately. Powered by GPT-4 and optimized for speed.
              </p>
            </div>

            {/* Benefit 3 */}
            <div className="text-center">
              <div className="h-16 w-16 bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg className="h-8 w-8 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Smarter Than Spreadsheets</h3>
              <p className="text-gray-600 text-sm">
                TaktMate sees connections you miss, asks follow-up questions you forget, and explains results in plain English.
              </p>
            </div>

            {/* Benefit 4 */}
            <div className="text-center">
              <div className="h-16 w-16 bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg className="h-8 w-8 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Zero Learning Curve</h3>
              <p className="text-gray-600 text-sm">
                If you can text a friend, you can use TaktMate. No training, no manuals, no "getting started" tutorials.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-20 bg-gradient-to-r from-blue-600 to-purple-600">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-6">
            Stop Guessing. Start Knowing.
          </h2>
          <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
            Your data has the answers you need to make better decisions. TaktMate helps you find them — 
            without the headache of complex analytics tools or expensive consultants.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-6">
            <LoginButton 
              variant="primary" 
              size="lg" 
              className="bg-white text-blue-600 hover:bg-gray-50 px-12 py-5 text-xl font-bold shadow-2xl hover:shadow-3xl transform hover:-translate-y-1 transition-all duration-200"
            >
              🎯 Start Free Trial Now
            </LoginButton>
            <button className="text-white hover:text-blue-100 font-semibold px-6 py-3 border-2 border-white/30 hover:border-white/50 rounded-lg transition-all duration-200 flex items-center space-x-2">
              <span>Existing Customer? Sign In</span>
              <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </button>
          </div>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-sm text-blue-200">
            <div className="flex items-center space-x-1">
              <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>14-day free trial</span>
            </div>
            <div className="flex items-center space-x-1">
              <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>No credit card required</span>
            </div>
            <div className="flex items-center space-x-1">
              <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>Cancel anytime</span>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8">
            {/* Company Info */}
            <div className="col-span-1">
              <div className="flex items-center space-x-3 mb-4">
                <div className="h-8 w-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">T</span>
                </div>
                <span className="text-xl font-bold">TaktMate</span>
              </div>
              <p className="text-gray-400 text-sm">
                Transforming CSV data into actionable insights with AI-powered conversations.
              </p>
            </div>

            {/* Product Links */}
            <div>
              <h3 className="font-semibold mb-4">Product</h3>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><a href="#" className="hover:text-white">Features</a></li>
                <li><a href="#" className="hover:text-white">Security</a></li>
                <li><a href="#" className="hover:text-white">Pricing</a></li>
                <li><a href="#" className="hover:text-white">API</a></li>
              </ul>
            </div>

            {/* Support Links */}
            <div>
              <h3 className="font-semibold mb-4">Support</h3>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><a href="#" className="hover:text-white">Documentation</a></li>
                <li><a href="#" className="hover:text-white">Help Center</a></li>
                <li><a href="#" className="hover:text-white">Contact Us</a></li>
                <li><a href="#" className="hover:text-white">Status</a></li>
              </ul>
            </div>

            {/* Legal Links */}
            <div>
              <h3 className="font-semibold mb-4">Legal</h3>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><a href="#" className="hover:text-white">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-white">Terms of Service</a></li>
                <li><a href="#" className="hover:text-white">GDPR</a></li>
                <li><a href="#" className="hover:text-white">Cookies</a></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-gray-800 mt-8 pt-8 text-center">
            <p className="text-gray-400 text-sm">
              © 2024 TaktMate. All rights reserved. Powered by Azure AD B2C and OpenAI GPT-4.
            </p>
          </div>
        </div>
      </footer>

      {/* Floating CTA - appears when scrolling */}
      {showFloatingCTA && (
        <div className="fixed bottom-4 sm:bottom-6 right-4 sm:right-6 left-4 sm:left-auto z-50 transform transition-all duration-300 ease-out animate-bounce">
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl shadow-2xl p-3 sm:p-4 max-w-sm mx-auto sm:mx-0">
            <div className="flex items-center space-x-3 sm:space-x-4">
              <div className="flex-1 min-w-0">
                <h3 className="text-white font-bold text-xs sm:text-sm mb-1">Ready to start?</h3>
                <p className="text-blue-100 text-xs">Free trial • No setup required</p>
              </div>
              <div className="flex flex-col space-y-1 sm:space-y-2">
                <LoginButton 
                  variant="primary" 
                  size="sm" 
                  className="bg-white text-blue-600 hover:bg-gray-50 px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-bold shadow-lg whitespace-nowrap"
                >
                  <span className="hidden sm:inline">Start Free Trial</span>
                  <span className="sm:hidden">Start Trial</span>
                </LoginButton>
                <button className="text-white hover:text-blue-100 text-xs underline">
                  Sign In
                </button>
              </div>
              <button 
                onClick={() => setShowFloatingCTA(false)}
                className="text-white/70 hover:text-white flex-shrink-0"
              >
                <svg className="h-3 w-3 sm:h-4 sm:w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </>
  );
};

export default LandingPage;
