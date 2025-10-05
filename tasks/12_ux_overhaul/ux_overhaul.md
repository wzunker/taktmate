# TaktMate UX Workflow Documentation

**Date:** October 4, 2025

---

## Overview

TaktMate is a file-based AI chat application. Users upload documents (CSV, PDF, DOCX, XLSX, TXT), select files, and chat with an AI assistant about the content. Files can be added or removed dynamically during conversations.

**Limits:**
- 50 files max per user
- 50 files max per conversation (selectable at once)
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

1. User authenticated → App starts in "new conversation mode"
2. ChatBox shows prompt: "select at least one file to get started"
3. User clicks "upload files" → Modal opens → Selects file → Uploads to Azure
4. Files immediately appear in SourcesPanel with checkboxes
5. User selects 1+ files (up to 50) → Chat interface appears with input field
6. User clicks/focuses on the message input field (activation signal)
7. Loading state appears: "Preparing your conversation" with spinner
8. Backend creates temporary conversation + generates 2 AI suggested questions
9. ChatBox manages conversation internally (parent doesn't know about it yet)
10. Suggested questions appear as clickable cards
11. **If user changes file selection:** Suggestions clear, temporary conversation discarded, can click input to regenerate
12. **If user deselects all files:** Returns to "select at least one file" placeholder
13. User clicks suggestion or types own message (FIRST actual message)
14. AI responds with file context
15. **Conversation NOW appears in history panel** (parent notified, added to list)
16. Parent exits new conversation mode
17. User can add/remove files at any time during the conversation

### Flow 2: Resume Existing Conversation

1. User clicks conversation from ConversationsPanel
2. Backend loads conversation with message history
3. ChatBox displays previous messages
4. SourcesPanel shows all uploaded files, with conversation files indicated/selected
5. User can continue chatting normally, even if original files are missing
6. User can add/remove files to change conversation context
7. **If original files deleted:** "MISSING" badges shown alongside available files, but conversation remains functional

---

## Application States

### SourcesPanel States
- **Always visible:** All uploaded files are always shown with checkboxes
- **No files uploaded:** Empty message "No files uploaded yet"
- **New conversation mode:** All files available for selection (max 50 selectable)
- **Active conversation:** All files visible and selectable - users can add/remove files dynamically
- **Missing files:** Files marked with red "MISSING" badge shown alongside existing files (cannot be selected)

### ChatBox States
- **Initial state (new conversation mode):** "Select at least one file to get started"
- **New conversation (files selected):** Chat interface with input field visible
- **Input activated:** Loading state with spinner and "Preparing your conversation" message
- **Suggestions shown (pre-conversation):** 2 clickable AI-generated question cards, not yet in history
- **File selection changed:** Suggestions cleared, conversation discarded, can click input to regenerate
- **All files deselected:** Returns to initial state placeholder
- **Active conversation (after first message):** Message history + enabled input, appears in conversations panel

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