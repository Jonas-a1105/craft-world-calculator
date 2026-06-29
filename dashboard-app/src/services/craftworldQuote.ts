import { normalizeCraftWorldToken } from '../utils/craftWorldService';

const CW_GRAPHQL_URL = '/api/game';

export type CraftworldQuoteResult = {
  type: string;
  input: { symbol: string; amount: number };
  output: { symbol: string; amount: number };
  details?: { priceImpactPercentage?: number };
};

function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Origin': 'https://craft-world.gg',
    'Referer': 'https://craft-world.gg/',
    'x-app-version': '1.15.1',
  };
  try {
    const token = localStorage.getItem('cw-auth-token');
    if (token) {
      const normalized = normalizeCraftWorldToken(token);
      headers['Authorization'] = `Bearer ${normalized}`;
    }
  } catch {}
  return headers;
}

async function graphqlRequest<T>(query: string, variables: Record<string, any>): Promise<T> {
  const res = await fetch(CW_GRAPHQL_URL, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`GraphQL error: ${res.status}`);
  const json = await res.json();
  if (json.errors) throw new Error(json.errors[0]?.message || 'GraphQL error');
  return json.data as T;
}

export async function getExactInputQuote(inputSymbol: string, outputSymbol: string, inputAmount: number): Promise<CraftworldQuoteResult> {
  const normalizedInput = inputSymbol.trim().toUpperCase();
  const normalizedOutput = outputSymbol.trim().toUpperCase();
  if (normalizedInput === normalizedOutput) {
    return {
      type: 'EXACT_INPUT',
      input: { symbol: normalizedInput, amount: inputAmount },
      output: { symbol: normalizedOutput, amount: inputAmount },
      details: { priceImpactPercentage: 0 },
    };
  }
  const query = `
    query exactInputQuoteQuery($input: ExactInputInput!) {
      exactInputQuote(input: $input) {
        type
        input { symbol amount }
        output { symbol amount }
        details { priceImpactPercentage }
      }
    }
  `;
  const data = await graphqlRequest<{ exactInputQuote?: CraftworldQuoteResult }>(query, {
    input: { inputSymbol: normalizedInput, outputSymbol: normalizedOutput, inputAmount },
  });
  if (!data.exactInputQuote) throw new Error('exactInputQuote not returned');
  return data.exactInputQuote;
}

export async function getExactOutputQuote(inputSymbol: string, outputSymbol: string, outputAmount: number): Promise<CraftworldQuoteResult> {
  const normalizedInput = inputSymbol.trim().toUpperCase();
  const normalizedOutput = outputSymbol.trim().toUpperCase();
  if (normalizedInput === normalizedOutput) {
    return {
      type: 'EXACT_OUTPUT',
      input: { symbol: normalizedInput, amount: outputAmount },
      output: { symbol: normalizedOutput, amount: outputAmount },
      details: { priceImpactPercentage: 0 },
    };
  }
  const query = `
    query exactOutputQuoteQuery($input: ExactOutputInput!) {
      exactOutputQuote(input: $input) {
        type
        input { symbol amount }
        output { symbol amount }
        details { priceImpactPercentage }
      }
    }
  `;
  const data = await graphqlRequest<{ exactOutputQuote?: CraftworldQuoteResult }>(query, {
    input: { inputSymbol: normalizedInput, outputSymbol: normalizedOutput, outputAmount },
  });
  if (!data.exactOutputQuote) throw new Error('exactOutputQuote not returned');
  return data.exactOutputQuote;
}
