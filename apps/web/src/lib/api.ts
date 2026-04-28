export type ApiSuccessResponse<TData> = {
  sucesso: true;
  statusCode: number;
  codigo: string;
  mensagem: string;
  caminho: string;
  timestamp: string;
  dados: TData;
};

type ApiErrorResponse = {
  sucesso: false;
  statusCode: number;
  codigo?: string;
  mensagem?: string;
  caminho?: string;
  timestamp?: string;
  detalhes?: unknown;
};

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  headers?: HeadersInit;
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

export async function apiRequest<TData>(
  path: string,
  options: RequestOptions = {},
): Promise<ApiSuccessResponse<TData>> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  let payload: ApiSuccessResponse<TData> | ApiErrorResponse | null = null;
  try {
    payload = (await response.json()) as ApiSuccessResponse<TData> | ApiErrorResponse;
  } catch {
    payload = null;
  }

  if (!response.ok || !payload || payload.sucesso !== true) {
    const errorPayload = payload as ApiErrorResponse | null;
    throw new Error(errorPayload?.mensagem ?? "Erro inesperado ao comunicar com a API.");
  }

  return payload;
}
