import React, { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { Button } from '../ui/button'
import { Menu, X } from 'lucide-react'
import BrainIcon from '../icons/BrainIcon'
import { getLenis } from '../../hooks/useLenis'

function Navbar() {
  const { isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const navLinks = [
    { label: 'Features', href: '/#features' },
    { label: 'How It Works', href: '/#how-it-works' },
    { label: 'Pricing', href: '/#pricing' },
    { label: 'Help', href: '/#help' },
  ]

  const isActive = (href) => {
    if (href.startsWith('/#')) return location.pathname === '/' && location.hash === href.slice(1)
    return location.pathname === href
  }

  const handleNavClick = (href) => {
    setMobileMenuOpen(false)
    if (href.startsWith('/#')) {
      const selector = href.slice(1) // e.g. "#features"
      if (location.pathname !== '/') {
        navigate('/')
        setTimeout(() => {
          const lenis = getLenis()
          const el = document.querySelector(selector)
          if (el) {
            lenis ? lenis.scrollTo(el) : el.scrollIntoView({ behavior: 'smooth' })
          }
        }, 100)
      } else {
        const lenis = getLenis()
        const el = document.querySelector(selector)
        if (el) {
          lenis ? lenis.scrollTo(el) : el.scrollIntoView({ behavior: 'smooth' })
        }
      }
    } else {
      navigate(href)
    }
  }

  return (
    <nav className="landing-navbar" aria-label="Main navigation">
      <div className="landing-navbar-inner">
        {/* Logo */}
        <Link to="/" className="landing-navbar-logo" onClick={() => setMobileMenuOpen(false)}>
          <div className="landing-navbar-logo-icon">
            <BrainIcon className="w-5 h-5" animated />
          </div>
          <span>Cortexle</span>
        </Link>

        {/* Desktop nav links */}
        <div className="landing-navbar-links">
          {navLinks.map(link => (
            <button
              key={link.href}
              className={`landing-navbar-link ${isActive(link.href) ? 'active' : ''}`}
              onClick={() => handleNavClick(link.href)}
            >
              {link.label}
            </button>
          ))}
        </div>

        {/* Desktop auth buttons */}
        <div className="landing-navbar-auth">
          {isAuthenticated ? (
            <Button onClick={() => navigate('/app')} size="sm">
              Go to App
            </Button>
          ) : (
            <>
              <Button variant="ghost" size="sm" onClick={() => navigate('/login')}>
                Log In
              </Button>
              <Button size="sm" onClick={() => navigate('/register')}>
                Get Started Free
              </Button>
            </>
          )}
        </div>

        {/* Mobile hamburger */}
        <button
          className="landing-navbar-hamburger"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle menu"
        >
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="landing-navbar-mobile">
          {navLinks.map(link => (
            <button
              key={link.href}
              className="landing-navbar-mobile-link"
              onClick={() => handleNavClick(link.href)}
            >
              {link.label}
            </button>
          ))}
          <div className="landing-navbar-mobile-divider" />
          {isAuthenticated ? (
            <Button className="w-full" onClick={() => { setMobileMenuOpen(false); navigate('/app') }}>
              Go to App
            </Button>
          ) : (
            <>
              <Button variant="ghost" className="w-full" onClick={() => { setMobileMenuOpen(false); navigate('/login') }}>
                Log In
              </Button>
              <Button className="w-full" onClick={() => { setMobileMenuOpen(false); navigate('/register') }}>
                Get Started Free
              </Button>
            </>
          )}
        </div>
      )}
    </nav>
  )
}

export default Navbar
