import React, { useEffect, useState } from 'react'
import { MessageCircle, X, Send, Loader2, CheckCircle } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import Navbar from '../components/layout/Navbar'
import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_URL || '/api'

const FAQ_ITEMS = [
  {
    question: 'What is Second Mind?',
    answer: 'Second Mind is an AI-powered tool that turns YouTube videos into structured, searchable knowledge. Paste a link, and our AI extracts summaries, key insights, transcripts, and more — so you can study, research, or create content faster.'
  },
  {
    question: 'What video formats and sources are supported?',
    answer: 'Currently we support YouTube videos via URL. You can paste any public YouTube video link and our system will process it automatically. Support for additional platforms is on our roadmap.'
  },
  {
    question: 'How does the AI processing work?',
    answer: 'When you add a video, our system transcribes the audio, analyzes the content using advanced AI models, and extracts structured information including summaries, key points, topics, and entities. Pro and Team plans also include Vision AI for frame-by-frame visual analysis.'
  },
  {
    question: 'What are the billing plans?',
    answer: 'We offer four plans: Free ($0 — 50 credits/mo, basic features), Researcher ($12.99/mo — 250 credits, flashcards, semantic search), Scholar ($29.99/mo — 750 credits, Vision AI, mind maps, study guides), and Department ($59.99/mo — 2000 credits, team collaboration, unlimited video length). You can upgrade or downgrade anytime.'
  },
  {
    question: 'What is Vision AI?',
    answer: 'Vision AI is a Pro and Team feature that analyzes individual frames from your videos using AI vision models. It can identify on-screen text, diagrams, slides, and visual content that audio transcription alone would miss.'
  },
  {
    question: 'What are Content Repurposing and Top 10 Scripts?',
    answer: 'Content Repurposing lets you rewrite your video notes in different styles (casual, professional, educational, entertaining). Top 10 Script Generator analyzes multiple videos on a topic and creates ranked "Top 10" style scripts. Both are available on Pro and Team plans.'
  },
  {
    question: 'How is my data handled?',
    answer: 'Your data is stored securely and is only accessible to you. We use OpenAI for AI processing and Google for authentication. Video content is processed and stored as structured text — we do not store the original video files. See our Privacy Policy for full details.'
  },
  {
    question: 'How do I contact support?',
    answer: 'Click the chat bubble in the bottom-right corner to send us a message. We typically respond within 24 hours on business days.'
  }
]

const CATEGORIES = [
  'General Question',
  'Billing & Subscriptions',
  'Technical Issue',
  'Feature Request',
  'Account & Data',
  'Other'
]

function ContactBubble() {
  const [open, setOpen] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [sending, setSending] = useState(false)
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    category: '',
    message: ''
  })

  const handleChange = (e) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSending(true)
    try {
      const token = localStorage.getItem('token')
      if (!token) {
        alert('Please log in to send a support message.')
        setSending(false)
        return
      }
      await axios.post(`${API_BASE}/support`, {
        subject: `${form.firstName} ${form.lastName} — ${form.category || 'General'}`,
        message: form.message,
        category: form.category
      }, { headers: { Authorization: `Bearer ${token}` } })
      setSubmitted(true)
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to send message. Please try again.')
    } finally {
      setSending(false)
    }
  }

  const handleReset = () => {
    setSubmitted(false)
    setForm({ firstName: '', lastName: '', email: '', category: '', message: '' })
    setOpen(false)
  }

  return (
    <>
      {/* Floating trigger button */}
      <button
        className="contact-bubble-trigger"
        onClick={() => setOpen(!open)}
        aria-label={open ? 'Close contact form' : 'Open contact form'}
      >
        {open ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
      </button>

      {/* Chat panel */}
      {open && (
        <div className="contact-bubble-panel" role="dialog" aria-label="Contact support">
          <div className="contact-bubble-header">
            <h3>Contact Support</h3>
            <p>We'll get back to you within 24 hours.</p>
          </div>

          {submitted ? (
            <div className="contact-bubble-success">
              <CheckCircle className="w-10 h-10 text-green-500" />
              <h4>Message sent!</h4>
              <p>Thanks for reaching out. We'll respond to your email shortly.</p>
              <Button variant="outline" size="sm" onClick={handleReset}>
                Close
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="contact-bubble-form">
              <div className="contact-bubble-row">
                <div className="contact-bubble-field">
                  <label htmlFor="cb-firstName">First Name</label>
                  <Input
                    id="cb-firstName"
                    name="firstName"
                    value={form.firstName}
                    onChange={handleChange}
                    placeholder="Jane"
                    required
                  />
                </div>
                <div className="contact-bubble-field">
                  <label htmlFor="cb-lastName">Last Name</label>
                  <Input
                    id="cb-lastName"
                    name="lastName"
                    value={form.lastName}
                    onChange={handleChange}
                    placeholder="Doe"
                    required
                  />
                </div>
              </div>

              <div className="contact-bubble-field">
                <label htmlFor="cb-email">Email</label>
                <Input
                  id="cb-email"
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="you@example.com"
                  required
                />
              </div>

              <div className="contact-bubble-field">
                <label htmlFor="cb-category">Category</label>
                <select
                  id="cb-category"
                  name="category"
                  value={form.category}
                  onChange={handleChange}
                  required
                  className="contact-bubble-select"
                >
                  <option value="" disabled>Select a category</option>
                  {CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div className="contact-bubble-field">
                <label htmlFor="cb-message">Message</label>
                <textarea
                  id="cb-message"
                  name="message"
                  value={form.message}
                  onChange={handleChange}
                  placeholder="How can we help?"
                  required
                  rows={4}
                  className="contact-bubble-textarea"
                />
              </div>

              <Button type="submit" className="w-full" disabled={sending}>
                {sending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Send Message
                  </>
                )}
              </Button>
            </form>
          )}
        </div>
      )}
    </>
  )
}

function HelpPage() {
  useEffect(() => {
    document.title = 'Help — Second Mind'
  }, [])

  return (
    <div className="landing-page">
      <Navbar />
      <main id="main-content" className="legal-page">
        <div className="legal-container">
          <h1>Help & FAQ</h1>
          <p className="legal-intro">Find answers to common questions about Second Mind.</p>

          <div className="faq-list">
            {FAQ_ITEMS.map((item, i) => (
              <details key={i} className="faq-item">
                <summary>{item.question}</summary>
                <p>{item.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </main>

      <ContactBubble />
    </div>
  )
}

export default HelpPage
