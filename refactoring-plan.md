# Refactoring Plan: Moving Tool Use Logic to Dedicated Classes

## Current State

The Cline.ts file is a large, complex file with multiple responsibilities. One significant part of this file is the `tool_use` case within the `presentAssistantMessage` method, which handles various tools like:

- write_to_file
- apply_diff
- read_file
- search_files
- list_files
- list_code_definition_names
- browser_action
- execute_command
- use_mcp_tool
- access_mcp_resource
- ask_followup_question
- attempt_completion
- switch_mode
- new_task
- fetch_instructions
- insert_content
- search_and_replace

This creates several issues:

- The file is too large and difficult to maintain
- The `presentAssistantMessage` method is complex with too many responsibilities
- Testing individual tool functionality is challenging
- Adding new tools requires modifying a large, critical file

### Current Code Organization

The current codebase already has some organization related to tools:

1. **Tool Descriptions**: Each tool has a description file in `src/core/prompts/tools/` that defines how the tool is presented in the system prompt.

    - For example: `write-to-file.ts`, `read-file.ts`, etc.
    - These files only contain the tool descriptions, not the implementation logic.

2. **Tool Interfaces**: The tool interfaces are defined in `src/core/assistant-message/index.ts`.

    - Defines types like `ToolUse`, `WriteToFileToolUse`, etc.

3. **Tool Parsing**: The parsing logic for tools is in `src/core/assistant-message/parse-assistant-message.ts`.

    - Responsible for parsing the assistant's message and extracting tool use blocks.

4. **Tool Validation**: The validation logic is in `src/core/mode-validator.ts`.

    - Checks if a tool is allowed in a specific mode.

5. **Tool Implementation**: All tool implementations are in the `Cline.ts` file, specifically in the `presentAssistantMessage` method's `tool_use` case.
    - This is what we want to refactor into separate classes.

## Proposed Solution

Refactor the tool use logic into dedicated classes following SOLID principles, particularly the Single Responsibility Principle. This will:

1. Make the codebase more maintainable
2. Improve testability
3. Make it easier to add new tools
4. Reduce the complexity of the Cline class

## Implementation Plan

### 1. Create Directory Structure

```
src/core/tool-handlers/
├── index.ts                  # Main exports
├── ToolUseHandler.ts         # Base abstract class
├── ToolUseHandlerFactory.ts  # Factory for creating tool handlers
└── tools/                    # Individual tool handlers (leveraging existing tool descriptions)
    ├── WriteToFileHandler.ts
    ├── ReadFileHandler.ts
    ├── ExecuteCommandHandler.ts
    ├── ApplyDiffHandler.ts
    ├── SearchFilesHandler.ts
    ├── ListFilesHandler.ts
    ├── ListCodeDefinitionNamesHandler.ts
    ├── BrowserActionHandler.ts
    ├── UseMcpToolHandler.ts
    ├── AccessMcpResourceHandler.ts
    ├── AskFollowupQuestionHandler.ts
    ├── AttemptCompletionHandler.ts
    ├── SwitchModeHandler.ts
    ├── NewTaskHandler.ts
    ├── FetchInstructionsHandler.ts
    ├── InsertContentHandler.ts
    └── SearchAndReplaceHandler.ts
```

### 2. Create Base ToolUseHandler Class

Create an abstract base class that defines the common interface and functionality for all tool handlers:

```typescript
// src/core/tool-handlers/ToolUseHandler.ts
import { ToolUse } from "../assistant-message"
import { Cline } from "../Cline"

export abstract class ToolUseHandler {
	protected cline: Cline
	protected toolUse: ToolUse

	constructor(cline: Cline, toolUse: ToolUse) {
		this.cline = cline
		this.toolUse = toolUse
	}

	/**
	 * Handle the tool use, both partial and complete states
	 * @returns Promise<boolean> true if the tool was handled, false otherwise
	 */
	abstract handle(): Promise<boolean>

	/**
	 * Handle a partial tool use (streaming)
	 */
	abstract handlePartial(): Promise<void>

	/**
	 * Handle a complete tool use
	 */
	abstract handleComplete(): Promise<void>

	/**
	 * Validate the tool parameters
	 * @throws Error if validation fails
	 */
	abstract validateParams(): void

	/**
	 * Helper to remove closing tags from partial parameters
	 */
	protected removeClosingTag(tag: string, text?: string): string {
		if (!this.toolUse.partial) {
			return text || ""
		}
		if (!text) {
			return ""
		}
		const tagRegex = new RegExp(
			`\\s?<\\/?${tag
				.split("")
				.map((char) => `(?:${char})?`)
				.join("")}$`,
			"g",
		)
		return text.replace(tagRegex, "")
	}

	/**
	 * Helper to handle missing parameters
	 */
	protected async handleMissingParam(paramName: string): Promise<string> {
		this.cline.consecutiveMistakeCount++
		return await this.cline.sayAndCreateMissingParamError(this.toolUse.name, paramName, this.toolUse.params.path)
	}
}
```

