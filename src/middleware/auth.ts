import { Elysia } from 'elysia';
import { getApiKey, type ApiKey } from '../db/index.ts';

declare module 'elysia' {
  interface Request {
    apiKey: ApiKey;
  }
}

export const authMiddleware = new Elysia({ name: 'auth' })
  .derive({ as: 'scoped' }, async ({ request, set }) => {
    const key = request.headers.get('x-api-key') ?? request.headers.get('authorization')?.replace('Bearer ', '');

    if (!key) {
      set.status = 401;
      throw new Error('Missing X-API-Key header');
    }

    const apiKey = await getApiKey(key);
    if (!apiKey) {
      set.status = 401;
      throw new Error('Invalid or inactive API key');
    }

    return { apiKey };
  });
