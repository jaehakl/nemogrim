export const queryKeys = {
  movies: {
    all: ['movies'] as const,
    list: () => ['movies', 'list'] as const,
    detail: (id: number) => ['movies', 'detail', id] as const,
    scenes: (id: number) => ['movies', 'scenes', id] as const,
  },
  scenes: {
    all: ['scenes'] as const,
    feeds: () => ['scenes', 'feed'] as const,
    feed: (query: string) => ['scenes', 'feed', query] as const,
    detail: (id: number) => ['scenes', 'detail', id] as const,
    similarAll: () => ['scenes', 'similar'] as const,
    similar: (id: number, status: string) => ['scenes', 'similar', id, status] as const,
  },
  ai: {
    status: ['ai', 'status'] as const,
  },
}
