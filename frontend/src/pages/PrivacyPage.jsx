import React, { useEffect } from 'react'
import Navbar from '../components/layout/Navbar'

function PrivacyPage() {
  useEffect(() => {
    document.title = 'Privacy Policy — Second Mind'
  }, [])

  return (
    <div className="landing-page">
      <Navbar />
      <main id="main-content" className="legal-page">
        <div className="legal-container">
          <h1>Privacy Policy</h1>
          <p className="legal-updated">Last updated: February 7, 2026</p>

          <section>
            <h2>1. Introduction</h2>
            <p>Second Mind ("we", "us", "our") is committed to protecting your privacy. This policy describes how we collect, use, and share your personal information when you use our Service.</p>
          </section>

          <section>
            <h2>2. Information We Collect</h2>
            <p><strong>Account information:</strong> Email address, name (optional), and authentication credentials when you create an account.</p>
            <p><strong>Content data:</strong> Video URLs you submit, AI-generated notes, summaries, transcripts, and collections you create.</p>
            <p><strong>Usage data:</strong> Pages visited, features used, timestamps, and general interaction patterns.</p>
            <p><strong>Payment data:</strong> Billing information is processed securely by Stripe. We do not store your full credit card number.</p>
          </section>

          <section>
            <h2>3. How We Use Your Information</h2>
            <ul>
              <li>Provide, maintain, and improve the Service</li>
              <li>Process video content and generate AI outputs</li>
              <li>Manage your account and subscription</li>
              <li>Send service-related communications</li>
              <li>Enforce our Terms of Service</li>
            </ul>
          </section>

          <section>
            <h2>4. Third-Party Services</h2>
            <p>We use the following third-party services to operate:</p>
            <ul>
              <li><strong>OpenAI</strong> — AI content processing (transcription, summarization, analysis)</li>
              <li><strong>Google</strong> — Authentication (Google Sign-In) and YouTube data retrieval</li>
              <li><strong>Stripe</strong> — Payment processing and subscription management</li>
            </ul>
            <p>These providers have their own privacy policies governing how they handle data.</p>
          </section>

          <section>
            <h2>5. Data Retention</h2>
            <p>Your content and account data are retained as long as your account is active. When you delete your account, we will remove your personal data within 30 days. Some data may be retained in backups for up to 90 days. Anonymized, aggregated usage data may be retained indefinitely.</p>
          </section>

          <section>
            <h2>6. Data Security</h2>
            <p>We implement industry-standard security measures to protect your data, including encryption in transit (TLS), secure credential storage, and access controls. However, no method of transmission or storage is 100% secure.</p>
          </section>

          <section>
            <h2>7. Your Rights</h2>
            <p>Depending on your location, you may have the following rights:</p>
            <ul>
              <li><strong>Access:</strong> Request a copy of your personal data</li>
              <li><strong>Correction:</strong> Update inaccurate information</li>
              <li><strong>Deletion:</strong> Request deletion of your data</li>
              <li><strong>Portability:</strong> Export your data in a machine-readable format</li>
              <li><strong>Objection:</strong> Opt out of certain data processing</li>
            </ul>
            <p>To exercise these rights, contact us at <a href="mailto:support@secondmind.ai">support@secondmind.ai</a>.</p>
          </section>

          <section>
            <h2>8. GDPR (EU Users)</h2>
            <p>If you are in the European Economic Area, we process your data under lawful bases including consent, contract performance, and legitimate interests. You have the right to lodge a complaint with your local data protection authority.</p>
          </section>

          <section>
            <h2>9. CCPA (California Users)</h2>
            <p>California residents have the right to know what personal information is collected, request its deletion, and opt out of its sale. We do not sell personal information. For CCPA requests, contact <a href="mailto:support@secondmind.ai">support@secondmind.ai</a>.</p>
          </section>

          <section>
            <h2>10. Cookies</h2>
            <p>We use essential cookies for authentication and session management. We do not use third-party advertising or tracking cookies. Authentication tokens are stored in your browser's local storage.</p>
          </section>

          <section>
            <h2>11. Changes to This Policy</h2>
            <p>We may update this policy from time to time. We will notify registered users of material changes via email. The "last updated" date at the top indicates the most recent revision.</p>
          </section>

          <section>
            <h2>12. Contact</h2>
            <p>For questions about this policy or your data, contact us at <a href="mailto:support@secondmind.ai">support@secondmind.ai</a>.</p>
          </section>
        </div>
      </main>
    </div>
  )
}

export default PrivacyPage
