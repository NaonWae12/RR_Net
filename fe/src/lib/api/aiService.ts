import { apiClient } from "./apiClient";

export interface AIConfig {
  provider: string;
  api_key: string;
  model: string;
  is_active: boolean;
}

export interface ExtractionResult {
  data: any[];
  confidence: number;
  highlights: string[];
}

export const aiService = {
  async getConfig(): Promise<AIConfig> {
    const res = await apiClient.get<AIConfig>("/ai/config");
    return res.data;
  },

  async saveConfig(config: AIConfig): Promise<void> {
    await apiClient.post("/ai/config", config);
  },

  async getAdminConfig(): Promise<AIConfig> {
    const res = await apiClient.get<AIConfig>("/superadmin/ai/config");
    return res.data;
  },

  async saveAdminConfig(config: AIConfig): Promise<void> {
    await apiClient.post("/superadmin/ai/config", config);
  },

  async extractFromImage(base64Image: string, prompt?: string): Promise<ExtractionResult> {
    const res = await apiClient.post<ExtractionResult>("/migration/extract-image", {
      image: base64Image,
      prompt: prompt
    }, {
      timeout: 3 * 60 * 1000 // 3 minutes — Ollama/Tesseract can be slow on CPU
    });
    return res.data;
  },

  async processImport(clients: any[]): Promise<void> {
    await apiClient.post("/migration/process", { clients });
  }
};
