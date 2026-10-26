import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service | yoinkr",
  description: "The terms that apply to using yoinkr.",
};

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      <Link href="/" className="font-mono text-xs uppercase tracking-widest text-muted hover:text-foreground">
        ← Back to yoinkr
      </Link>
      <h1 className="mt-4 text-3xl font-black tracking-tight">Terms of Service</h1>
      <p className="mt-2 text-sm text-muted">Last updated: {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</p>

      <div className="prose-sm mt-8 space-y-6 text-sm leading-relaxed text-foreground/90">
        <p>
          By using yoinkr.online (&quot;the service&quot;), you agree to these terms. If you don&apos;t
          agree, please don&apos;t use the service.
        </p>

        <section>
          <h2 className="text-base font-bold">What the service does</h2>
          <p className="mt-2">
            yoinkr lets you fetch a video or audio file from a YouTube link you provide, in a
            resolution or format you choose. It&apos;s provided free of charge and supported by
            advertising.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold">Your responsibilities</h2>
          <p className="mt-2">You agree that:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              You will only download content you own, have the right to save, or are otherwise
              permitted to download under applicable law (for example, content licensed for
              personal/offline use, or your own uploads).
            </li>
            <li>You won&apos;t use the service to infringe anyone&apos;s copyright or other rights.</li>
            <li>
              You won&apos;t abuse the service, including excessive automated requests, attempts to
              disrupt or overload it, or reselling access to it.
            </li>
          </ul>
          <p className="mt-2">
            We don&apos;t review, control, or take responsibility for what URLs are submitted or what
            they&apos;re used for. That responsibility is yours.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold">Copyright concerns</h2>
          <p className="mt-2">
            yoinkr doesn&apos;t host, store, or index any video content. It fetches a file on
            demand for the person requesting it, then deletes it from our server. If you&apos;re a
            rights holder with a concern, contact us at the address below and we&apos;ll look into
            it.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold">No warranty</h2>
          <p className="mt-2">
            The service is provided &quot;as is&quot; and &quot;as available&quot;, without warranties of any
            kind. We don&apos;t guarantee it will always be available, error-free, or that any
            particular video, resolution, or format will successfully download. YouTube&apos;s own
            systems can and do change in ways outside our control.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold">Limitation of liability</h2>
          <p className="mt-2">
            To the fullest extent permitted by law, yoinkr and its operator aren&apos;t liable for
            any indirect, incidental, or consequential damages arising from your use of the
            service.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold">Changes to the service or these terms</h2>
          <p className="mt-2">
            We may modify, suspend, or discontinue the service at any time, and may update these
            terms as the service changes. Continued use after a change means you accept the
            updated terms.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold">Governing law</h2>
          <p className="mt-2 rounded-lg border border-dashed border-border bg-surface p-3 text-muted">
            [Add your jurisdiction here, e.g. &quot;these terms are governed by the laws of
            ___&quot;. Left as a placeholder since this depends on where the business is
            registered.]
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold">Contact</h2>
          <p className="mt-2">
            Questions about these terms? Reach out at{" "}
            <a href="mailto:hello@yoinkr.online" className="underline underline-offset-2 hover:text-accent-strong">
              hello@yoinkr.online
            </a>
            .
          </p>
        </section>
      </div>
    </div>
  );
}
