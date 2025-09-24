# 🔹 Suggested Questions Feature Implementation Checklist

## Overview
Add starter question suggestions when users begin new conversations with uploaded documents. This feature helps users discover relevant questions to ask about their data while keeping the implementation simple and maintainable.

## 📋 Implementation Tasks

### Phase 1: Backend Prompt Refactoring
- [x] **1.1 Create Prompts Folder Structure**
  - [x] Create `backend/prompts/` directory
  - [x] Add `.gitkeep` file to ensure folder is tracked

- [x] **1.2 Extract Existing Prompt**
  - [x] Create `backend/prompts/normalPrompt.js`
  - [x] Move existing conversation prompt from `index.js` (lines ~271-282)
  - [x] Export as function: `module.exports.normalPrompt = (fileContent, conversationMessages) => { ... }`
  - [x] Update `index.js` to import and use `normalPrompt`
  - [x] Test existing chat functionality to ensure no regression

- [x] **1.3 Create Suggestion Prompt**
  - [x] Create `backend/prompts/suggestionPrompt.js`
  - [x] Implement prompt template that analyzes file content and generates 2 questions:
    - One exploratory/open-ended question
    - One specific/data-driven question
  - [x] Return structured JSON response with suggestions array
  - [x] Handle different file types (CSV, PDF, DOCX, XLSX, TXT) appropriately

### Phase 2: Backend API Enhancement
- [x] **2.1 Update Conversation Creation**
  - [x] Modify `backend/routes/conversations.js` POST `/api/conversations` endpoint
  - [x] Add logic to generate suggestions when creating new conversation
  - [x] Call GPT with `suggestionPrompt` using file content
  - [x] Parse JSON response and add `suggestions` array to conversation object
  - [x] Handle errors gracefully (fallback to empty suggestions array)

- [ ] **2.2 Add Suggestions to Existing Endpoints**
  - [ ] Update `cosmosService.createConversation()` to accept suggestions parameter
  - [ ] Modify conversation schema to include `suggestions` field
  - [ ] Update GET `/api/conversations/:id` to return suggestions for new conversations
  - [ ] Ensure suggestions are only generated once per conversation

- [ ] **2.3 Update Chat Endpoint**
  - [ ] Modify `/api/chat` endpoint to clear suggestions after first user message
  - [ ] Update conversation record to remove suggestions once used
  - [ ] Maintain backward compatibility with existing conversations

### Phase 3: Frontend UI Implementation
- [ ] **3.1 Update ChatBox Component**
  - [ ] Modify `frontend/src/components/ChatBox.jsx`
  - [ ] Add state for managing suggestions: `const [suggestions, setSuggestions] = useState([])`
  - [ ] Load suggestions when conversation is loaded
  - [ ] Create suggestion buttons UI component
  - [ ] Style buttons to match existing design system

- [ ] **3.2 Implement Suggestion Interaction**
  - [ ] Add click handlers for suggestion buttons
  - [ ] Submit selected suggestion as first message
  - [ ] Hide suggestion buttons after first message is sent
  - [ ] Add loading states during suggestion generation
  - [ ] Handle cases where suggestion generation fails

- [ ] **3.3 UI/UX Polish**
  - [ ] Add subtle animation for suggestion appearance
  - [ ] Ensure suggestions are visually distinct from regular messages
  - [ ] Add helpful text like "Try asking:" or "Suggested questions:"
  - [ ] Responsive design for mobile devices
  - [ ] Accessibility considerations (keyboard navigation, screen readers)

### Phase 4: Integration & Testing
- [ ] **4.1 File Type Integration**
  - [ ] Test suggestions with CSV files (use headers and sample data)
  - [ ] Test suggestions with PDF files (use document summary)
  - [ ] Test suggestions with DOCX files (use text content preview)
  - [ ] Test suggestions with XLSX files (use sheet names and data preview)
  - [ ] Test suggestions with TXT files (use content summary)

- [ ] **4.2 Error Handling**
  - [ ] Handle GPT API failures gracefully
  - [ ] Provide fallback suggestions for common scenarios
  - [ ] Log errors for monitoring without breaking user experience
  - [ ] Test with malformed or empty files

