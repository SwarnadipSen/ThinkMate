import { apiClient } from "@/lib/api-client";
import { API_BASE_URL, TOKEN_KEY } from "@/lib/constants";
import {
  LoginRequest,
  RegisterRequest,
  AuthResponse,
  User,
  Course,
  CreateCourseRequest,
  Document,
  ChatRequest,
  ChatResponse,
  ChatSource,
  Conversation,
  ConversationDetail,
  ExamGenerationRequest,
  MCQGenerationResponse,
  MCQEvaluationRequest,
  MCQEvaluationResponse,
  DescriptiveGenerationResponse,
  ExamExportRequest,
} from "@/types";

// Auth APIs
export const authApi = {
  register: (data: RegisterRequest) =>
    apiClient.post<User>("/auth/register", data),

  login: (data: LoginRequest) =>
    apiClient.post<AuthResponse>("/auth/login", data),

  getMe: () => apiClient.get<User>("/auth/me"),
};

// Course APIs
export const courseApi = {
  create: (data: CreateCourseRequest) =>
    apiClient.post<Course>("/courses", data),

  getAll: () => apiClient.get<Course[]>("/courses"),

  getById: (courseId: string) => apiClient.get<Course>(`/courses/${courseId}`),

  delete: (courseId: string) => apiClient.delete(`/courses/${courseId}`),
};

// Document APIs
export const documentApi = {
  upload: (courseId: string, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return apiClient.post<Document>(
      `/documents/courses/${courseId}/upload`,
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      },
    );
  },

  getAll: (courseId: string) =>
    apiClient.get<Document[]>(`/documents/courses/${courseId}/documents`),

  delete: (documentId: string) => apiClient.delete(`/documents/${documentId}`),
};

// Chat APIs
export const chatApi = {
  sendMessage: (data: ChatRequest) =>
    apiClient.post<ChatResponse>("/chat", data),

  streamMessage: async (
    data: ChatRequest,
    onChunk: (chunk: string) => void,
  ): Promise<{ conversation_id: string; sources: ChatSource[] }> => {
    const token =
      typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null;

    const response = await fetch(`${API_BASE_URL}/chat/stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      let detail = "Failed to send message";
      try {
        const errorPayload = (await response.json()) as { detail?: string };
        detail = errorPayload.detail || detail;
      } catch {
        // Ignore JSON parsing errors and keep fallback detail.
      }
      throw new Error(detail);
    }

    if (!response.body) {
      throw new Error("Streaming response is not available");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let donePayload: { conversation_id: string; sources: ChatSource[] } | null =
      null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        const event = JSON.parse(trimmed) as
          | { type: "chunk"; content: string }
          | { type: "done"; conversation_id: string; sources: ChatSource[] }
          | { type: "error"; detail: string };

        if (event.type === "chunk") {
          onChunk(event.content);
        }

        if (event.type === "error") {
          throw new Error(event.detail || "Streaming failed");
        }

        if (event.type === "done") {
          donePayload = {
            conversation_id: event.conversation_id,
            sources: event.sources || [],
          };
        }
      }
    }

    if (!donePayload) {
      throw new Error("Streaming ended without completion metadata");
    }

    return donePayload;
  },

  getHistory: () => apiClient.get<Conversation[]>("/chat/history"),

  getConversation: (conversationId: string) =>
    apiClient.get<ConversationDetail>(`/chat/history/${conversationId}`),

  deleteConversation: (conversationId: string) =>
    apiClient.delete(`/chat/history/${conversationId}`),
};

// Exam APIs
export const examApi = {
  generateMcq: (data: ExamGenerationRequest) =>
    apiClient.post<MCQGenerationResponse>("/exam/mcq/generate", data),

  evaluateMcq: (data: MCQEvaluationRequest) =>
    apiClient.post<MCQEvaluationResponse>("/exam/mcq/evaluate", data),

  generateDescriptive: (data: ExamGenerationRequest) =>
    apiClient.post<DescriptiveGenerationResponse>(
      "/exam/descriptive/generate",
      data,
    ),

  exportDescriptivePdf: (data: ExamExportRequest) =>
    apiClient.post<Blob>("/exam/descriptive/export-pdf", data, {
      responseType: "blob",
      headers: {
        "Content-Type": "application/json",
      },
    }),
};