### 3. Create ToolUseHandlerFactory

Create a factory class to instantiate the appropriate tool handler:

```typescript
// src/core/tool-handlers/ToolUseHandlerFactory.ts
import { ToolUse, ToolUseName } from "../assistant-message"
import { Cline } from "../Cline"
import { ToolUseHandler } from "./ToolUseHandler"
import { WriteToFileHandler } from "./tools/WriteToFileHandler"
import { ReadFileHandler } from "./tools/ReadFileHandler"
import { ExecuteCommandHandler } from "./tools/ExecuteCommandHandler"
import { ApplyDiffHandler } from "./tools/ApplyDiffHandler"
import { SearchFilesHandler } from "./tools/SearchFilesHandler"
import { ListFilesHandler } from "./tools/ListFilesHandler"
import { ListCodeDefinitionNamesHandler } from "./tools/ListCodeDefinitionNamesHandler"
import { BrowserActionHandler } from "./tools/BrowserActionHandler"
import { UseMcpToolHandler } from "./tools/UseMcpToolHandler"
import { AccessMcpResourceHandler } from "./tools/AccessMcpResourceHandler"
import { AskFollowupQuestionHandler } from "./tools/AskFollowupQuestionHandler"
import { AttemptCompletionHandler } from "./tools/AttemptCompletionHandler"
import { SwitchModeHandler } from "./tools/SwitchModeHandler"
import { NewTaskHandler } from "./tools/NewTaskHandler"
import { FetchInstructionsHandler } from "./tools/FetchInstructionsHandler"
import { InsertContentHandler } from "./tools/InsertContentHandler"
import { SearchAndReplaceHandler } from "./tools/SearchAndReplaceHandler"

export class ToolUseHandlerFactory {
	static createHandler(cline: Cline, toolUse: ToolUse): ToolUseHandler | null {
		switch (toolUse.name) {
			case "write_to_file":
				return new WriteToFileHandler(cline, toolUse)
			case "read_file":
				return new ReadFileHandler(cline, toolUse)
			case "execute_command":
				return new ExecuteCommandHandler(cline, toolUse)
			case "apply_diff":
				return new ApplyDiffHandler(cline, toolUse)
			case "search_files":
				return new SearchFilesHandler(cline, toolUse)
			case "list_files":
				return new ListFilesHandler(cline, toolUse)
			case "list_code_definition_names":
				return new ListCodeDefinitionNamesHandler(cline, toolUse)
			case "browser_action":
				return new BrowserActionHandler(cline, toolUse)
			case "use_mcp_tool":
				return new UseMcpToolHandler(cline, toolUse)
			case "access_mcp_resource":
				return new AccessMcpResourceHandler(cline, toolUse)
			case "ask_followup_question":
				return new AskFollowupQuestionHandler(cline, toolUse)
			case "attempt_completion":
				return new AttemptCompletionHandler(cline, toolUse)
			case "switch_mode":
				return new SwitchModeHandler(cline, toolUse)
			case "new_task":
				return new NewTaskHandler(cline, toolUse)
			case "fetch_instructions":
				return new FetchInstructionsHandler(cline, toolUse)
			case "insert_content":
				return new InsertContentHandler(cline, toolUse)
			case "search_and_replace":
				return new SearchAndReplaceHandler(cline, toolUse)
			default:
				return null
		}
	}
}
```

### 4. Create Individual Tool Handlers

Create a separate class for each tool, implementing the ToolUseHandler interface:

