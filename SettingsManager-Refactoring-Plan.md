# Refactoring Plan: Extracting SettingsManager from ClineProvider

This document outlines a step-by-step plan for extracting a SettingsManager component from the ClineProvider class to improve code maintainability and separation of concerns.

## Problem Statement

The `ClineProvider.ts` file has grown to over 2000 lines of code and handles many different responsibilities, making it difficult to maintain and extend. One significant area of responsibility is settings management, which includes:

- Managing global state settings
- Handling secrets (API keys, etc.)
- Updating and retrieving configuration values
- Providing settings to the webview

By extracting this functionality into a dedicated SettingsManager class, we can reduce the complexity of ClineProvider and make the codebase more maintainable.

## Benefits of Refactoring

1. **Reduced Complexity**: The ClineProvider class will be significantly smaller and more focused
2. **Improved Maintainability**: Settings-related code will be centralized in one place
3. **Better Separation of Concerns**: Clear boundaries between components
4. **Easier Testing**: Isolated components are easier to test
5. **Simplified Extension**: Future settings additions will be more straightforward

## Implementation Plan

### Step 1: Create the SettingsManager Class

Create a new file `src/core/settings/SettingsManager.ts` with the following structure:

```typescript
import * as vscode from "vscode"
import { ApiConfiguration, ApiProvider, ModelInfo } from "../../shared/api"
import { Mode } from "../../shared/modes"
import { ApiConfigMeta } from "../../shared/ExtensionMessage"
import { HistoryItem } from "../../shared/HistoryItem"
import { ExperimentId, experimentDefault } from "../../shared/experiments"
import { CustomSupportPrompts } from "../../shared/support-prompt"
import { CustomModePrompts } from "../../shared/modes"

// Define the types of settings we'll manage
export type SecretKey =
	| "apiKey"
	| "glamaApiKey"
	| "openRouterApiKey"
	| "awsAccessKey"
	| "awsSecretKey"
	| "awsSessionToken"
	| "openAiApiKey"
	| "geminiApiKey"
	| "openAiNativeApiKey"
	| "deepSeekApiKey"
	| "mistralApiKey"
	| "unboundApiKey"
	| "requestyApiKey"

export type GlobalStateKey =
	| "apiProvider"
	| "apiModelId"
	| "glamaModelId"
	| "glamaModelInfo"
	| "awsRegion"
	| "awsUseCrossRegionInference"
	| "awsProfile"
	| "awsUseProfile"
	| "vertexProjectId"
	| "vertexRegion"
	| "lastShownAnnouncementId"
	| "customInstructions"
	| "alwaysAllowReadOnly"
	| "alwaysAllowWrite"
	| "alwaysAllowExecute"
	| "alwaysAllowBrowser"
	| "alwaysAllowMcp"
	| "alwaysAllowModeSwitch"
	| "taskHistory"
	| "openAiBaseUrl"
	| "openAiModelId"
	| "openAiCustomModelInfo"
	| "openAiUseAzure"
	| "ollamaModelId"
	| "ollamaBaseUrl"
	| "lmStudioModelId"
	| "lmStudioBaseUrl"
	| "anthropicBaseUrl"
	| "azureApiVersion"
	| "openAiStreamingEnabled"
	| "openRouterModelId"
	| "openRouterModelInfo"
	| "openRouterBaseUrl"
	| "openRouterUseMiddleOutTransform"
	| "allowedCommands"
	| "soundEnabled"
	| "soundVolume"
	| "diffEnabled"
	| "checkpointsEnabled"
	| "browserViewportSize"
	| "screenshotQuality"
	| "fuzzyMatchThreshold"
	| "preferredLanguage"
	| "writeDelayMs"
	| "terminalOutputLineLimit"
	| "mcpEnabled"
	| "enableMcpServerCreation"
	| "alwaysApproveResubmit"
	| "requestDelaySeconds"
	| "rateLimitSeconds"
	| "currentApiConfigName"
	| "listApiConfigMeta"
	| "vsCodeLmModelSelector"
	| "mode"
	| "modeApiConfigs"
	| "customModePrompts"
	| "customSupportPrompts"
	| "enhancementApiConfigId"
	| "experiments"
	| "autoApprovalEnabled"
	| "customModes"
	| "unboundModelId"
	| "requestyModelId"
	| "requestyModelInfo"
	| "unboundModelInfo"
	| "modelTemperature"
	| "mistralCodestralUrl"
	| "maxOpenTabsContext"

export class SettingsManager {
	constructor(private readonly context: vscode.ExtensionContext) {}

	// Methods for managing global state
	async updateGlobalState(key: GlobalStateKey, value: any): Promise<void> {
		await this.context.globalState.update(key, value)
	}

	async getGlobalState(key: GlobalStateKey): Promise<any> {
		return await this.context.globalState.get(key)
	}

	// Methods for managing secrets
	async storeSecret(key: SecretKey, value?: string): Promise<void> {
		if (value) {
			await this.context.secrets.store(key, value)
		} else {
			await this.context.secrets.delete(key)
		}
	}

	async getSecret(key: SecretKey): Promise<string | undefined> {
		return await this.context.secrets.get(key)
	}

	// Method to get all settings at once (similar to getState in ClineProvider)
	async getAllSettings(): Promise<any> {
		const [
			storedApiProvider,
			apiModelId,
			apiKey,
			glamaApiKey,
			glamaModelId,
			glamaModelInfo,
			openRouterApiKey,
			awsAccessKey,
			awsSecretKey,
			awsSessionToken,
			awsRegion,
			awsUseCrossRegionInference,
			awsProfile,
			awsUseProfile,
			vertexProjectId,
			vertexRegion,
			openAiBaseUrl,
			openAiApiKey,
			openAiModelId,
			openAiCustomModelInfo,
			openAiUseAzure,
			ollamaModelId,
			ollamaBaseUrl,
			lmStudioModelId,
			lmStudioBaseUrl,
			anthropicBaseUrl,
			geminiApiKey,
			openAiNativeApiKey,
			deepSeekApiKey,
			mistralApiKey,
			mistralCodestralUrl,
			azureApiVersion,
			openAiStreamingEnabled,
			openRouterModelId,
			openRouterModelInfo,
			openRouterBaseUrl,
			openRouterUseMiddleOutTransform,
			lastShownAnnouncementId,
			customInstructions,
			alwaysAllowReadOnly,
			alwaysAllowWrite,
			alwaysAllowExecute,
			alwaysAllowBrowser,
			alwaysAllowMcp,
			alwaysAllowModeSwitch,
			taskHistory,
			allowedCommands,
			soundEnabled,
			diffEnabled,
			checkpointsEnabled,
			soundVolume,
			browserViewportSize,
			fuzzyMatchThreshold,
			preferredLanguage,
			writeDelayMs,
			screenshotQuality,
			terminalOutputLineLimit,
			mcpEnabled,
			enableMcpServerCreation,
			alwaysApproveResubmit,
			requestDelaySeconds,
			rateLimitSeconds,
			currentApiConfigName,
			listApiConfigMeta,
			vsCodeLmModelSelector,
			mode,
			modeApiConfigs,
			customModePrompts,
			customSupportPrompts,
			enhancementApiConfigId,
			autoApprovalEnabled,
			customModes,
			experiments,
			unboundApiKey,
			unboundModelId,
			unboundModelInfo,
			requestyApiKey,
			requestyModelId,
			requestyModelInfo,
			modelTemperature,
			maxOpenTabsContext,
		] = await Promise.all([
			this.getGlobalState("apiProvider"),
			this.getGlobalState("apiModelId"),
			this.getSecret("apiKey"),
			this.getSecret("glamaApiKey"),
			this.getGlobalState("glamaModelId"),
			this.getGlobalState("glamaModelInfo"),
			this.getSecret("openRouterApiKey"),
			this.getSecret("awsAccessKey"),
			this.getSecret("awsSecretKey"),
			this.getSecret("awsSessionToken"),
			this.getGlobalState("awsRegion"),
			this.getGlobalState("awsUseCrossRegionInference"),
			this.getGlobalState("awsProfile"),
			this.getGlobalState("awsUseProfile"),
			this.getGlobalState("vertexProjectId"),
			this.getGlobalState("vertexRegion"),
			this.getGlobalState("openAiBaseUrl"),
			this.getSecret("openAiApiKey"),
			this.getGlobalState("openAiModelId"),
			this.getGlobalState("openAiCustomModelInfo"),
			this.getGlobalState("openAiUseAzure"),
			this.getGlobalState("ollamaModelId"),
			this.getGlobalState("ollamaBaseUrl"),
			this.getGlobalState("lmStudioModelId"),
			this.getGlobalState("lmStudioBaseUrl"),
			this.getGlobalState("anthropicBaseUrl"),
			this.getSecret("geminiApiKey"),
			this.getSecret("openAiNativeApiKey"),
			this.getSecret("deepSeekApiKey"),
			this.getSecret("mistralApiKey"),
			this.getGlobalState("mistralCodestralUrl"),
			this.getGlobalState("azureApiVersion"),
			this.getGlobalState("openAiStreamingEnabled"),
			this.getGlobalState("openRouterModelId"),
			this.getGlobalState("openRouterModelInfo"),
			this.getGlobalState("openRouterBaseUrl"),
			this.getGlobalState("openRouterUseMiddleOutTransform"),
			this.getGlobalState("lastShownAnnouncementId"),
			this.getGlobalState("customInstructions"),
			this.getGlobalState("alwaysAllowReadOnly"),
			this.getGlobalState("alwaysAllowWrite"),
			this.getGlobalState("alwaysAllowExecute"),
			this.getGlobalState("alwaysAllowBrowser"),
			this.getGlobalState("alwaysAllowMcp"),
			this.getGlobalState("alwaysAllowModeSwitch"),
			this.getGlobalState("taskHistory"),
			this.getGlobalState("allowedCommands"),
			this.getGlobalState("soundEnabled"),
			this.getGlobalState("diffEnabled"),
			this.getGlobalState("checkpointsEnabled"),
			this.getGlobalState("soundVolume"),
			this.getGlobalState("browserViewportSize"),
			this.getGlobalState("fuzzyMatchThreshold"),
			this.getGlobalState("preferredLanguage"),
			this.getGlobalState("writeDelayMs"),
			this.getGlobalState("screenshotQuality"),
			this.getGlobalState("terminalOutputLineLimit"),
			this.getGlobalState("mcpEnabled"),
			this.getGlobalState("enableMcpServerCreation"),
			this.getGlobalState("alwaysApproveResubmit"),
			this.getGlobalState("requestDelaySeconds"),
			this.getGlobalState("rateLimitSeconds"),
			this.getGlobalState("currentApiConfigName"),
			this.getGlobalState("listApiConfigMeta"),
			this.getGlobalState("vsCodeLmModelSelector"),
			this.getGlobalState("mode"),
			this.getGlobalState("modeApiConfigs"),
			this.getGlobalState("customModePrompts"),
			this.getGlobalState("customSupportPrompts"),
			this.getGlobalState("enhancementApiConfigId"),
			this.getGlobalState("autoApprovalEnabled"),
			this.getGlobalState("customModes"),
			this.getGlobalState("experiments"),
			this.getSecret("unboundApiKey"),
			this.getGlobalState("unboundModelId"),
			this.getGlobalState("unboundModelInfo"),
			this.getSecret("requestyApiKey"),
			this.getGlobalState("requestyModelId"),
			this.getGlobalState("requestyModelInfo"),
			this.getGlobalState("modelTemperature"),
			this.getGlobalState("maxOpenTabsContext"),
		])

		let apiProvider: ApiProvider
		if (storedApiProvider) {
			apiProvider = storedApiProvider
		} else {
			// Either new user or legacy user that doesn't have the apiProvider stored in state
			if (apiKey) {
				apiProvider = "anthropic"
			} else {
				// New users should default to openrouter
				apiProvider = "openrouter"
			}
		}

		return {
			apiConfiguration: {
				apiProvider,
				apiModelId,
				apiKey,
				glamaApiKey,
				glamaModelId,
				glamaModelInfo,
				openRouterApiKey,
				awsAccessKey,
				awsSecretKey,
				awsSessionToken,
				awsRegion,
				awsUseCrossRegionInference,
				awsProfile,
				awsUseProfile,
				vertexProjectId,
				vertexRegion,
				openAiBaseUrl,
				openAiApiKey,
				openAiModelId,
				openAiCustomModelInfo,
				openAiUseAzure,
				ollamaModelId,
				ollamaBaseUrl,
				lmStudioModelId,
				lmStudioBaseUrl,
				anthropicBaseUrl,
				geminiApiKey,
				openAiNativeApiKey,
				deepSeekApiKey,
				mistralApiKey,
				mistralCodestralUrl,
				azureApiVersion,
				openAiStreamingEnabled,
				openRouterModelId,
				openRouterModelInfo,
				openRouterBaseUrl,
				openRouterUseMiddleOutTransform,
				vsCodeLmModelSelector,
				unboundApiKey,
				unboundModelId,
				unboundModelInfo,
				requestyApiKey,
				requestyModelId,
				requestyModelInfo,
				modelTemperature,
			},
			lastShownAnnouncementId,
			customInstructions,
			alwaysAllowReadOnly: alwaysAllowReadOnly ?? false,
			alwaysAllowWrite: alwaysAllowWrite ?? false,
			alwaysAllowExecute: alwaysAllowExecute ?? false,
			alwaysAllowBrowser: alwaysAllowBrowser ?? false,
			alwaysAllowMcp: alwaysAllowMcp ?? false,
			alwaysAllowModeSwitch: alwaysAllowModeSwitch ?? false,
			taskHistory,
			allowedCommands,
			soundEnabled: soundEnabled ?? false,
			diffEnabled: diffEnabled ?? true,
			checkpointsEnabled: checkpointsEnabled ?? false,
			soundVolume,
			browserViewportSize: browserViewportSize ?? "900x600",
			screenshotQuality: screenshotQuality ?? 75,
			fuzzyMatchThreshold: fuzzyMatchThreshold ?? 1.0,
			writeDelayMs: writeDelayMs ?? 1000,
			terminalOutputLineLimit: terminalOutputLineLimit ?? 500,
			mode: mode ?? "code",
			preferredLanguage:
				preferredLanguage ??
				(() => {
					// Get VSCode's locale setting
					const vscodeLang = vscode.env.language
					// Map VSCode locale to our supported languages
					const langMap: { [key: string]: string } = {
						en: "English",
						ar: "Arabic",
						"pt-br": "Brazilian Portuguese",
						cs: "Czech",
						fr: "French",
						de: "German",
						hi: "Hindi",
						hu: "Hungarian",
						it: "Italian",
						ja: "Japanese",
						ko: "Korean",
						pl: "Polish",
						pt: "Portuguese",
						ru: "Russian",
						zh: "Simplified Chinese",
						"zh-cn": "Simplified Chinese",
						es: "Spanish",
						"zh-tw": "Traditional Chinese",
						tr: "Turkish",
					}
					// Return mapped language or default to English
					return langMap[vscodeLang] ?? langMap[vscodeLang.split("-")[0]] ?? "English"
				})(),
			mcpEnabled: mcpEnabled ?? true,
			enableMcpServerCreation: enableMcpServerCreation ?? true,
			alwaysApproveResubmit: alwaysApproveResubmit ?? false,
			requestDelaySeconds: Math.max(5, requestDelaySeconds ?? 10),
			rateLimitSeconds: rateLimitSeconds ?? 0,
			currentApiConfigName: currentApiConfigName ?? "default",
			listApiConfigMeta: listApiConfigMeta ?? [],
			modeApiConfigs: modeApiConfigs ?? ({} as Record<Mode, string>),
			customModePrompts: customModePrompts ?? {},
			customSupportPrompts: customSupportPrompts ?? {},
			enhancementApiConfigId,
			experiments: experiments ?? experimentDefault,
			autoApprovalEnabled: autoApprovalEnabled ?? false,
			customModes,
			maxOpenTabsContext: maxOpenTabsContext ?? 20,
		}
	}

	// Update API configuration settings
	async updateApiConfiguration(apiConfiguration: ApiConfiguration): Promise<void> {
		const {
			apiProvider,
			apiModelId,
			apiKey,
			glamaModelId,
			glamaModelInfo,
			glamaApiKey,
			openRouterApiKey,
			awsAccessKey,
			awsSecretKey,
			awsSessionToken,
			awsRegion,
			awsUseCrossRegionInference,
			awsProfile,
			awsUseProfile,
			vertexProjectId,
			vertexRegion,
			openAiBaseUrl,
			openAiApiKey,
			openAiModelId,
			openAiCustomModelInfo,
			openAiUseAzure,
			ollamaModelId,
			ollamaBaseUrl,
			lmStudioModelId,
			lmStudioBaseUrl,
			anthropicBaseUrl,
			geminiApiKey,
			openAiNativeApiKey,
			deepSeekApiKey,
			azureApiVersion,
			openAiStreamingEnabled,
			openRouterModelId,
			openRouterBaseUrl,
			openRouterModelInfo,
			openRouterUseMiddleOutTransform,
			vsCodeLmModelSelector,
			mistralApiKey,
			mistralCodestralUrl,
			unboundApiKey,
			unboundModelId,
			unboundModelInfo,
			requestyApiKey,
			requestyModelId,
			requestyModelInfo,
			modelTemperature,
		} = apiConfiguration

		await Promise.all([
			this.updateGlobalState("apiProvider", apiProvider),
			this.updateGlobalState("apiModelId", apiModelId),
			this.storeSecret("apiKey", apiKey),
			this.updateGlobalState("glamaModelId", glamaModelId),
			this.updateGlobalState("glamaModelInfo", glamaModelInfo),
			this.storeSecret("glamaApiKey", glamaApiKey),
			this.storeSecret("openRouterApiKey", openRouterApiKey),
			this.storeSecret("awsAccessKey", awsAccessKey),
			this.storeSecret("awsSecretKey", awsSecretKey),
			this.storeSecret("awsSessionToken", awsSessionToken),
			this.updateGlobalState("awsRegion", awsRegion),
			this.updateGlobalState("awsUseCrossRegionInference", awsUseCrossRegionInference),
			this.updateGlobalState("awsProfile", awsProfile),
			this.updateGlobalState("awsUseProfile", awsUseProfile),
			this.updateGlobalState("vertexProjectId", vertexProjectId),
			this.updateGlobalState("vertexRegion", vertexRegion),
			this.updateGlobalState("openAiBaseUrl", openAiBaseUrl),
			this.storeSecret("openAiApiKey", openAiApiKey),
			this.updateGlobalState("openAiModelId", openAiModelId),
			this.updateGlobalState("openAiCustomModelInfo", openAiCustomModelInfo),
			this.updateGlobalState("openAiUseAzure", openAiUseAzure),
			this.updateGlobalState("ollamaModelId", ollamaModelId),
			this.updateGlobalState("ollamaBaseUrl", ollamaBaseUrl),
			this.updateGlobalState("lmStudioModelId", lmStudioModelId),
			this.updateGlobalState("lmStudioBaseUrl", lmStudioBaseUrl),
			this.updateGlobalState("anthropicBaseUrl", anthropicBaseUrl),
			this.storeSecret("geminiApiKey", geminiApiKey),
			this.storeSecret("openAiNativeApiKey", openAiNativeApiKey),
			this.storeSecret("deepSeekApiKey", deepSeekApiKey),
			this.updateGlobalState("azureApiVersion", azureApiVersion),
			this.updateGlobalState("openAiStreamingEnabled", openAiStreamingEnabled),
			this.updateGlobalState("openRouterModelId", openRouterModelId),
			this.updateGlobalState("openRouterModelInfo", openRouterModelInfo),
			this.updateGlobalState("openRouterBaseUrl", openRouterBaseUrl),
			this.updateGlobalState("openRouterUseMiddleOutTransform", openRouterUseMiddleOutTransform),
			this.updateGlobalState("vsCodeLmModelSelector", vsCodeLmModelSelector),
			this.storeSecret("mistralApiKey", mistralApiKey),
			this.updateGlobalState("mistralCodestralUrl", mistralCodestralUrl),
			this.storeSecret("unboundApiKey", unboundApiKey),
			this.updateGlobalState("unboundModelId", unboundModelId),
			this.updateGlobalState("unboundModelInfo", unboundModelInfo),
			this.storeSecret("requestyApiKey", requestyApiKey),
			this.updateGlobalState("requestyModelId", requestyModelId),
			this.updateGlobalState("requestyModelInfo", requestyModelInfo),
			this.updateGlobalState("modelTemperature", modelTemperature),
		])
	}

	// Update custom instructions
	async updateCustomInstructions(instructions?: string): Promise<void> {
		await this.updateGlobalState("customInstructions", instructions || undefined)
	}

	// Update task history
	async updateTaskHistory(item: HistoryItem): Promise<HistoryItem[]> {
		const history = ((await this.getGlobalState("taskHistory")) as HistoryItem[] | undefined) || []
		const existingItemIndex = history.findIndex((h) => h.id === item.id)

		if (existingItemIndex !== -1) {
			history[existingItemIndex] = item
		} else {
			history.push(item)
		}

		await this.updateGlobalState("taskHistory", history)
		return history
	}

	// Method to reset all settings
	async resetAllSettings(): Promise<void> {
		// Clear all global state keys
		for (const key of this.context.globalState.keys()) {
			await this.context.globalState.update(key, undefined)
		}

		// Clear all secrets
		const secretKeys: SecretKey[] = [
			"apiKey",
			"glamaApiKey",
			"openRouterApiKey",
			"awsAccessKey",
			"awsSecretKey",
			"awsSessionToken",
			"openAiApiKey",
			"geminiApiKey",
			"openAiNativeApiKey",
			"deepSeekApiKey",
			"mistralApiKey",
			"unboundApiKey",
			"requestyApiKey",
		]

		for (const key of secretKeys) {
			await this.storeSecret(key, undefined)
		}
	}
}
```

