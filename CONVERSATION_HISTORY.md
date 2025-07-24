# Conversation History Implementation

This document describes the implementation of conversation history functionality in the Claude Code Bridge (CCB).

## Overview

The conversation history feature allows users to continue previous conversations with Claude Code, maintaining context across multiple invocations of the CLI. This implementation follows the workspace-based architecture of CCB, storing conversation history separately for each project directory.

## Key Components

### 1. Conversation History Storage

Conversation history is stored in the workspace's `.claude/conversations` directory as JSON files. Each conversation session is stored in a separate file named with the session ID.

#### Data Structures

- `ConversationMessage`: Represents a single message in a conversation
- `ConversationSession`: Represents a complete conversation session

#### Storage Functions

- `getConversationHistoryDir(cwd: string)`: Gets the conversation history directory for a workspace
- `saveConversationSession(cwd: string, session: ConversationSession)`: Saves a conversation session to disk
- `loadConversationSession(cwd: string, sessionId: string)`: Loads a conversation session from disk
- `listConversationSessions(cwd: string)`: Lists all conversation sessions for a workspace
- `createConversationSession(cwd: string, title: string)`: Creates a new conversation session
- `addMessageToSession(cwd: string, sessionId: string, message: ConversationMessage)`: Adds a message to a conversation session
- `clearConversationHistory(cwd: string)`: Clears all conversation history for a workspace
- `getLatestActiveSession(cwd: string)`: Gets the most recent active conversation session

### 2. CLI Commands

New CLI commands were added to manage conversation history:

- `continue`: Continues a previous conversation
- `history`: Shows conversation history
- `clear-history`: Clears conversation history

### 3. Middleware Integration

The middleware pipeline was updated to:
1. Load conversation history when continuing a session
2. Include previous messages in the request to the AI provider
3. Save the updated conversation after each response

### 4. Stream Processing

The stream processing module was updated to save conversation history after each response, handling both streaming and non-streaming responses.

## Implementation Details

### Directory Structure

```
workspace/
├── .claude/
│   ├── ccb-config.json
│   ├── ccb-service.json
│   ├── ccb-service.log
│   └── conversations/
│       ├── session1.json
│       ├── session2.json
│       └── ...
└── your-code-files...
```

### Session Management

Sessions are automatically created when starting a new conversation. The `continue` command will either continue the most recent active session or create a new one if none exists.

### Message Storage

Messages are stored with the following structure:
- Role (user, assistant, system)
- Content (the message text)
- Timestamp (when the message was created)

## Usage

1. Start a conversation: `ccb code "Hello, Claude!"`
2. Continue the conversation: `ccb continue`
3. View history: `ccb history`
4. Clear history: `ccb clear-history`

## Technical Considerations

1. **File-based Storage**: Uses JSON files for simplicity and transparency
2. **Workspace Isolation**: Each workspace maintains its own conversation history
3. **Memory Efficiency**: Only loads sessions when needed
4. **Error Handling**: Gracefully handles file I/O errors
5. **Cleanup**: Provides commands to manage storage space

## Future Improvements

1. Add conversation titles based on content
2. Implement conversation expiration
3. Add search functionality for conversation history
4. Support for exporting/importing conversations