Example for WriteToFileHandler:

```typescript
// src/core/tool-handlers/tools/WriteToFileHandler.ts
import { ToolUse, WriteToFileToolUse } from "../../assistant-message"
import { Cline } from "../../Cline"
import { ToolUseHandler } from "../ToolUseHandler"
import * as path from "path"
import { formatResponse } from "../../prompts/responses"
import { ClineSayTool } from "../../../shared/ExtensionMessage"
import { getReadablePath } from "../../../utils/path"
import { isPathOutsideWorkspace } from "../../../utils/pathUtils"

export class WriteToFileHandler extends ToolUseHandler {
	private toolUse: WriteToFileToolUse

	constructor(cline: Cline, toolUse: ToolUse) {
		super(cline, toolUse)
		this.toolUse = toolUse as WriteToFileToolUse
	}

	async handle(): Promise<boolean> {
		if (this.toolUse.partial) {
			await this.handlePartial()
			return false
		} else {
			await this.handleComplete()
			return true
		}
	}

	async handlePartial(): Promise<void> {
		const relPath = this.toolUse.params.path
		let newContent = this.toolUse.params.content

		// Skip if we don't have enough information yet
		if (!relPath || !newContent) {
			return
		}

		// Validate access
		const accessAllowed = this.cline.rooIgnoreController?.validateAccess(relPath)
		if (!accessAllowed) {
			await this.cline.say("rooignore_error", relPath)
			this.cline.pushToolResult(formatResponse.toolError(formatResponse.rooIgnoreError(relPath)))
			return
		}

		// Determine if the path is outside the workspace
		const fullPath = relPath ? path.resolve(this.cline.cwd, this.removeClosingTag("path", relPath)) : ""
		const isOutsideWorkspace = isPathOutsideWorkspace(fullPath)

		const sharedMessageProps: ClineSayTool = {
			tool: this.cline.diffViewProvider.editType === "modify" ? "editedExistingFile" : "newFileCreated",
			path: getReadablePath(this.cline.cwd, this.removeClosingTag("path", relPath)),
			isOutsideWorkspace,
		}

		// Update GUI message
		const partialMessage = JSON.stringify(sharedMessageProps)
		await this.cline.ask("tool", partialMessage, this.toolUse.partial).catch(() => {})

		// Update editor
		if (!this.cline.diffViewProvider.isEditing) {
			// Open the editor and prepare to stream content in
			await this.cline.diffViewProvider.open(relPath)
		}

		// Editor is open, stream content in
		await this.cline.diffViewProvider.update(
			everyLineHasLineNumbers(newContent) ? stripLineNumbers(newContent) : newContent,
			false,
		)
	}

	async handleComplete(): Promise<void> {
		// Implementation for complete write_to_file tool use
		// ...
	}

	validateParams(): void {
		const relPath = this.toolUse.params.path
		const newContent = this.toolUse.params.content
		const predictedLineCount = parseInt(this.toolUse.params.line_count ?? "0")

		if (!relPath) {
			throw new Error("Missing required parameter 'path'")
		}
		if (!newContent) {
			throw new Error("Missing required parameter 'content'")
		}
		if (!predictedLineCount) {
			throw new Error("Missing required parameter 'line_count'")
		}
	}
}
```

### 5. Update Main Export File

Create an index.ts file to export all the tool handlers:

```typescript
// src/core/tool-handlers/index.ts
export * from "./ToolUseHandler"
export * from "./ToolUseHandlerFactory"
export * from "./tools/WriteToFileHandler"
export * from "./tools/ReadFileHandler"
export * from "./tools/ExecuteCommandHandler"
export * from "./tools/ApplyDiffHandler"
export * from "./tools/SearchFilesHandler"
export * from "./tools/ListFilesHandler"
export * from "./tools/ListCodeDefinitionNamesHandler"
export * from "./tools/BrowserActionHandler"
export * from "./tools/UseMcpToolHandler"
export * from "./tools/AccessMcpResourceHandler"
export * from "./tools/AskFollowupQuestionHandler"
export * from "./tools/AttemptCompletionHandler"
export * from "./tools/SwitchModeHandler"
export * from "./tools/NewTaskHandler"
export * from "./tools/FetchInstructionsHandler"
export * from "./tools/InsertContentHandler"
export * from "./tools/SearchAndReplaceHandler"
```