### Step 2: Create Unit Tests for SettingsManager

Create a new file `src/core/settings/__tests__/SettingsManager.test.ts`:

```typescript
import * as vscode from "vscode"
import { SettingsManager } from "../SettingsManager"

// Mock vscode
jest.mock("vscode", () => ({
	ExtensionContext: jest.fn(),
}))

describe("SettingsManager", () => {
	let settingsManager: SettingsManager
	let mockContext: any

	beforeEach(() => {
		// Create mock context
		mockContext = {
			globalState: {
				get: jest.fn(),
				update: jest.fn(),
				keys: jest.fn().mockReturnValue([]),
			},
			secrets: {
				get: jest.fn(),
				store: jest.fn(),
				delete: jest.fn(),
			},
		}

		settingsManager = new SettingsManager(mockContext as unknown as vscode.ExtensionContext)
	})

	describe("updateGlobalState", () => {
		it("should update global state", async () => {
			await settingsManager.updateGlobalState("apiProvider", "openai")
			expect(mockContext.globalState.update).toHaveBeenCalledWith("apiProvider", "openai")
		})
	})

	describe("getGlobalState", () => {
		it("should get global state", async () => {
			mockContext.globalState.get.mockReturnValue("openai")
			const result = await settingsManager.getGlobalState("apiProvider")
			expect(mockContext.globalState.get).toHaveBeenCalledWith("apiProvider")
			expect(result).toBe("openai")
		})
	})

	describe("storeSecret", () => {
		it("should store secret", async () => {
			await settingsManager.storeSecret("apiKey", "test-key")
			expect(mockContext.secrets.store).toHaveBeenCalledWith("apiKey", "test-key")
		})

		it("should delete secret when value is undefined", async () => {
			await settingsManager.storeSecret("apiKey", undefined)
			expect(mockContext.secrets.delete).toHaveBeenCalledWith("apiKey")
		})
	})

	describe("getSecret", () => {
		it("should get secret", async () => {
			mockContext.secrets.get.mockReturnValue("test-key")
			const result = await settingsManager.getSecret("apiKey")
			expect(mockContext.secrets.get).toHaveBeenCalledWith("apiKey")
			expect(result).toBe("test-key")
		})
	})

	// Add more tests for other methods
})
```

