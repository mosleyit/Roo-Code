import * as path from "path"
import * as fs from "fs/promises"
import { SearchAndReplaceHandler } from "../SearchAndReplaceHandler"
import { Cline } from "../../../Cline"
import { ToolUse } from "../../../assistant-message"
import { formatResponse } from "../../../prompts/responses"
import { getReadablePath } from "../../../../utils/path"
import { fileExistsAtPath } from "../../../../utils/fs"
import { SearchReplaceDiffStrategy } from "../../../diff/strategies/search-replace" // Import the class
import { telemetryService } from "../../../../services/telemetry/TelemetryService"
import delay from "delay"

// --- Mocks ---
jest.mock("../../../Cline")
const MockCline = Cline as jest.MockedClass<typeof Cline>

jest.mock("../../../../utils/path", () => ({
	getReadablePath: jest.fn((cwd, p) => p || "mock/path"),
}))
jest.mock("../../../../utils/fs", () => ({
	fileExistsAtPath: jest.fn(() => Promise.resolve(true)), // Default: file exists
}))
jest.mock("fs/promises", () => ({
	readFile: jest.fn(() => Promise.resolve("Line 1\nLine to replace\nLine 3")), // Default file content
}))
// jest.mock("../../../diff/search-replace", () => ({ // Remove old mock
//     searchAndReplace: jest.fn((lines, ops) => {
//         // Simple mock: just join lines and replace based on first op
//         let content = lines.join('\n');
//         if (ops.length > 0) {
//             content = content.replace(ops[0].search, ops[0].replace);
//         }
//         return content.split('\n');
//     }),
// }));
// Remove the incorrect mock for SearchReplaceDiffStrategy
// jest.mock("../../../diff/strategies/search-replace", () => ({ // Mock the correct module
//     SearchReplaceDiffStrategy: jest.fn().mockImplementation(() => { // Mock the class
//         return {
//             // Mock methods used by the handler or tests
//             applyDiff: jest.fn().mockResolvedValue({ success: true, content: 'mock updated content' }),
//             // Add other methods if needed by tests, e.g., getName, getToolDescription
//             getName: jest.fn(() => 'mockSearchReplace'),
//             getToolDescription: jest.fn(() => 'mock description'),
//             getProgressStatus: jest.fn(() => undefined),
//         };
//     }),
// }));
jest.mock("../../../../services/telemetry/TelemetryService", () => ({
	telemetryService: {
		captureToolUsage: jest.fn(),
	},
}))
jest.mock("../../../prompts/responses", () => ({
	formatResponse: {
		toolError: jest.fn((msg) => `ERROR: ${msg}`),
		createPrettyPatch: jest.fn(() => "mock diff content"), // Needed for diff generation
		toolResult: jest.fn((text) => text),
	},
}))
jest.mock("delay")

