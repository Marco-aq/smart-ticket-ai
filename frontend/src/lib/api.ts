export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`/api/backend${path}`, {
    ...options,
    cache: "no-store",
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  if (response.status === 204) return undefined as T;
  const data = await response.json();
  if (!response.ok) {
    const message =
      response.status === 429
        ? "Too many requests. Wait one minute and try again."
        : response.status === 401
          ? "Please sign in. Your session may have expired."
          : typeof data.detail === "string"
            ? data.detail
            : "Please check your input and try again.";
    throw new ApiError(response.status, message);
  }
  return data as T;
}

export type Prediction = {
  category: string;
  category_score: number;
  priority: string;
  priority_score: number;
  needs_review: boolean;
};
export type Ticket = {
  id: string;
  subject: string;
  description: string;
  predicted_category: string;
  predicted_priority: string;
  category_score: number;
  priority_score: number;
  needs_review: boolean;
  status: "open" | "in_progress" | "resolved";
  created_at: string;
};
export const statusLabels = {
  open: "Open",
  in_progress: "In progress",
  resolved: "Resolved",
};
export const dateLabel = (value: string) =>
  new Date(
    value.endsWith("Z") || /[+-]\d\d:\d\d$/.test(value) ? value : `${value}Z`,
  ).toLocaleString();
