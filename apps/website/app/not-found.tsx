import { ArrowRight } from "lucide-react";
import { Container } from "../components/Container";
import { LinkButton } from "../components/Button";

export default function NotFound() {
  return (
    <Container className="flex flex-col items-center py-32 text-center">
      <span className="font-display text-sm font-semibold uppercase tracking-wide text-brand-600">404</span>
      <h1 className="mt-4 font-display text-3xl font-semibold text-slate-900 sm:text-4xl">Page not found</h1>
      <p className="mt-4 max-w-md text-base text-slate-600">
        The page you&apos;re looking for doesn&apos;t exist, or has moved.
      </p>
      <div className="mt-8">
        <LinkButton href="/" size="lg">
          Back to home
          <ArrowRight className="h-4 w-4" aria-hidden />
        </LinkButton>
      </div>
    </Container>
  );
}
