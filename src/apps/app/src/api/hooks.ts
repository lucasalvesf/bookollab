import { problemMessage } from './client';

/** Unwraps an openapi-fetch result: returns data or throws an Error with the API's message. */
export async function unwrap<T>(promise: Promise<{ data?: T; error?: unknown; response: Response }>, fallback = 'Algo deu errado.'): Promise<T> {
  const { data, error, response } = await promise;
  if (!response.ok) throw new Error(problemMessage(error) ?? fallback);
  return data as T;
}

export const labels = {
  joinPolicy: { Open: 'Aberta', Request: 'Com pedido de entrada', InviteOnly: 'Só por convite' } as const,
  sheetFieldType: { Text: 'Texto curto', LongText: 'Texto longo', Number: 'Número' } as const,
};