### 6. Update Cline Class

Modify the Cline class to use the new tool handlers:

```typescript
// src/core/Cline.ts (modified section)
import { ToolUseHandlerFactory } from "./tool-handlers";

// Inside presentAssistantMessage method
case "tool_use":
  const handler = ToolUseHandlerFactory.createHandler(this, block);
  if (handler) {
    const handled = await handler.handle();
    if (handled) {
      // Tool was handled, update state
      isCheckpointPossible = true;
    }
  } else {
    // Fallback for unhandled tools or handle error
    console.error(`No handler found for tool: ${block.name}`);
    this.consecutiveMistakeCount++;
    pushToolResult(formatResponse.toolError(`Unsupported tool: ${block.name}`));
  }
  break;
```

### 7. Migration Strategy

1. Start with one tool (e.g., write_to_file) to validate the approach
2. Gradually migrate each tool to its own handler
3. Update tests for each migrated tool
4. Once all tools are migrated, clean up the Cline class

## Benefits

1. **Improved Maintainability**: Each tool handler is responsible for a single tool, making the code easier to understand and maintain.

2. **Better Testability**: Individual tool handlers can be tested in isolation.

3. **Easier Extension**: Adding new tools becomes simpler as it only requires adding a new handler class.

4. **Reduced Complexity**: The Cline class becomes smaller and more focused on its core responsibilities.

5. **Better Organization**: Code is organized by functionality rather than being part of a large switch statement.

## Potential Challenges

1. **Shared State**: Tool handlers need access to Cline's state. This is addressed by passing the Cline instance to the handlers.

2. **Backward Compatibility**: Ensure the refactoring doesn't break existing functionality.

3. **Testing**: Need to create comprehensive tests for each tool handler.

## Timeline

1. **Phase 1**: Set up the directory structure and base classes

    - Create the `ToolUseHandler` abstract class
    - Create the `ToolUseHandlerFactory` class
    - Set up the directory structure

2. **Phase 2**: Implement handlers for each tool, one at a time

    - Group 1: File operations (write_to_file, read_file, apply_diff, insert_content, search_and_replace)
    - Group 2: Search and list operations (search_files, list_files, list_code_definition_names)
    - Group 3: External interactions (browser_action, execute_command)
    - Group 4: MCP operations (use_mcp_tool, access_mcp_resource)
    - Group 5: Flow control (ask_followup_question, attempt_completion, switch_mode, new_task, fetch_instructions)

    For each tool:

    - Extract the implementation from Cline.ts
    - Create a new handler class
    - Implement the required methods
    - Ensure it works with the existing tool description

3. **Phase 3**: Update the Cline class to use the new handlers

    - Replace the switch statement in the `tool_use` case with the factory pattern
    - Update any dependencies or references

4. **Phase 4**: Testing and bug fixing
    - Create unit tests for each handler
    - Ensure all existing functionality works as expected
    - Fix any issues that arise during testing

## Dependencies and Considerations

1. **Existing Tool Descriptions**: Leverage the existing tool description files in `src/core/prompts/tools/` to ensure consistency between the tool descriptions and implementations.

2. **Tool Validation**: Continue to use the existing validation logic in `mode-validator.ts`.

3. **Tool Parsing**: The parsing logic in `parse-assistant-message.ts` should remain unchanged.

4. **Cline Dependencies**: The tool handlers will need access to various Cline methods and properties. Consider:
    - Passing the Cline instance to the handlers
    - Creating interfaces for the required dependencies
    - Using dependency injection to make testing easier

## Tool Dependencies and Interactions

Based on our analysis of the codebase, here are the key dependencies and interactions for each tool:

### File Operation Tools

1. **write_to_file**

    - Dependencies:
        - `diffViewProvider` for showing diffs and handling file edits
        - `rooIgnoreController` for validating file access
        - `formatResponse` for formatting tool results
        - `isPathOutsideWorkspace` for checking workspace boundaries
        - `getReadablePath` for formatting paths
        - `everyLineHasLineNumbers` and `stripLineNumbers` for handling line numbers
        - `detectCodeOmission` for checking for code truncation
    - Interactions:
        - Asks for user approval before saving changes
        - Updates the UI with file edit status
        - Creates or modifies files

