const SERVICE_LINES = [
  "Human Capital Solutions",
  "Workforce Solutions",
  "Executive Search & Leadership Advisory",
  "Customer Experience Solutions",
  "Contact Centre & BPO",
  "HR Audit & Compliance",
  "Business Advisory & Transformation",
  "HR Technology & Digital Transformation",
  "Research, Analytics & Workforce Insights",
];

export default function HomePage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-semibold">Nexa Workforce Solutions</h1>
      <p className="mt-2 text-slate-600">Phase 1 — production foundation.</p>

      <ul className="mt-8 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {SERVICE_LINES.map((line) => (
          <li key={line} className="rounded-md border border-slate-200 px-4 py-2 text-sm">
            {line}
          </li>
        ))}
      </ul>

      <a
        href="/health"
        className="mt-8 inline-block text-sm font-medium text-slate-900 underline underline-offset-4"
      >
        View platform health →
      </a>
    </main>
  );
}
