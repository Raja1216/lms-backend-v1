export interface PagedResponse<T> {
  data: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export function createPagedResponse<T>(
  data: T[],
  page: number,
  limit: number,
  total: number
): PagedResponse<T> {
  const totalPages = Math.ceil(total / limit);
  return {
    data,
    page,
    limit,
    total,
    totalPages,
  };
}
