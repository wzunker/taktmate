# TaktMate UX Workflow Documentation

**Date:** October 4, 2025

---

## Overview

TaktMate is a file-based AI chat application. Users upload documents (CSV, PDF, DOCX, XLSX, TXT), select 1-5 files, and chat with an AI assistant about the content.

**Limits:**
- 50 files max per user
- 5GB total storage
- 100MB per file
- 90-day auto-deletion

---

## Architecture

**Frontend (React):**
- Three panels: SourcesPanel (files) | ChatBox (chat) | ConversationsPanel (history)
- Main orchestration: `App.jsx`

**Backend (Node.js/Express):**
- `/api/files` - Upload/download/delete
- `/api/conversations` - CRUD operations
- `/api/chat` - AI chat endpoint
- Storage: Azure Blob Storage (files) + Cosmos DB (conversations)
- AI: Azure OpenAI GPT-4.1

---

## Core User Flows

### Flow 1: New User First Chat

1. User authenticated → Empty state shown
2. Clicks "upload files" → Modal opens → Selects file → Uploads to Azure
3. Clicks "new conversation" → Enters "new conversation mode"
4. SourcesPanel shows all files with checkboxes
5. Selects 1-5 files → Clicks "Start" button
6. Backend creates conversation + generates 2 AI suggested questions
7. Suggested questions appear in ChatBox as clickable cards
8. User clicks suggestion or types own message
9. AI responds with file context
10. Conversation auto-saves to history

### Flow 2: Resume Existing Conversation

1. User clicks conversation from ConversationsPanel
2. Backend loads conversation with message history
3. ChatBox displays previous messages
4. SourcesPanel shows only files from that conversation
5. **If files exist:** Normal chat continues, file selection locked
6. **If files deleted:** Read-only mode, input disabled, "MISSING" badges shown

### Flow 3: Multi-File Chat

1. New conversation mode → Selects 2-5 files → Clicks "Start"
2. Backend parses all files, generates cross-file suggestions
3. Suggestions like: "Compare sales trends between 2023 and 2024"
4. AI responses cite specific files: "From sales_2023.csv: ..."
5. User can ask questions spanning multiple files

---

## Application States

### SourcesPanel States
- **Initial:** Empty message "click 'new conversation' to select files"
- **New conversation mode:** All files shown with checkboxes (max 5 selectable)
- **Active conversation:** Only associated files shown, selection locked
- **Missing files:** Files marked with red "MISSING" badge

### ChatBox States
- **No files selected:** Placeholder with feature icons
- **New conversation (pre-start):** "Select 1-5 files to start" + Start button
- **Suggestions shown:** 2 clickable AI-generated questions
- **Active conversation:** Message history + enabled input
- **Read-only (missing files):** History visible, input disabled

---

## Key Technical Details

### File Upload Flow
1. Frontend validates file (type, size, count)
2. Requests SAS token: `POST /api/files/sas`
3. Backend validates + checks quota + generates 10-min SAS URL
4. Frontend uploads directly to Azure Blob Storage
5. File appears immediately (optimistic update)

### Chat Message Flow
1. User sends message → Immediately shown in UI
2. `POST /api/chat` with message + conversationId + fileNames
3. Backend: Load files from blob → Parse by type → Format for GPT
4. Retrieve recent message history for context
5. Call GPT-4.1 with file content + history + new message
6. Save both messages to Cosmos DB
7. Return AI response → Display in UI

### Conversation Storage
```json
{
  "id": "conv_123",
  "userId": "user-guid",
  "title": "Conversation about sales.csv",
  "fileNames": ["sales.csv", "inventory.xlsx"],
  "messages": [{role: "user", content: "...", timestamp: "..."}],
  "suggestions": ["Question 1", "Question 2"],
  "messageCount": 8,
  "status": "active",
  "ttl": 7776000  // 90 days
}
```

### State Management
**App.jsx holds:**
- `uploadedFiles` - All user files
- `selectedFileIds` - Currently selected files
- `conversations` - All conversations
- `activeConversationId` - Current conversation
- `isInNewConversationMode` - New conversation flow flag

**Props flow down to panels, callbacks flow up to App**