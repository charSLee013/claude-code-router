import fs from 'fs';
import path from 'path';
import { getWorkspacePaths } from '../constants';

export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

export interface ConversationSession {
  id: string;
  title: string;
  messages: ConversationMessage[];
  createdAt: number;
  updatedAt: number;
  isActive: boolean;
}

/**
 * Get the conversation history directory for a workspace
 * @param cwd Current working directory
 * @returns Path to the conversation history directory
 */
export function getConversationHistoryDir(cwd: string): string {
  const workspacePaths = getWorkspacePaths(cwd);
  const conversationDir = path.join(workspacePaths.ccbDir, 'conversations');
  
  // Ensure the directory exists
  if (!fs.existsSync(conversationDir)) {
    fs.mkdirSync(conversationDir, { recursive: true });
  }
  
  return conversationDir;
}

/**
 * Generate a unique ID for a conversation session
 * @returns Unique session ID
 */
export function generateSessionId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

/**
 * Save a conversation session to disk
 * @param cwd Current working directory
 * @param session Conversation session to save
 */
export function saveConversationSession(cwd: string, session: ConversationSession): void {
  const conversationDir = getConversationHistoryDir(cwd);
  const sessionFile = path.join(conversationDir, `${session.id}.json`);
  
  // Update the updatedAt timestamp
  session.updatedAt = Date.now();
  
  try {
    fs.writeFileSync(sessionFile, JSON.stringify(session, null, 2));
  } catch (error) {
    console.error(`Failed to save conversation session: ${error}`);
  }
}

/**
 * Load a conversation session from disk
 * @param cwd Current working directory
 * @param sessionId ID of the session to load
 * @returns Conversation session or null if not found
 */
export function loadConversationSession(cwd: string, sessionId: string): ConversationSession | null {
  const conversationDir = getConversationHistoryDir(cwd);
  const sessionFile = path.join(conversationDir, `${sessionId}.json`);
  
  if (!fs.existsSync(sessionFile)) {
    return null;
  }
  
  try {
    const content = fs.readFileSync(sessionFile, 'utf-8');
    return JSON.parse(content) as ConversationSession;
  } catch (error) {
    console.error(`Failed to load conversation session: ${error}`);
    return null;
  }
}

/**
 * List all conversation sessions for a workspace
 * @param cwd Current working directory
 * @returns Array of conversation sessions
 */
export function listConversationSessions(cwd: string): ConversationSession[] {
  const conversationDir = getConversationHistoryDir(cwd);
  const sessions: ConversationSession[] = [];
  
  try {
    const files = fs.readdirSync(conversationDir);
    
    for (const file of files) {
      if (file.endsWith('.json')) {
        const filePath = path.join(conversationDir, file);
        try {
          const content = fs.readFileSync(filePath, 'utf-8');
          const session = JSON.parse(content) as ConversationSession;
          sessions.push(session);
        } catch (error) {
          console.error(`Failed to parse conversation session file ${file}: ${error}`);
        }
      }
    }
  } catch (error) {
    console.error(`Failed to list conversation sessions: ${error}`);
  }
  
  // Sort by updated time (newest first)
  return sessions.sort((a, b) => b.updatedAt - a.updatedAt);
}

/**
 * Create a new conversation session
 * @param cwd Current working directory
 * @param title Title for the conversation
 * @returns New conversation session
 */
export function createConversationSession(cwd: string, title: string): ConversationSession {
  const sessionId = generateSessionId();
  const now = Date.now();
  
  const session: ConversationSession = {
    id: sessionId,
    title,
    messages: [],
    createdAt: now,
    updatedAt: now,
    isActive: true
  };
  
  saveConversationSession(cwd, session);
  return session;
}

/**
 * Add a message to a conversation session
 * @param cwd Current working directory
 * @param sessionId ID of the session to add message to
 * @param message Message to add
 */
export function addMessageToSession(cwd: string, sessionId: string, message: ConversationMessage): void {
  const session = loadConversationSession(cwd, sessionId);
  
  if (session) {
    session.messages.push(message);
    session.isActive = true;
    saveConversationSession(cwd, session);
  }
}

/**
 * Clear all conversation history for a workspace
 * @param cwd Current working directory
 */
export function clearConversationHistory(cwd: string): void {
  const conversationDir = getConversationHistoryDir(cwd);
  
  try {
    const files = fs.readdirSync(conversationDir);
    
    for (const file of files) {
      if (file.endsWith('.json')) {
        const filePath = path.join(conversationDir, file);
        fs.unlinkSync(filePath);
      }
    }
    
    console.log('Conversation history cleared successfully.');
  } catch (error) {
    console.error(`Failed to clear conversation history: ${error}`);
  }
}

/**
 * Get the most recent active conversation session
 * @param cwd Current working directory
 * @returns Most recent active conversation session or null
 */
export function getLatestActiveSession(cwd: string): ConversationSession | null {
  const sessions = listConversationSessions(cwd);
  const activeSessions = sessions.filter(session => session.isActive);
  
  if (activeSessions.length > 0) {
    return activeSessions[0];
  }
  
  return null;
}