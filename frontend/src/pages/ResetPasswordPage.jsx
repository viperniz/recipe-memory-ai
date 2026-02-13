import React, { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { authApi } from '../api/auth'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Alert, AlertDescription } from '../components/ui/alert'
import { Loader2, Lock, CheckCircle, Eye, EyeOff } from 'lucide-react'

const resetSchema = z.object({
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Za-z]/, 'Password must contain at least one letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  confirmPassword: z.string().min(1, 'Please confirm your password')
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword']
})

function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const [serverError, setServerError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    document.title = 'Set New Password — Second Mind'
  }, [])
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm({
    resolver: zodResolver(resetSchema),
    defaultValues: { newPassword: '', confirmPassword: '' }
  })

  if (!token) {
    return (
      <main id="main-content" className="auth-page">
        <div className="auth-container">
          <div className="auth-header">
            <h1>Invalid Link</h1>
            <p>This password reset link is invalid or has expired.</p>
          </div>
          <div className="auth-footer">
            <p>
              <Link to="/forgot-password">Request a new reset link</Link>
            </p>
          </div>
        </div>
      </main>
    )
  }

  const onSubmit = async (data) => {
    setServerError('')
    try {
      await authApi.resetPassword(token, data.newPassword)
      setSuccess(true)
    } catch (err) {
      setServerError(err.response?.data?.detail || 'Reset failed. The link may have expired.')
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
            <h1>Password reset!</h1>
            <p>Your password has been updated. You can now sign in with your new password.</p>
          </div>
          <Link to="/login">
            <Button className="w-full">Sign In</Button>
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main id="main-content" className="auth-page">
      <div className="auth-container">
        <div className="auth-header">
          <h1>Set new password</h1>
          <p>Choose a strong password for your account.</p>
        </div>

        {serverError && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{serverError}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="auth-form">
          <div className="form-group">
            <label htmlFor="newPassword">New Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <Input
                id="newPassword"
                type={showPassword ? "text" : "password"}
                {...register('newPassword')}
                placeholder="At least 8 characters"
                disabled={isSubmitting}
                error={errors.newPassword}
                className="pl-10 pr-10"
                required
                autoComplete="new-password"
                aria-describedby={errors.newPassword ? "newPassword-error" : undefined}
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
            {errors.newPassword && (
              <p id="newPassword-error" role="alert" className="text-red-400 text-sm mt-1">{errors.newPassword.message}</p>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">Confirm Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                {...register('confirmPassword')}
                placeholder="Repeat your password"
                disabled={isSubmitting}
                error={errors.confirmPassword}
                className="pl-10 pr-10"
                required
                autoComplete="new-password"
                aria-describedby={errors.confirmPassword ? "confirmPassword-error" : undefined}
              />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                tabIndex={-1}
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.confirmPassword && (
              <p id="confirmPassword-error" role="alert" className="text-red-400 text-sm mt-1">{errors.confirmPassword.message}</p>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Resetting...
              </>
            ) : (
              'Reset Password'
            )}
          </Button>
        </form>
      </div>
    </main>
  )
}

export default ResetPasswordPage
