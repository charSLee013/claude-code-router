# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Codebase Overview

The Claude Code Bridge (CCB) is a TypeScript-based proxy server that routes requests from Claude Code to various AI providers. It implements a three-tier configuration system, workspace-level service isolation, and intelligent model routing based on request characteristics.

## Overview
This repository contains the Claude Code Bridge (CCB), an intelligent request routing tool for Claude Code. It allows for workspace-level service management and dynamic switching between multiple AI models. Key features include:
- **Workspace-level service isolation**: Each project directory runs an independent service instance.
- **Intelligent model routing**: Automatically selects the most suitable model based on task type.
- **Random port allocation**: Automatically assigns available ports.
- **Three-tier configuration system**: Flexible configuration priority management (Environment Variables > Workspace Config > Global Config).
- **Full compatibility**: Seamless integration with existing Claude Code workflows.
- **Conversation History**: Maintains conversation context across multiple invocations.
- **Thinking Mode Support**: Special handling for thinking requests with configurable streaming behavior.

## High-Level Architecture

The CCB architecture consists of several key components:

1. **CLI Interface** (`src/cli.ts`): Command-line interface for starting, stopping, and managing the service.
2. **Service Core** (`src/index.ts`): Main service entry point that manages the lifecycle of the CCB service.
3. **HTTP Server** (`src/server.ts`): Express-based server that handles incoming requests and implements middleware.
4. **Middleware System**:
   - **Request Rewriting** (`src/middlewares/rewriteBody.ts`): Transforms incoming requests to match expected formats.
   - **Intelligent Routing** (`src/middlewares/router.ts`): Routes requests to appropriate AI models based on content and configuration.
   - **Response Formatting** (`src/middlewares/formatRequest.ts`): Formats responses to match Anthropic API format.
5. **Utility Modules** (`src/utils/`): Various helper functions for configuration, logging, process management, streaming responses, and more.
6. **Conversation History** (`src/utils/conversationHistory.ts`): Manages conversation history for continuing conversations across multiple invocations.
7. **Configuration System** (`src/utils/config.ts`): Implements the three-tier configuration system and validation.

The system uses a plugin-like architecture where middleware functions are chained together to process requests. Each workspace runs an independent service instance with its own configuration, logs, and state management.

## Commands

### Development Commands
- **Build CLI**: `npm run build` (builds `dist/cli.js`)
- **Build Server**: `npm run buildserver` (builds `dist/index.js`)
- **Run Tests**: `npm run test` or `jest`
- **Run Single Test**: `npm run test -- <test-file>`

### Runtime Commands
- **Start Service**: `ccb start`
- **Use CCB for coding**: `ccb code "Your coding task"`
- **Continue Conversation**: `ccb continue`
- **Check Service Status**: `ccb status`
- **Stop Service**: `ccb stop`
- **View Conversation History**: `ccb history`
- **Clear Conversation History**: `ccb clear-history`
- **View Version**: `ccb -v` or `ccb version`
- **View Help**: `ccb -h` or `ccb help`

## Configuration System
CCB uses a three-tier configuration system with the following hierarchy (highest to lowest priority):
1.  **Environment Variables**
2.  **Workspace Configuration**: `<your-project>/.claude/ccb-config.json`
3.  **Global Configuration**: `~/.claude/ccb-config.json`

Configuration files are automatically created if they don't exist. The service validates configurations on startup and provides detailed error messages for any issues.

### Key Configuration Options
- `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `OPENAI_MODEL`: General API settings.
- `basePort`: Starting range for port allocation (default: 3456).
- `timeout`: Request timeout in milliseconds (default: 30000).
- `maxRetries`: Maximum number of retries for requests (default: 3).
- `logEnabled`: Enable/disable file logging (default: false).
- `autoStart`: Enable/disable automatic service startup (default: false).
- `providers`: Array of model providers with specific configurations.
- `Router`: Object defining intelligent routing rules based on task types.

### Advanced Routing Configuration (`providers` and `Router`)
- The `providers` array allows defining multiple AI model providers with specific `id`, `api_base_url`, `api_key`, and `model` (real API model name).
- The `Router` object defines intelligent routing rules based on task types:
    - `background`: For internal background tasks (triggered by `claude-3-5-haiku` model requests).
    - `think`: For complex tasks requiring deep reasoning (triggered by `thinking: true` flag in requests).
    - `longContext`: For tasks with large token counts (> 32,000).
    - `default`: Default provider to use when no specific routing rule matches.

The routing system automatically selects the appropriate provider based on:
1. Token count (for long context routing)
2. Model name (for background task routing)
3. Presence of `thinking` flag
4. Manual provider specification in the request
5. Default provider as a fallback

### Provider Advanced Options
- `extra_body`: Inject additional request parameters that merge with the original request
- `force_stream_for_thinking`: Force streaming for thinking tasks

## Workspace Features
- **Independent Service Management**: Each project directory has independent service instances (process, port, config, logs, status).
- **Automatic Port Allocation**: Services automatically get random available ports.
- **Conversation History**: Each workspace maintains conversation history for continuing conversations.
- **Workspace Directory Structure**:
    ```
    your-project/
    ├── .claude/
    │   ├── ccb-config.json      # Workspace configuration
    │   ├── ccb-service.log      # Service logs
    │   ├── ccb-service.json     # Service status
    │   └── conversations/       # Conversation history
    └── your-code-files...
    ```

Each workspace maintains its own service state, allowing multiple projects to run simultaneously without interference. The service automatically manages its lifecycle and cleans up resources when stopped.