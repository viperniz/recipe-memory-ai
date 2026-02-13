"""Reset user password"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent / "src"))

from database import SessionLocal, User
import bcrypt

def reset_password(email: str, new_password: str):
    """Reset a user's password"""
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        if not user:
            print(f"User {email} not found!")
            return False
        
        # Hash new password using bcrypt directly
        salt = bcrypt.gensalt()
        hashed = bcrypt.hashpw(new_password.encode('utf-8'), salt)
        user.hashed_password = hashed.decode('utf-8')
        db.commit()
        db.refresh(user)
        
        print(f"Password reset successfully for {email}")
        print(f"New password: {new_password}")
        return True
    except Exception as e:
        print(f"Error resetting password: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
        return False
    finally:
        db.close()

if __name__ == "__main__":
    import sys
    if len(sys.argv) < 3:
        print("Usage: python reset_password.py <email> <new_password>")
        sys.exit(1)
    
    email = sys.argv[1]
    password = sys.argv[2]
    reset_password(email, password)
