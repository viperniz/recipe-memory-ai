import React, { useEffect } from 'react'
import Navbar from '../components/layout/Navbar'

function TermsPage() {
  useEffect(() => {
    document.title = 'Terms of Service — Second Mind'
  }, [])

  return (
    <div className="landing-page">
      <Navbar />
      <main id="main-content" className="legal-page">
        <div className="legal-container">
          <h1>Terms of Service</h1>
          <p className="legal-updated">Last updated: February 7, 2026</p>

          <section>
            <h2>1. Service Description</h2>
            <p>Second Mind ("Service") is a web application that processes video content using artificial intelligence to extract structured notes, summaries, transcripts, and other derivative content. The Service is provided by Second Mind ("we", "us", "our").</p>
          </section>

          <section>
            <h2>2. Accounts</h2>
            <p>You must create an account to use the Service. You are responsible for maintaining the security of your account credentials. You must be at least 13 years old to use the Service. You agree to provide accurate information when creating your account.</p>
          </section>

          <section>
            <h2>3. Acceptable Use</h2>
            <p>You agree to use the Service only for lawful purposes. You may not:</p>
            <ul>
              <li>Process content you do not have the right to use</li>
              <li>Use the Service to infringe on intellectual property rights</li>
              <li>Attempt to reverse-engineer, exploit, or abuse the Service</li>
              <li>Use automated tools to scrape or overload the Service</li>
              <li>Share your account with unauthorized users</li>
            </ul>
          </section>

          <section>
            <h2>4. Intellectual Property</h2>
            <p>You retain ownership of any content you upload or process through the Service. AI-generated outputs (summaries, notes, scripts) are provided for your use under your account. We do not claim ownership of your content or its derivatives.</p>
          </section>

          <section>
            <h2>5. Billing & Subscriptions</h2>
            <p>Paid plans are billed monthly or yearly as selected. Prices are in USD. You may upgrade, downgrade, or cancel at any time. Cancellation takes effect at the end of the current billing period. Refunds are handled on a case-by-case basis — contact support for assistance.</p>
          </section>

          <section>
            <h2>6. Data & Privacy</h2>
            <p>Your use of the Service is also governed by our <a href="/privacy">Privacy Policy</a>. We process video content using third-party AI services (OpenAI, Google) as described in our Privacy Policy.</p>
          </section>

          <section>
            <h2>7. Service Availability</h2>
            <p>We strive to maintain high availability but do not guarantee uninterrupted access. We may perform maintenance, updates, or modifications to the Service at any time. We will endeavor to provide advance notice of significant changes.</p>
          </section>

          <section>
            <h2>8. Termination</h2>
            <p>We reserve the right to suspend or terminate your account for violation of these terms. You may delete your account at any time by contacting support. Upon termination, your data will be deleted in accordance with our data retention policies.</p>
          </section>

          <section>
            <h2>9. Limitation of Liability</h2>
            <p>The Service is provided "as is" without warranty of any kind. We are not liable for any indirect, incidental, or consequential damages arising from your use of the Service. Our total liability is limited to the amount you paid for the Service in the 12 months preceding the claim.</p>
          </section>

          <section>
            <h2>10. Changes to Terms</h2>
            <p>We may update these terms from time to time. We will notify registered users of material changes via email. Continued use of the Service after changes constitutes acceptance of the updated terms.</p>
          </section>

          <section>
            <h2>11. Contact</h2>
            <p>For questions about these terms, contact us at <a href="mailto:support@secondmind.ai">support@secondmind.ai</a>.</p>
          </section>
        </div>
      </main>
    </div>
  )
}

export default TermsPage