describe("SearchAndReplaceHandler", () => {
	let mockClineInstance: jest.MockedObject<Cline>
	let mockDiffViewProvider: any
	// let mockDiffStrategy: jest.Mocked<DiffStrategy>; // Remove unused variable
	let mockToolUse: ToolUse

	beforeEach(() => {
		jest.clearAllMocks()
		// Explicitly reset mocks that might have state changed by specific tests
		;(formatResponse.createPrettyPatch as jest.Mock).mockReturnValue("mock diff content")

		mockDiffViewProvider = {
			editType: undefined,
			isEditing: false,
			originalContent: "Line 1\nLine to replace\nLine 3",
			open: jest.fn(() => Promise.resolve()),
			update: jest.fn(() => Promise.resolve()),
			saveChanges: jest.fn(() =>
				Promise.resolve({ newProblemsMessage: "", userEdits: null, finalContent: "final content" }),
			),
			revertChanges: jest.fn(() => Promise.resolve()),
			reset: jest.fn(() => Promise.resolve()),
			scrollToFirstDiff: jest.fn(),
		}

		mockClineInstance = {
			cwd: "/workspace",
			consecutiveMistakeCount: 0,
			diffViewProvider: mockDiffViewProvider,
			ask: jest.fn(() => Promise.resolve({ response: "yesButtonClicked" })), // Default approval
			say: jest.fn(() => Promise.resolve()),
			pushToolResult: jest.fn(() => Promise.resolve()),
			askApprovalHelper: jest.fn(() => Promise.resolve(true)), // Default approval
			handleErrorHelper: jest.fn(() => Promise.resolve()),
			sayAndCreateMissingParamError: jest.fn((tool, param) => Promise.resolve(`Missing ${param}`)),
			providerRef: { deref: () => ({ getState: () => Promise.resolve({}) }) },
			emit: jest.fn(),
			getTokenUsage: jest.fn(() => ({})),
			didEditFile: false,
		} as unknown as jest.MockedObject<Cline>

		mockToolUse = {
			type: "tool_use",
			name: "search_and_replace",
			params: {
				path: "test.txt",
				operations: JSON.stringify([{ search: "Line to replace", replace: "Line replaced" }]),
			},
			partial: false,
		}
	})

	// --- Test validateParams ---
	test("validateParams should throw if path is missing", () => {
		delete mockToolUse.params.path
		const handler = new SearchAndReplaceHandler(mockClineInstance, mockToolUse)
		expect(() => handler.validateParams()).toThrow("Missing required parameter 'path'")
	})

	test("validateParams should throw if operations is missing", () => {
		delete mockToolUse.params.operations
		const handler = new SearchAndReplaceHandler(mockClineInstance, mockToolUse)
		expect(() => handler.validateParams()).toThrow("Missing required parameter 'operations'")
	})

	// --- Test handlePartial ---
	test("handlePartial should call ask with tool info", async () => {
		mockToolUse.partial = true
		const handler = new SearchAndReplaceHandler(mockClineInstance, mockToolUse)
		await handler.handle()
		expect(mockClineInstance.ask).toHaveBeenCalledWith(
			"tool",
			expect.stringContaining('"tool":"appliedDiff"'), // Uses appliedDiff for UI
			true,
		)
	})

	// --- Test handleComplete ---
	test("handleComplete should fail if operations JSON is invalid", async () => {
		mockToolUse.params.operations = "[{search: 'a'}]" // Missing replace
		const handler = new SearchAndReplaceHandler(mockClineInstance, mockToolUse)
		await handler.handle()
		expect(mockClineInstance.say).toHaveBeenCalledWith(
			"error",
			expect.stringContaining("Failed to parse operations JSON"),
		)
		expect(mockClineInstance.pushToolResult).toHaveBeenCalledWith(
			mockToolUse,
			expect.stringContaining("Invalid operations JSON format"),
		)
	})

	test("handleComplete should handle file not existing", async () => {
		;(fileExistsAtPath as jest.Mock).mockResolvedValue(false)
		const handler = new SearchAndReplaceHandler(mockClineInstance, mockToolUse)
		await handler.handle()
		expect(mockClineInstance.say).toHaveBeenCalledWith("error", expect.stringContaining("File does not exist"))
		expect(mockClineInstance.pushToolResult).toHaveBeenCalledWith(
			mockToolUse,
			expect.stringContaining("File does not exist"),
		)
	})

	test("handleComplete should call searchAndReplace and update diff view", async () => {
		;(fileExistsAtPath as jest.Mock).mockResolvedValue(true)
		const handler = new SearchAndReplaceHandler(mockClineInstance, mockToolUse)
		await handler.handle()
		expect(fs.readFile).toHaveBeenCalledWith("/workspace/test.txt", "utf-8") // Correct encoding
		// Access the applyDiff mock from the instance created by the handler
		const mockStrategyInstance = (SearchReplaceDiffStrategy as jest.MockedClass<typeof SearchReplaceDiffStrategy>)
			.mock.instances[0]
		expect(mockStrategyInstance.applyDiff).toHaveBeenCalledWith(
			"Line 1\nLine to replace\nLine 3", // Original file content string
			mockToolUse.params.operations, // The operations JSON string
			undefined, // No start_line provided in this tool's params
			undefined, // No end_line provided in this tool's params
		)
		expect(mockDiffViewProvider.update).toHaveBeenCalledWith(expect.any(String), true)
		expect(mockDiffViewProvider.scrollToFirstDiff).toHaveBeenCalled()
	})

	test("handleComplete should push 'No changes needed' if diff is empty", async () => {
		;(fileExistsAtPath as jest.Mock).mockResolvedValue(true)
		// Update to mock the applyDiff method of the strategy instance
		// Access the mock instance created by the handler in the previous test run (or assume one exists)
		// This is fragile, ideally mock setup should be self-contained per test
		const mockStrategyInstance = (SearchReplaceDiffStrategy as jest.MockedClass<typeof SearchReplaceDiffStrategy>)
			.mock.instances[0]
		if (mockStrategyInstance) {
			;(mockStrategyInstance.applyDiff as jest.Mock).mockResolvedValue({
				success: true,
				content: "Line 1\nLine to replace\nLine 3",
			}) // Access .mock property
		} else {
			// Fallback or throw error if instance doesn't exist - indicates test order dependency
			console.warn("Mock strategy instance not found for 'No changes needed' test setup")
		}
		;(formatResponse.createPrettyPatch as jest.Mock).mockReturnValue("") // Simulate empty diff
		const handler = new SearchAndReplaceHandler(mockClineInstance, mockToolUse)
		await handler.handle()
		expect(mockClineInstance.pushToolResult).toHaveBeenCalledWith(mockToolUse, "No changes needed for 'test.txt'")
		expect(mockDiffViewProvider.reset).toHaveBeenCalled()
	})

	test("handleComplete should ask for approval", async () => {
		;(fileExistsAtPath as jest.Mock).mockResolvedValue(true)
		const handler = new SearchAndReplaceHandler(mockClineInstance, mockToolUse)
		await handler.handle()
		// Uses askApprovalHelper, unlike InsertContentHandler
		expect(mockClineInstance.askApprovalHelper).toHaveBeenCalledWith(
			mockToolUse,
			"tool",
			expect.stringContaining('"tool":"appliedDiff"'),
			undefined, // No progress status
		)
	})

	test("handleComplete should save changes and push success on approval", async () => {
		;(fileExistsAtPath as jest.Mock).mockResolvedValue(true)
		;(mockClineInstance.askApprovalHelper as jest.Mock).mockResolvedValue(true)
		const handler = new SearchAndReplaceHandler(mockClineInstance, mockToolUse)
		await handler.handle()
		expect(mockDiffViewProvider.saveChanges).toHaveBeenCalled()
		expect(mockClineInstance.pushToolResult).toHaveBeenCalledWith(
			mockToolUse,
			expect.stringContaining("successfully applied"),
		)
		expect(mockClineInstance.didEditFile).toBe(true)
		expect(telemetryService.captureToolUsage).toHaveBeenCalledWith(mockClineInstance.taskId, "search_and_replace")
		expect(mockDiffViewProvider.reset).toHaveBeenCalled()
	})

	test("handleComplete should revert changes on rejection", async () => {
		;(fileExistsAtPath as jest.Mock).mockResolvedValue(true)
		;(mockClineInstance.askApprovalHelper as jest.Mock).mockResolvedValue(false)
		const handler = new SearchAndReplaceHandler(mockClineInstance, mockToolUse)
		await handler.handle()
		expect(mockDiffViewProvider.saveChanges).not.toHaveBeenCalled()
		expect(mockDiffViewProvider.revertChanges).toHaveBeenCalled()
		// pushToolResult handled by askApprovalHelper
		expect(mockDiffViewProvider.reset).toHaveBeenCalled()
	})

	test("handleComplete should handle errors during search/replace", async () => {
		;(fileExistsAtPath as jest.Mock).mockResolvedValue(true)
		const replaceError = new Error("Replace failed")
		// Update to mock the applyDiff method of the strategy instance
		// Access the mock instance created by the handler
		const mockStrategyInstance = (SearchReplaceDiffStrategy as jest.MockedClass<typeof SearchReplaceDiffStrategy>)
			.mock.instances[0]
		if (mockStrategyInstance) {
			;(mockStrategyInstance.applyDiff as jest.Mock).mockImplementation(() => {
				throw replaceError
			})
		} else {
			console.warn("Mock strategy instance not found for error handling test setup")
			// Fallback: Mock constructor to throw if instance isn't found (less ideal)
			;(SearchReplaceDiffStrategy as jest.MockedClass<typeof SearchReplaceDiffStrategy>).mockImplementationOnce(
				() => {
					throw replaceError
				},
			)
		}
		const handler = new SearchAndReplaceHandler(mockClineInstance, mockToolUse)
		await handler.handle()
		expect(mockClineInstance.handleErrorHelper).toHaveBeenCalledWith(
			mockToolUse,
			"applying search and replace",
			replaceError,
		)
		expect(mockDiffViewProvider.reset).toHaveBeenCalled()
	})
})