### Step 3: Modify ClineProvider to Use SettingsManager

Update `src/core/webview/ClineProvider.ts` to use the new SettingsManager:

1. Add import for SettingsManager:

```typescript
import { SettingsManager } from "../settings/SettingsManager"
```

2. Add SettingsManager property to ClineProvider:

```typescript
export class ClineProvider implements vscode.WebviewViewProvider {
	// ... existing properties

	private settingsManager: SettingsManager

	constructor(
		readonly context: vscode.ExtensionContext,
		private readonly outputChannel: vscode.OutputChannel,
	) {
		// ... existing initialization

		// Initialize SettingsManager
		this.settingsManager = new SettingsManager(this.context)

		// ... rest of initialization
	}

	// ... rest of class
}
```

3. Replace settings methods with calls to SettingsManager:

```typescript
async updateGlobalState(key: GlobalStateKey, value: any) {
    await this.settingsManager.updateGlobalState(key, value)
}

async getGlobalState(key: GlobalStateKey) {
    return await this.settingsManager.getGlobalState(key)
}

public async storeSecret(key: SecretKey, value?: string) {
    await this.settingsManager.storeSecret(key, value)
}

private async getSecret(key: SecretKey) {
    return await this.settingsManager.getSecret(key)
}

async getState() {
    return await this.settingsManager.getAllSettings()
}

async updateCustomInstructions(instructions?: string) {
    await this.settingsManager.updateCustomInstructions(instructions)
    if (this.cline) {
        this.cline.customInstructions = instructions || undefined
    }
    await this.postStateToWebview()
}

async updateTaskHistory(item: HistoryItem): Promise<HistoryItem[]> {
    return await this.settingsManager.updateTaskHistory(item)
}

async resetState() {
    const answer = await vscode.window.showInformationMessage(
        "Are you sure you want to reset all state and secret storage in the extension? This cannot be undone.",
        { modal: true },
        "Yes",
    )

    if (answer !== "Yes") {
        return
    }

    await this.settingsManager.resetAllSettings()
    await this.configManager.resetAllConfigs()
    await this.customModesManager.resetCustomModes()

    if (this.cline) {
        this.cline.abortTask()
        this.cline = undefined
    }

    await this.postStateToWebview()
    await this.postMessageToWebview({ type: "action", action: "chatButtonClicked" })
}
```

