import { corsHeaders } from './cors.ts';

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

export function errorResponse(message: string, status = 400): Response {
  return json({ error: message }, status);
}

/** Standard CORS preflight for a POST-only function. */
export function preflight(): Response {
  return new Response('ok', { headers: corsHeaders });
}
