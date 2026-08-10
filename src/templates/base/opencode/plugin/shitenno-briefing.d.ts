interface ChatOutput {
  message: { system?: string };
  parts: Array<{ type: string; text?: string }>;
}

interface PluginInstance {
  "chat.message"?: (input: unknown, output: ChatOutput) => Promise<void>;
}

declare const plugin: (input: { directory: string }) => Promise<PluginInstance>;

export default plugin;