4. Update the `updateApiConfiguration` method:

```typescript
async updateApiConfiguration(apiConfiguration: ApiConfiguration) {
    // Update mode's default config
    const { mode } = await this.getState()
    if (mode) {
        const currentApiConfigName = await this.settingsManager.getGlobalState("currentApiConfigName")
        const listApiConfig = await this.configManager.listConfig()
        const config = listApiConfig?.find((c) => c.name === currentApiConfigName)
        if (config?.id) {
            await this.configManager.setModeConfig(mode, config.id)
        }
    }

    // Use SettingsManager to update API configuration
    await this.settingsManager.updateApiConfiguration(apiConfiguration)

    if (this.cline) {
        this.cline.api = buildApiHandler(apiConfiguration)
    }
}
```

5. Update the `getStateToPostToWebview` method:

```typescript
async getStateToPostToWebview() {
    // Get all settings from SettingsManager
    const settings = await this.settingsManager.getAllSettings()

    // Add additional properties needed for the webview
    const allowedCommands = vscode.workspace.getConfiguration("roo-cline").get<string[]>("allowedCommands") || []

    return {
        version: this.context.extension?.packageJSON?.version ?? "",
        ...settings,
        currentTaskItem: this.cline?.taskId
            ? (settings.taskHistory || []).find((item) => item.id === this.cline?.taskId)
            : undefined,
        clineMessages: this.cline?.clineMessages || [],
        allowedCommands,
        mcpServers: this.mcpHub?.getAllServers() ?? [],
    }
}
```

