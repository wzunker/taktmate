# UI/UX Workflow Overhaul - Three-Panel Layout Implementation

## Overview
This checklist implements a comprehensive UI/UX overhaul transitioning TaktMate from the current file-centric workflow to a project-based three-panel layout with enhanced onboarding and workflow guidance.

### Current State Analysis
- **Current Layout**: Sources Panel (left) + ChatBox (center) + DataTable (right)
- **Current Workflow**: File upload → File selection → Chat creation → Data preview
- **Current Issues**: No project organization, confusing onboarding, data preview conflicts with chat focus

### Target State Vision
- **New Layout**: Projects & Files (left) + Conversations (center) + ChatBox (right)
- **New Workflow**: Project creation/selection → File management → Conversation creation → Multi-file chat analysis
- **Key Improvements**: Project organization, guided onboarding, disabled data preview, multi-file conversation support

---

## 🎯 Phase 1: Core Infrastructure & Backend Updates

### 1.1 Project Management Backend
- [x] **Create Project API Endpoints**
  - [x] `POST /api/projects` - Create new project
  - [x] `GET /api/projects` - List user projects
  - [x] `GET /api/projects/:id` - Get specific project details
  - [x] `PUT /api/projects/:id` - Update project (rename)
  - [x] `DELETE /api/projects/:id` - Delete project and associated data
  - [x] `GET /api/projects/:id/files` - Get files in project
  - [x] `GET /api/projects/:id/conversations` - Get project conversations

- [x] **Update Database Schema (Cosmos DB)**
  - [x] Add `projects` container with partition key `/userId`
  - [x] Update `conversations` container to include `projectId` field
  - [x] Add `files` metadata container linking files to projects
  - [x] Create indexes for efficient project-based queries

- [x] **Update File Management**
  - [x] Modify file upload to require `projectId` parameter
  - [x] Update Azure Blob Storage structure: `users/{userId}/projects/{projectId}/files/`
  - [x] Update file deletion to handle project-based storage paths
  - [x] Add file-to-project association tracking

### 1.2 Enhanced Conversation Management
- [ ] **Multi-File Conversation Support**
  - [ ] Update conversation creation to accept multiple `fileIds`
  - [ ] Modify GPT prompt generation to handle multiple file contexts
  - [ ] Update conversation storage schema to track associated files array
  - [ ] Implement file validation (ensure all files exist before chat)

- [ ] **Conversation-Project Linking**
  - [ ] Add `projectId` field to conversation records
  - [ ] Update conversation queries to filter by project
  - [ ] Implement project-level conversation management

### 1.3 User State Management
- [ ] **Project Session State**
  - [ ] Track user's current active project in session/localStorage
  - [ ] Implement project switching with state preservation
  - [ ] Add project-level user preferences storage

---

## 🎨 Phase 2: Frontend Component Architecture

### 2.1 New Component Structure
- [ ] **Create ProjectPanel Component** (`components/ProjectPanel.jsx`)
  - [ ] Project list view with create/select functionality
  - [ ] File management within selected project
  - [ ] Project header (name)
  - [ ] Drag-and-drop file upload with project context

- [ ] **Create ConversationListPanel Component** (`components/ConversationListPanel.jsx`)
  - [ ] "Start New Conversation" prominent button
  - [ ] Conversation list with title, timestamp, file indicators
  - [ ] Empty state messaging and guidance
  - [ ] Conversation management actions (rename, delete)

- [ ] **Refactor ChatBox Component** (`components/ChatBox.jsx`)
  - [ ] Remove data preview functionality completely
  - [ ] Add multi-file context display
  - [ ] Implement file selection requirement before chat
  - [ ] Add disabled state with instructional messaging
  - [ ] Update prompt generation for multiple files

### 2.2 Layout Components
- [ ] **Create ThreePanelLayout Component** (`components/ThreePanelLayout.jsx`)
  - [ ] Responsive three-panel grid system
  - [ ] Panel width management and responsive breakpoints
  - [ ] Panel collapse/expand functionality

### 2.3 State Management Updates
- [ ] **Project Context Provider** (`contexts/ProjectContext.js`)
  - [ ] Current project state management
  - [ ] Project switching functionality
  - [ ] Project-level data caching
  - [ ] Project creation and deletion actions

- [ ] **Enhanced App State** (`App.jsx`)
  - [ ] Remove DataTable integration
  - [ ] Add project-level state management
  - [ ] Implement three-panel layout
  - [ ] Add onboarding state tracking

---

## 🚀 Phase 3: Three-Panel Layout Implementation

### 3.1 Left Panel: Projects & Files
- [ ] **Default State (No Project Selected)**
  - [ ] Display all user projects in a clean list
  - [ ] Prominent "Create New Project" button
  - [ ] Project cards with metadata (name, file count, last modified)

- [ ] **Project Selected State**
  - [ ] Project header with name and metadata
  - [ ] File upload area (drag-drop + button)
  - [ ] File list with status indicators (active/missing)
  - [ ] File management actions (download, delete)
  - [ ] Back to projects navigation

- [ ] **During Conversation State**
  - [ ] Lock panel to show only conversation's associated files
  - [ ] Display file status (linked to conversation)
  - [ ] Show "missing file" warnings with re-upload option
  - [ ] Disable file selection changes during active chat

### 3.2 Middle Panel: Conversations
- [ ] **Empty State**
  - [ ] Instructional message: "Select or create a project to get started"
  - [ ] Clear call-to-action messaging

- [ ] **Project Selected State**
  - [ ] Prominent "Start New Conversation" button
  - [ ] List of project conversations (title + timestamp)
  - [ ] Conversation actions (rename, delete)

- [ ] **Conversation Management**
  - [ ] Conversation selection and activation

### 3.3 Right Panel: ChatBox
- [ ] **Pre-Conversation State**
  - [ ] Instructional message: "Please select 1–5 files for analysis from the files panel"
  - [ ] File selection counter and validation
  - [ ] Disabled input with clear messaging
  - [ ] Visual indicators for required actions

- [ ] **Active Conversation State**
  - [ ] Standard chat interface with multi-file context
  - [ ] File indicator badges showing analyzed files
  - [ ] Enhanced message display with file references
  - [ ] Conversation-specific actions (rename and delete)

- [ ] **Missing Files State**
  - [ ] Read-only chat display
  - [ ] Prominent warning: "Conversation disabled because linked file(s) are missing"
  - [ ] Re-upload instructions and functionality
  - [ ] File restoration workflow