export type ApiError = {
  message: string;
  status?: number;
  details?: unknown;
};

export const toApiError = (error: unknown): ApiError => {
  if (typeof error === "object" && error !== null) {
    const anyErr = error as any;
    const status = anyErr?.response?.status;
    const msg =
      anyErr?.response?.data?.error ??
      anyErr?.message ??
      "Unexpected error occurred";
    return { message: msg, status, details: anyErr?.response?.data };
  }
  return { message: "Unexpected error occurred" };
};