6. Update the `setWebviewMessageListener` method to use the SettingsManager for handling settings-related messages:

```typescript
private setWebviewMessageListener(webview: vscode.Webview) {
    webview.onDidReceiveMessage(
        async (message: WebviewMessage) => {
            switch (message.type) {
                // ... existing cases

                case "customInstructions":
                    await this.updateCustomInstructions(message.text)
                    break;

                case "alwaysAllowReadOnly":
                    await this.settingsManager.updateGlobalState("alwaysAllowReadOnly", message.bool ?? undefined)
                    await this.postStateToWebview()
                    break;

                // ... update other settings-related cases to use SettingsManager

                // ... other cases remain unchanged
            }
        },
        null,
        this.disposables
    )
}
```

### Step 4: Update Files That Interact with ClineProvider

Update any files that directly interact with ClineProvider's settings methods to use the new SettingsManager:

1. `src/core/Cline.ts`:

    - Update references to ClineProvider's settings methods if any

2. `src/exports/index.ts`:

    - Update the API creation to use SettingsManager if needed

3. `src/services/mcp/McpServerManager.ts`:

    - Update if it interacts with settings through ClineProvider

4. `src/services/mcp/McpHub.ts`:
    - Update if it interacts with settings through ClineProvider

### Step 5: Testing

