import { handleUnauthorized } from './auth'

interface ApiErrorResponse {
  statusCode: number;
  message: string;
  type: string;
}

export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly type: string;

  constructor(statusCode: number, message: string, type: string) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.type = type;
  }
}

class HttpClient {
  private readonly baseUrl: string;

  constructor() {
    // Use internal API routes instead of external API
    this.baseUrl = "/api";
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (response.ok) {
      return await response.json();
    }

    // Check for 401 and handle logout
    if (handleUnauthorized(response.status)) {
      // Don't throw error if redirecting to login
      throw new ApiError(401, "Session expired", "UNAUTHORIZED");
    }

    // Try to parse the structured error response
    try {
      const errorData: Partial<ApiErrorResponse> = await response.json();
      throw new ApiError(
        errorData.statusCode || response.status,
        errorData.message || "Something went wrong, please, try again.",
        errorData.type || "SOMETHING_WENT_WRONG"
      );
    } catch (parseError) {
      // If JSON parsing fails, throw a generic error with default values
      if (parseError instanceof ApiError) {
        throw parseError;
      }
      throw new ApiError(
        response.status,
        "Something went wrong, please, try again.",
        "SOMETHING_WENT_WRONG"
      );
    }
  }

  async get<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
      cache: "no-store",
      ...options,
    });

    return this.handleResponse<T>(response);
  }

  async post<T>(endpoint: string, data?: unknown, options?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
      body: data ? JSON.stringify(data) : undefined,
      ...options,
    });

    return this.handleResponse<T>(response);
  }

  async postFormData<T>(endpoint: string, formData: FormData, options?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: "POST",
      headers: {
        // Don't set Content-Type for FormData, let the browser set it with boundary
        ...options?.headers,
      },
      body: formData,
      ...options,
    });

    return this.handleResponse<T>(response);
  }

  async put<T>(endpoint: string, data?: unknown, options?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
      body: data ? JSON.stringify(data) : undefined,
      ...options,
    });

    return this.handleResponse<T>(response);
  }

  async delete<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
      ...options,
    });

    return this.handleResponse<T>(response);
  }

  async patch<T>(endpoint: string, data?: unknown, options?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
      body: data ? JSON.stringify(data) : undefined,
      ...options,
    });

    return this.handleResponse<T>(response);
  }

  // Helper method for direct blob downloads
  async getBlob(endpoint: string, options?: RequestInit): Promise<Blob> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: "GET",
      headers: {
        ...options?.headers,
      },
      ...options,
    });

    if (!response.ok) {
      // Check for 401 and handle logout for blob requests too
      if (handleUnauthorized(response.status)) {
        throw new Error('Session expired');
      }
      throw new Error('Download failed');
    }

    return await response.blob();
  }
}

export const httpClient = new HttpClient(); 