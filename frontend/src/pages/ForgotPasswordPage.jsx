import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { authApi } from '../api/auth'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Alert, AlertDescription } from '../components/ui/alert'
import { Loader2, Mail, ArrowLeft, CheckCircle } from 'lucide-react'

const forgotSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Please enter a valid email address')
})

function ForgotPasswordPage() {
  const [serverError, setServerError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    document.title = 'Reset Password — Second Mind'
  }, [])

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm({
    resolver: zodResolver(forgotSchema),
    defaultValues: { email: '' }
  })

  const onSubmit = async (data) => {
    setServerError('')
    try {
      await authApi.forgotPassword(data.email)
      setSuccess(true)
    } catch (err) {
      setServerError(err.response?.data?.detail || 'Something went wrong. Please try again.')
    }
  }

  if (success) {
    return (
      <main id="main-content" className="auth-page">
        <div className="auth-container">
          <div className="auth-header">
            <div className="forgot-success-icon">
              <CheckCircle className="w-12 h-12 text-green-500" />
            </div>
            <h1>Check your email</h1>
            <p>If an account exists with that email, we've sent a password reset link. It expires in 1 hour.</p>
          </div>
          <div className="auth-footer">
            <p>
              <Link to="/login">
                <ArrowLeft className="w-4 h-4 inline-block mr-1" />
                Back to sign in
              </Link>
            </p>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main id="main-content" className="auth-page">
      <div className="auth-container">
        <div className="auth-header">
          <h1>Forgot password?</h1>
          <p>Enter your email and we'll send you a reset link.</p>
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

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              'Send Reset Link'
            )}
          </Button>
        </form>

        <div className="auth-footer">
          <p>
            <Link to="/login">
              <ArrowLeft className="w-4 h-4 inline-block mr-1" />
              Back to sign in
            </Link>
          </p>
        </div>
      </div>
    </main>
  )
}

export default ForgotPasswordPage