1. **Unit Tests**:

    - Run the unit tests for SettingsManager to ensure it works correctly
    - Update any existing tests that mock ClineProvider's settings methods

2. **Integration Tests**:

    - Test the ClineProvider with the SettingsManager to ensure they work together correctly
    - Test setting and getting various settings through the ClineProvider
    - Test the webview interaction with settings

3. **Manual Testing**:
    - Test the extension UI to ensure settings are correctly displayed and updated
    - Test saving and loading settings
    - Test resetting settings

## Files to Update

Here's a comprehensive list of all the files we'll need to create or modify for the SettingsManager refactoring:

### New Files to Create

1. **`src/core/settings/SettingsManager.ts`**

    - The main SettingsManager class implementation
    - Contains all methods for managing settings

2. **`src/core/settings/__tests__/SettingsManager.test.ts`**
    - Unit tests for the SettingsManager class

### Existing Files to Modify

1. **`src/core/webview/ClineProvider.ts`** (primary file)

    - Update to use SettingsManager
    - Remove duplicated settings management code
    - Update methods that interact with settings

2. **`src/extension.ts`** (if needed)

    - Update to initialize SettingsManager if needed
    - Pass SettingsManager to ClineProvider if needed

3. **`src/core/Cline.ts`** (if needed)

    - Update references to ClineProvider's settings methods if any
    - May need to update how it accesses settings

4. **`src/exports/index.ts`** (if needed)

    - Update the API creation to use SettingsManager if needed

5. **`src/services/mcp/McpServerManager.ts`** (if needed)

    - Update if it interacts with settings through ClineProvider

6. **`src/services/mcp/McpHub.ts`** (if needed)
    - Update if it interacts with settings through ClineProvider

## Benefits and Impact

### Benefits

1. **Reduced Complexity**: The ClineProvider class will be significantly smaller and more focused
2. **Improved Maintainability**: Settings-related code will be centralized in one place
3. **Better Separation of Concerns**: Clear boundaries between components
4. **Easier Testing**: Isolated components are easier to test
5. **Simplified Extension**: Future settings additions will be more straightforward

### Impact

The primary impact will be on `ClineProvider.ts`, which will be significantly simplified by moving all settings-related code to the SettingsManager. The other files will have more minor changes, mostly updating how they access settings.

The most critical part of the refactoring will be ensuring that all settings are correctly migrated to the SettingsManager and that all components that use settings are updated to use the new approach.

## Addressing Additional Concerns

Based on a thorough review of the refactoring plan, the following additional concerns and recommendations should be addressed:

