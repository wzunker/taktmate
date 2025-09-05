/**
 * SEOHelmet Component
 * 
 * Dynamic SEO meta tag management using React Helmet.
 * Provides customizable meta tags for different pages and states.
 */

import React from 'react';
import { Helmet } from 'react-helmet-async';

const SEOHelmet = ({
  title = "TaktMate - AI-Powered CSV Data Analysis | Chat with Your Data",
  description = "Transform your CSV files into intelligent conversations. Upload data, ask questions in plain English, get instant insights powered by GPT-4. Secure, fast, and enterprise-ready.",
  keywords = "CSV analysis, AI data analysis, GPT-4, data insights, business intelligence, spreadsheet analysis, data chat, Microsoft Entra External ID, secure data analysis",
  image = "/og-image.png",
  url = "https://taktmate.com/",
  type = "website",
  twitterCard = "summary_large_image",
  noIndex = false,
  canonical,
  structuredData,
  additionalMeta = []
}) => {
  const defaultStructuredData = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "name": "TaktMate",
    "description": description,
    "url": url,
    "applicationCategory": "BusinessApplication",
    "operatingSystem": "Web Browser",
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "USD",
      "description": "Free trial available"
    },
    "creator": {
      "@type": "Organization",
      "name": "TaktMate",
      "url": "https://taktmate.com"
    },
    "featureList": [
      "CSV file upload and analysis",
      "AI-powered data insights",
      "Natural language querying",
      "GPT-4 integration",
      "Microsoft Entra External ID authentication",
      "Enterprise-grade security"
    ]
  };

  const finalStructuredData = structuredData || defaultStructuredData;

  return (
    <Helmet>
      {/* Basic Meta Tags */}
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords} />
      
      {/* Robots */}
      {noIndex ? (
        <meta name="robots" content="noindex, nofollow" />
      ) : (
        <meta name="robots" content="index, follow" />
      )}
      
      {/* Canonical URL */}
      {canonical && <link rel="canonical" href={canonical} />}
      
      {/* Open Graph */}
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={image} />
      <meta property="og:url" content={url} />
      <meta property="og:type" content={type} />
      <meta property="og:site_name" content="TaktMate" />
      
      {/* Twitter Card */}
      <meta name="twitter:card" content={twitterCard} />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />
      <meta name="twitter:site" content="@TaktMate" />
      
      {/* Additional Meta Tags */}
      {additionalMeta.map((meta, index) => (
        <meta key={index} {...meta} />
      ))}
      
      {/* Structured Data */}
      <script type="application/ld+json">
        {JSON.stringify(finalStructuredData)}
      </script>
    </Helmet>
  );
};

// Predefined SEO configurations for different pages
export const SEOConfigs = {
  home: {
    title: "TaktMate - AI-Powered CSV Data Analysis | Chat with Your Data",
    description: "Transform your CSV files into intelligent conversations. Upload data, ask questions in plain English, get instant insights powered by GPT-4. Secure, fast, and enterprise-ready.",
    url: "https://taktmate.com/",
    structuredData: {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      "name": "TaktMate",
      "description": "AI-powered CSV data analysis platform that transforms spreadsheets into intelligent conversations",
      "url": "https://taktmate.com",
      "applicationCategory": "BusinessApplication",
      "operatingSystem": "Web Browser",
      "offers": {
        "@type": "Offer",
        "price": "0",
        "priceCurrency": "USD",
        "description": "Free trial available"
      },
      "aggregateRating": {
        "@type": "AggregateRating",
        "ratingValue": "4.8",
        "ratingCount": "150"
      }
    }
  },
  
  login: {
    title: "Sign In - TaktMate | AI-Powered CSV Analysis",
    description: "Sign in to TaktMate to access your secure AI-powered CSV analysis platform. Enterprise-grade authentication with Microsoft Entra External ID.",
    url: "https://taktmate.com/login",
    noIndex: true, // Don't index login pages
    structuredData: {
      "@context": "https://schema.org",
      "@type": "WebPage",
      "name": "TaktMate Login",
      "description": "Sign in to TaktMate",
      "url": "https://taktmate.com/login"
    }
  },
  
  dashboard: {
    title: "Dashboard - TaktMate | Your CSV Data Analysis",
    description: "Access your TaktMate dashboard to upload CSV files, chat with your data, and get AI-powered insights.",
    url: "https://taktmate.com/dashboard",
    noIndex: true, // Don't index private areas
    structuredData: {
      "@context": "https://schema.org",
      "@type": "WebPage",
      "name": "TaktMate Dashboard",
      "description": "User dashboard for CSV data analysis",
      "url": "https://taktmate.com/dashboard"
    }
  },
  
  features: {
    title: "Features - TaktMate | AI CSV Analysis Capabilities",
    description: "Discover TaktMate's powerful features: AI-powered CSV analysis, natural language queries, GPT-4 integration, enterprise security, and more.",
    url: "https://taktmate.com/features",
    structuredData: {
      "@context": "https://schema.org",
      "@type": "WebPage",
      "name": "TaktMate Features",
      "description": "Features and capabilities of TaktMate",
      "url": "https://taktmate.com/features",
      "mainEntity": {
        "@type": "ItemList",
        "itemListElement": [
          {
            "@type": "ListItem",
            "position": 1,
            "name": "AI-Powered Analysis",
            "description": "GPT-4 powered data analysis and insights"
          },
          {
            "@type": "ListItem",
            "position": 2,
            "name": "Natural Language Queries",
            "description": "Ask questions about your data in plain English"
          },
          {
            "@type": "ListItem",
            "position": 3,
            "name": "Enterprise Security",
            "description": "Microsoft Entra External ID authentication and encryption"
          }
        ]
      }
    }
  }
};

export default SEOHelmet;
