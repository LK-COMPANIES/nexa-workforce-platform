interface ApiHealth {
  status: string;
  database: string;
  redis: string;
  timestamp: string;
}

async function fetchApiHealth(): Promise<ApiHealth | { error: string }> {
  // Server Components run inside the web container itself — reach the API
  // via its internal (Docker network) address when set, since the
  // browser-facing NEXT_PUBLIC_API_URL is not reachable from inside the
  // container in a docker-compose deployment.
  const apiUrl = process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL;
  try {
    const response = await fetch(`${apiUrl}/health`, {
      cache: "no-store",
    });
    if (!response.ok) {
      return { error: `API responded with ${response.status}` };
    }
    return (await response.json()) as ApiHealth;
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unknown error" };
  }
}

export default async function HealthPage() {
  const health = await fetchApiHealth();

  return (
    <main className="mx-auto max-w-xl px-6 py-16">
      <h1 className="text-2xl font-semibold">Platform Health</h1>
      <pre className="mt-6 overflow-x-auto rounded-md bg-slate-900 p-4 text-sm text-slate-100">
        {JSON.stringify(health, null, 2)}
      </pre>
    </main>
  );
}