### 1. Documentation for Adding New Settings

The process for adding new settings as documented in `cline_docs/settings.md` will need to be updated to reflect the new architecture. After implementing the SettingsManager, we should:

- Update the documentation to explain how to add new settings to the SettingsManager
- Include examples of adding different types of settings (global state vs. secrets)
- Document the process for updating the GlobalStateKey and SecretKey types
- Provide guidance on how to set default values for new settings

### 2. WebviewMessage Handling

The plan should be more specific about how each settings-related message type will be handled in the `setWebviewMessageListener` method. For example:

```typescript
private setWebviewMessageListener(webview: vscode.Webview) {
    webview.onDidReceiveMessage(
        async (message: WebviewMessage) => {
            switch (message.type) {
                // Settings-related cases
                case "customInstructions":
                    await this.updateCustomInstructions(message.text)
                    break;

                case "alwaysAllowReadOnly":
                    await this.settingsManager.updateGlobalState("alwaysAllowReadOnly", message.bool ?? undefined)
                    await this.postStateToWebview()
                    break;

                case "alwaysAllowWrite":
                    await this.settingsManager.updateGlobalState("alwaysAllowWrite", message.bool ?? undefined)
                    await this.postStateToWebview()
                    break;

                case "alwaysAllowExecute":
                    await this.settingsManager.updateGlobalState("alwaysAllowExecute", message.bool ?? undefined)
                    await this.postStateToWebview()
                    break;

                case "alwaysAllowBrowser":
                    await this.settingsManager.updateGlobalState("alwaysAllowBrowser", message.bool ?? undefined)
                    await this.postStateToWebview()
                    break;

                case "alwaysAllowMcp":
                    await this.settingsManager.updateGlobalState("alwaysAllowMcp", message.bool ?? undefined)
                    await this.postStateToWebview()
                    break;

                case "alwaysAllowModeSwitch":
                    await this.settingsManager.updateGlobalState("alwaysAllowModeSwitch", message.bool ?? undefined)
                    await this.postStateToWebview()
                    break;

                case "soundEnabled":
                    await this.settingsManager.updateGlobalState("soundEnabled", message.bool ?? undefined)
                    await this.postStateToWebview()
                    break;

                case "diffEnabled":
                    await this.settingsManager.updateGlobalState("diffEnabled", message.bool ?? undefined)
                    await this.postStateToWebview()
                    break;

                // ... other settings-related cases

                // ... other cases remain unchanged
            }
        },
        null,
        this.disposables
    )
}
```

### 3. Mode-Specific Settings

The plan should clarify how mode-specific settings (like `modeApiConfigs`) will be handled in the new architecture, especially since these settings interact with both the ConfigManager and SettingsManager:

```typescript
// In SettingsManager.ts
async getModeApiConfig(mode: Mode): Promise<string | undefined> {
    const modeApiConfigs = await this.getGlobalState("modeApiConfigs") as Record<Mode, string> | undefined
    return modeApiConfigs?.[mode]
}

async setModeApiConfig(mode: Mode, configId: string): Promise<void> {
    const modeApiConfigs = (await this.getGlobalState("modeApiConfigs") as Record<Mode, string>) || {}
    modeApiConfigs[mode] = configId
    await this.updateGlobalState("modeApiConfigs", modeApiConfigs)
}

// In ClineProvider.ts
async updateMode(mode: Mode) {
    await this.settingsManager.updateGlobalState("mode", mode)

    // Get the API config ID for this mode
    const modeApiConfigs = await this.settingsManager.getGlobalState("modeApiConfigs") as Record<Mode, string> | undefined
    const configId = modeApiConfigs?.[mode]

    if (configId) {
        const config = await this.configManager.getConfig(configId)
        if (config) {
            await this.updateApiConfiguration(config.apiConfiguration)
        }
    }

    await this.postStateToWebview()
}
```

### 4. Migration Strategy

The plan should include a migration strategy for existing users to ensure a smooth transition:

1. **Backward Compatibility**: Ensure that the SettingsManager can read existing settings stored by ClineProvider
2. **Gradual Rollout**: Consider a phased approach where both systems coexist temporarily
3. **Data Validation**: Validate existing settings during migration to ensure they meet expected formats
4. **Fallback Mechanism**: Provide fallback values if existing settings are missing or invalid
5. **User Communication**: Inform users about the changes and any actions they need to take

### 5. Error Handling

The plan should include more details on error handling in the SettingsManager, especially for operations that might fail:

```typescript
async updateGlobalState(key: GlobalStateKey, value: any): Promise<void> {
    try {
        await this.context.globalState.update(key, value)
    } catch (error) {
        console.error(`Failed to update global state for key ${key}:`, error)
        throw new Error(`Failed to update setting: ${key}`)
    }
}

async getGlobalState(key: GlobalStateKey): Promise<any> {
    try {
        return await this.context.globalState.get(key)
    } catch (error) {
        console.error(`Failed to get global state for key ${key}:`, error)
        return undefined
    }
}

async storeSecret(key: SecretKey, value?: string): Promise<void> {
    try {
        if (value) {
            await this.context.secrets.store(key, value)
        } else {
            await this.context.secrets.delete(key)
        }
    } catch (error) {
        console.error(`Failed to store secret for key ${key}:`, error)
        throw new Error(`Failed to store secret: ${key}`)
    }
}
```

## Enhanced Implementation Plan