2. **read_file**

    - Dependencies:
        - `rooIgnoreController` for validating file access
        - `extractTextFromFile` for reading file content
        - `addLineNumbers` for adding line numbers to content
        - `countFileLines` for counting total lines
        - `readLines` for reading specific line ranges
        - `isBinaryFile` for checking if a file is binary
    - Interactions:
        - Asks for user approval before reading files
        - Handles large files with line limits

3. **apply_diff**

    - Dependencies:
        - `diffViewProvider` for showing diffs and handling file edits
        - `diffStrategy` for applying diffs to files
        - `rooIgnoreController` for validating file access
    - Interactions:
        - Shows diff preview before applying changes
        - Handles partial diff application failures

4. **insert_content**

    - Dependencies:
        - `diffViewProvider` for showing diffs and handling file edits
        - `insertGroups` for inserting content at specific positions
    - Interactions:
        - Shows diff preview before applying changes
        - Handles user edits to the inserted content

5. **search_and_replace**
    - Dependencies:
        - `diffViewProvider` for showing diffs and handling file edits
        - Regular expressions for search and replace
    - Interactions:
        - Shows diff preview before applying changes
        - Handles complex search patterns with regex

### Search and List Tools

6. **search_files**

    - Dependencies:
        - `regexSearchFiles` for searching files with regex
        - `rooIgnoreController` for filtering results
    - Interactions:
        - Asks for user approval before searching
        - Formats search results for display

7. **list_files**

    - Dependencies:
        - `listFiles` for listing directory contents
        - `rooIgnoreController` for filtering results
    - Interactions:
        - Asks for user approval before listing files
        - Handles recursive listing with limits

8. **list_code_definition_names**
    - Dependencies:
        - `parseSourceCodeForDefinitionsTopLevel` for parsing code definitions
        - `rooIgnoreController` for filtering results
    - Interactions:
        - Asks for user approval before parsing code
        - Formats definition results for display

### External Interaction Tools

9. **browser_action**

    - Dependencies:
        - `browserSession` for controlling the browser
        - Various browser action methods (launch, click, type, etc.)
    - Interactions:
        - Manages browser lifecycle (launch, close)
        - Captures screenshots and console logs
        - Requires closing before using other tools

10. **execute_command**
    - Dependencies:
        - `TerminalRegistry` for managing terminals
        - `Terminal` for running commands
        - `rooIgnoreController` for validating commands
    - Interactions:
        - Runs commands in terminals
        - Captures command output
        - Handles long-running commands

### MCP Tools

11. **use_mcp_tool**

    - Dependencies:
        - `McpHub` for accessing MCP tools
    - Interactions:
        - Calls external MCP tools
        - Formats tool results for display

12. **access_mcp_resource**
    - Dependencies:
        - `McpHub` for accessing MCP resources
    - Interactions:
        - Reads external MCP resources
        - Handles different content types (text, images)

### Flow Control Tools

13. **ask_followup_question**

    - Dependencies:
        - `parseXml` for parsing XML content
    - Interactions:
        - Asks the user questions
        - Formats user responses

14. **attempt_completion**

    - Dependencies:
        - `executeCommandTool` for running completion commands
    - Interactions:
        - Signals task completion
        - Optionally runs a command to demonstrate results

15. **switch_mode**

    - Dependencies:
        - `getModeBySlug` for validating modes
        - `providerRef` for accessing the provider
    - Interactions:
        - Changes the current mode
        - Validates mode existence

16. **new_task**

    - Dependencies:
        - `getModeBySlug` for validating modes
        - `providerRef` for accessing the provider
    - Interactions:
        - Creates a new task
        - Pauses the current task

17. **fetch_instructions**
    - Dependencies:
        - `fetchInstructions` for getting instructions
        - `McpHub` for accessing MCP
    - Interactions:
        - Fetches instructions for specific tasks

## Conclusion

This refactoring will significantly improve the maintainability and extensibility of the codebase by breaking down the monolithic Cline class into smaller, more focused components. The tool_use case, which is currently a large switch statement, will be replaced with a more object-oriented approach using the Strategy pattern through the ToolUseHandler interface.
