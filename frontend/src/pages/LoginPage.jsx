import React, { useState, useEffect, useRef } from 'react'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAuth } from '../context/AuthContext'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Alert, AlertDescription } from '../components/ui/alert'
import { Loader2, Mail, Lock, Eye, EyeOff } from 'lucide-react'

const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Please enter a valid email address'),
  password: z
    .string()
    .min(1, 'Password is required')
})

function LoginPage() {
  const [serverError, setServerError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const { login, googleLogin } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const isExtension = searchParams.get('source') === 'extension'
  const postLoginPath = isExtension ? '/extension-callback' : '/app'
  const googleBtnRef = useRef(null)

  useEffect(() => {
    document.title = 'Log In — Second Mind'
  }, [])

  useEffect(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
    if (!clientId) return

    const renderBtn = () => {
      if (!window.google?.accounts?.id || !googleBtnRef.current) return false

      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async (response) => {
          setServerError('')
          try {
            await googleLogin(response.credential)
            navigate(postLoginPath)
          } catch (err) {
            setServerError(err.message || 'Google login failed')
          }
        },
        ux_mode: 'popup',
        cancel_on_tap_outside: false
      })

      window.google.accounts.id.renderButton(googleBtnRef.current, {
        type: 'standard',
        theme: 'filled_black',
        size: 'large',
        text: 'continue_with',
        width: googleBtnRef.current.offsetWidth
      })
      return true
    }

    if (!renderBtn()) {
      const interval = setInterval(() => {
        if (renderBtn()) clearInterval(interval)
      }, 200)
      return () => clearInterval(interval)
    }
  }, [])

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: ''
    }
  })

  const onSubmit = async (data) => {
    setServerError('')
    try {
      await login(data.email, data.password)
      navigate(postLoginPath)
    } catch (err) {
      setServerError(err.message || 'Login failed. Please check your credentials.')
    }
  }

  return (
    <main id="main-content" className="auth-page" onClick={() => navigate(-1)}>
      <div className="auth-container" onClick={(e) => e.stopPropagation()}>
        <div className="auth-header">
          <h1>Welcome Back</h1>
          <p>Sign in—turn videos into notes and searchable content for study or creation</p>
        </div>

        {serverError && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{serverError}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="auth-form">
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <Input
                id="email"
                type="email"
                {...register('email')}
                placeholder="you@example.com"
                disabled={isSubmitting}
                error={errors.email}
                className="pl-10"
                required
                autoComplete="email"
                aria-describedby={errors.email ? "email-error" : undefined}
              />
            </div>
            {errors.email && (
              <p id="email-error" role="alert" className="text-red-400 text-sm mt-1">{errors.email.message}</p>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                {...register('password')}
                placeholder="Your password"
                disabled={isSubmitting}
                error={errors.password}
                className="pl-10 pr-10"
                required
                autoComplete="current-password"
                aria-describedby={errors.password ? "password-error" : undefined}
              />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.password && (
              <p id="password-error" role="alert" className="text-red-400 text-sm mt-1">{errors.password.message}</p>
            )}
            <div className="forgot-password-link">
              <Link to="/forgot-password">Forgot your password?</Link>
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Signing in...
              </>
            ) : (
              'Sign In'
            )}
          </Button>
        </form>

        {import.meta.env.VITE_GOOGLE_CLIENT_ID && (
          <>
            <div className="auth-divider">or</div>
            <div ref={googleBtnRef} className="google-btn-container"></div>
          </>
        )}

        <div className="auth-footer">
          <p>
            Don't have an account?{' '}
            <Link to="/register">Create one</Link>
          </p>
        </div>
      </div>
    </main>
  )
}

export default LoginPage