### 1. Define a Settings Interface

Define a clear interface for the settings object returned by `getAllSettings()` to ensure type safety throughout the application:

```typescript
// In SettingsManager.ts
export interface Settings {
    apiConfiguration: ApiConfiguration;
    lastShownAnnouncementId?: string;
    customInstructions?: string;
    alwaysAllowReadOnly: boolean;
    alwaysAllowWrite: boolean;
    alwaysAllowExecute: boolean;
    alwaysAllowBrowser: boolean;
    alwaysAllowMcp: boolean;
    alwaysAllowModeSwitch: boolean;
    taskHistory?: HistoryItem[];
    allowedCommands?: string[];
    soundEnabled: boolean;
    diffEnabled: boolean;
    checkpointsEnabled: boolean;
    soundVolume?: number;
    browserViewportSize: string;
    screenshotQuality: number;
    fuzzyMatchThreshold: number;
    writeDelayMs: number;
    terminalOutputLineLimit: number;
    mode: Mode;
    preferredLanguage: string;
    mcpEnabled: boolean;
    enableMcpServerCreation: boolean;
    alwaysApproveResubmit: boolean;
    requestDelaySeconds: number;
    rateLimitSeconds: number;
    currentApiConfigName: string;
    listApiConfigMeta?: ApiConfigMeta[];
    modeApiConfigs: Record<Mode, string>;
    customModePrompts: CustomModePrompts;
    customSupportPrompts: CustomSupportPrompts;
    enhancementApiConfigId?: string;
    experiments: Record<ExperimentId, boolean>;
    autoApprovalEnabled: boolean;
    customModes?: ModeConfig[];
    maxOpenTabsContext: number;
}

// Update the return type of getAllSettings
async getAllSettings(): Promise<Settings> {
    // ... existing implementation
}
```

### 2. Implement Settings Events

Implement an event system in SettingsManager to notify subscribers when settings change:

```typescript
// In SettingsManager.ts
export type SettingsChangeEvent = {
    key: GlobalStateKey;
    value: any;
};

export class SettingsManager {
    private readonly _onDidChangeSettings = new vscode.EventEmitter<SettingsChangeEvent>();
    public readonly onDidChangeSettings = this._onDidChangeSettings.event;

    // ... existing implementation

    async updateGlobalState(key: GlobalStateKey, value: any): Promise<void> {
        try {
            await this.context.globalState.update(key, value)
            this._onDidChangeSettings.fire({ key, value })
        } catch (error) {
            console.error(`Failed to update global state for key ${key}:`, error)
            throw new Error(`Failed to update setting: ${key}`)
        }
    }

    // ... rest of implementation
}

// In ClineProvider.ts
constructor(
    readonly context: vscode.ExtensionContext,
    private readonly outputChannel: vscode.OutputChannel,
) {
    // ... existing initialization

    // Initialize SettingsManager
    this.settingsManager = new SettingsManager(this.context)

    // Subscribe to settings changes
    this.disposables.push(
        this.settingsManager.onDidChangeSettings(async (event) => {
            // Handle specific settings changes
            if (event.key === "mode") {
                // Handle mode change
                if (this.cline) {
                    this.cline.mode = event.value
                }
            } else if (event.key === "customInstructions") {
                // Handle custom instructions change
                if (this.cline) {
                    this.cline.customInstructions = event.value
                }
            }

            // Update webview with new settings
            await this.postStateToWebview()
        })
    )

    // ... rest of initialization
}
```

### 3. Add JSDoc Comments

Add JSDoc comments to the SettingsManager methods to document their purpose, parameters, and return values:

```typescript
/**
 * Manages settings for the extension, including global state and secrets.
 */
export class SettingsManager {
	/**
	 * Creates a new SettingsManager instance.
	 * @param context The extension context
	 */
	constructor(private readonly context: vscode.ExtensionContext) {}

	/**
	 * Updates a global state setting.
	 * @param key The key of the setting to update
	 * @param value The new value of the setting
	 * @throws Error if the update fails
	 */
	async updateGlobalState(key: GlobalStateKey, value: any): Promise<void> {
		// ... implementation
	}

	/**
	 * Gets a global state setting.
	 * @param key The key of the setting to get
	 * @returns The value of the setting, or undefined if it doesn't exist
	 */
	async getGlobalState(key: GlobalStateKey): Promise<any> {
		// ... implementation
	}

	// ... other methods with JSDoc comments
}
```

## Future Improvements

After implementing the SettingsManager with the enhancements above, we can consider further improvements:

1. **Settings Validation**: Add validation for settings to ensure they meet expected formats and constraints
2. **Settings Migration**: Add support for migrating settings between versions
3. **Settings Backup/Restore**: Add support for backing up and restoring settings
4. **Settings UI**: Create a dedicated settings UI component that uses the SettingsManager
5. **Settings Profiles**: Allow users to create and switch between different settings profiles
6. **Settings Sync**: Integrate with VS Code's settings sync feature

## Conclusion

Extracting the SettingsManager from ClineProvider is a significant step toward improving the maintainability of the codebase. By centralizing settings management in a dedicated class, we make the code more modular, easier to test, and simpler to extend in the future.

With the additional enhancements outlined above, the SettingsManager will be more robust, type-safe, and easier to use. This refactoring sets the stage for further improvements to the codebase, such as extracting other components from ClineProvider and creating a more modular architecture overall.
