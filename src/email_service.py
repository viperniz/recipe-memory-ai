"""
Email Service
Send transactional emails via Resend API
"""

import os
import logging

logger = logging.getLogger(__name__)

RESEND_API_KEY = os.getenv("RESEND_API_KEY", "")
FROM_EMAIL = os.getenv("FROM_EMAIL", "noreply@videomemory.ai")
APP_URL = os.getenv("APP_URL", "http://localhost:5173")


def send_password_reset_email(to_email: str, reset_token: str) -> bool:
    """Send a password reset email with the reset link."""
    reset_url = f"{APP_URL}/reset-password?token={reset_token}"

    if not RESEND_API_KEY:
        logger.warning(f"RESEND_API_KEY not set. Reset URL: {reset_url}")
        return False

    try:
        import resend
        resend.api_key = RESEND_API_KEY

        resend.Emails.send({
            "from": FROM_EMAIL,
            "to": [to_email],
            "subject": "Reset your Video Memory password",
            "html": f"""
            <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
                <h2 style="color: #18181b;">Reset your password</h2>
                <p style="color: #3f3f46;">
                    We received a request to reset your password. Click the button below to choose a new one.
                    This link expires in 1 hour.
                </p>
                <a href="{reset_url}"
                   style="display: inline-block; padding: 12px 24px; background: #8b5cf6; color: white;
                          text-decoration: none; border-radius: 8px; font-weight: 600; margin: 16px 0;">
                    Reset Password
                </a>
                <p style="color: #71717a; font-size: 14px;">
                    If you didn't request this, you can safely ignore this email.
                </p>
            </div>
            """
        })
        logger.info(f"Password reset email sent to {to_email}")
        return True

    except Exception as e:
        logger.error(f"Failed to send reset email: {e}")
        return False
