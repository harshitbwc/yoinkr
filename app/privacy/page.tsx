import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy — yoinkr",
  description: "How yoinkr handles data, cookies, and third-party advertising.",
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      <Link href="/" className="font-mono text-xs uppercase tracking-widest text-muted hover:text-foreground">
        ← Back to yoinkr
      </Link>
      <h1 className="mt-4 text-3xl font-black tracking-tight">Privacy Policy</h1>
      <p className="mt-2 text-sm text-muted">Last updated: {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</p>

      <div className="prose-sm mt-8 space-y-6 text-sm leading-relaxed text-foreground/90">
        <p>
          yoinkr (&quot;we&quot;, &quot;us&quot;) operates yoinkr.online. This page explains what
          information is collected when you use the site, and how it&apos;s handled.
        </p>

        <section>
          <h2 className="text-base font-bold">What we collect</h2>
          <p className="mt-2">
            <strong>The link you paste.</strong> When you submit a YouTube URL, it&apos;s sent to
            our server to fetch the video&apos;s metadata and, if you request a download, to fetch
            the file. We don&apos;t require an account, name, or email to use the tool.
          </p>
          <p className="mt-2">
            <strong>Server logs.</strong> Like most web servers, ours automatically logs standard
            technical information for each request — your IP address, browser user agent, and
            timestamp — for operating and securing the service. These logs are not linked to any
            personal identity and are not sold or shared.
          </p>
          <p className="mt-2">
            <strong>Downloaded files.</strong> Videos and audio are fetched on demand for your
            download and are automatically deleted from our server shortly afterward. We don&apos;t
            keep a library of what anyone has downloaded.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold">Cookies and advertising</h2>
          <p className="mt-2">
            This site shows ads served by Google AdSense. Google and its advertising partners use
            cookies (including the DoubleClick/DART cookie) to serve ads based on your visits to
            this and other sites, to measure ad performance, and to limit how often you see the
            same ad.
          </p>
          <p className="mt-2">
            You can opt out of personalized advertising by visiting{" "}
            <a
              href="https://adssettings.google.com"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-accent"
            >
              Google Ads Settings
            </a>{" "}
            or{" "}
            <a
              href="https://www.aboutads.info/choices"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-accent"
            >
              aboutads.info/choices
            </a>
            . Third-party vendors, including Google, may also use cookies to serve ads based on
            your prior visits to this site or other sites on the internet — see Google&apos;s{" "}
            <a
              href="https://policies.google.com/technologies/partner-sites"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-accent"
            >
              how Google uses information from sites that use its services
            </a>{" "}
            page for details.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold">Children&apos;s privacy</h2>
          <p className="mt-2">
            This site is not directed at children under 13, and we don&apos;t knowingly collect
            personal information from them.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold">Your choices</h2>
          <p className="mt-2">
            Since we don&apos;t maintain accounts or profiles, there&apos;s no stored personal data
            tied to you to request or delete beyond the standard server logs described above, which
            age out automatically. For advertising cookies specifically, use the opt-out links
            above.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold">Changes to this policy</h2>
          <p className="mt-2">
            We may update this page as the service changes. Material changes will update the date
            at the top of this page.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold">Contact</h2>
          <p className="mt-2">
            Questions about this policy? Reach out at{" "}
            <a href="mailto:hello@yoinkr.online" className="underline underline-offset-2 hover:text-accent">
              hello@yoinkr.online
            </a>
            .
          </p>
        </section>
      </div>
    </div>
  );
}