- [ ] **4.3 Performance Optimization**
  - [ ] Implement caching for similar files (optional)
  - [ ] Add timeout handling for suggestion generation
  - [ ] Optimize prompt length to stay within token limits
  - [ ] Monitor suggestion generation latency

### Phase 5: Quality Assurance
- [ ] **5.1 Functional Testing**
  - [ ] Test new conversation creation with suggestions
  - [ ] Test suggestion button interactions
  - [ ] Test conversation flow after using suggestions
  - [ ] Test with various file sizes and types
  - [ ] Verify existing functionality remains unaffected

- [ ] **5.2 User Experience Testing**
  - [ ] Verify suggestions are relevant and helpful
  - [ ] Test loading states and error conditions
  - [ ] Ensure smooth transition from suggestions to normal chat
  - [ ] Test on different screen sizes and devices

- [ ] **5.3 Edge Case Testing**
  - [ ] Empty or corrupted files
  - [ ] Very large files that might exceed token limits
  - [ ] Network failures during suggestion generation
  - [ ] Multiple rapid conversation creations

## 📁 File Changes Required

### New Files
```
backend/prompts/
├── normalPrompt.js          # Extracted existing prompt
└── suggestionPrompt.js      # New suggestion generation prompt
```

### Modified Files
```
backend/
├── index.js                 # Import and use normalPrompt
├── routes/conversations.js  # Add suggestion generation
└── services/cosmos.js       # Update conversation schema

frontend/src/components/
└── ChatBox.jsx             # Add suggestion UI and logic
```

## 🎯 Success Criteria

### Functional Requirements
- [ ] New conversations display 2 relevant suggested questions
- [ ] Suggestions disappear after first user message
- [ ] Suggestions work for all supported file types
- [ ] Existing chat functionality remains unchanged
- [ ] Error states are handled gracefully

### Technical Requirements
- [ ] Prompts are properly separated from business logic
- [ ] Code follows existing patterns and conventions
- [ ] No performance degradation in existing features
- [ ] Proper error logging and monitoring
- [ ] Backward compatibility maintained

### User Experience Requirements
- [ ] Suggestions are contextually relevant to uploaded content
- [ ] UI is intuitive and matches existing design
- [ ] Loading states provide clear feedback
- [ ] Feature enhances rather than clutters the interface

## 🔧 Implementation Notes

### Prompt Design Guidelines
- Keep suggestion prompts concise to minimize token usage
- Focus on generating actionable, specific questions
- Ensure questions work well with the existing chat system
- Consider file type when generating suggestions

### UI Design Principles
- Use existing TailwindCSS classes for consistency
- Match the current card-based design system
- Ensure suggestions are clearly differentiated from messages
- Provide visual feedback for user interactions

### Error Handling Strategy
- Fail gracefully without breaking conversation creation
- Log errors for debugging but don't expose technical details to users
- Provide helpful fallback messages when suggestions fail
- Maintain full functionality even when suggestion service is unavailable

## 📊 Testing Strategy

### Unit Tests (Optional)
- Test prompt generation functions
- Test suggestion parsing and validation
- Test UI component rendering with/without suggestions

### Integration Tests
- Test full conversation creation flow with suggestions
- Test suggestion interaction and message sending
- Test error scenarios and fallback behavior

### Manual Testing Checklist
- [ ] Upload different file types and verify relevant suggestions
- [ ] Click suggestions and verify they send as messages
- [ ] Create multiple conversations and verify suggestions are unique
- [ ] Test with poor network conditions
- [ ] Test with various file sizes and content types

## 🚀 Deployment Plan

### Development Phase
1. Implement backend prompt refactoring first
2. Add suggestion generation to conversation creation
3. Implement frontend UI components
4. Test integration thoroughly
5. Polish UI/UX details

### Staging Deployment
- Deploy to staging environment
- Run comprehensive testing
- Gather internal feedback
- Performance monitoring

### Production Rollout
- Deploy during low-traffic period
- Monitor error rates and performance
- Collect user feedback
- Iterate based on usage patterns

## 📈 Future Enhancements (Out of Scope)

- Dynamic suggestion regeneration based on conversation context
- User feedback on suggestion quality
- Personalized suggestions based on user history
- Integration with conversation export features
- A/B testing different suggestion algorithms

---

**Estimated Implementation Time:** 8-12 hours
**Priority:** Medium
**Risk Level:** Low (non-breaking feature addition)
