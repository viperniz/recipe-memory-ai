"""
Migration script to add 'mode' column to jobs and content_vectors tables.
Run this script if you have an existing database.
"""

import os
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine, text
from src.database import DATABASE_URL

def migrate():
    """Add mode column to jobs and content_vectors tables"""

    # Create engine
    if "postgresql" in DATABASE_URL or "postgres" in DATABASE_URL:
        engine = create_engine(DATABASE_URL, connect_args={"sslmode": "require"})
    else:
        engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})

    with engine.connect() as conn:
        # Check if mode column exists in jobs table
        try:
            if "postgresql" in DATABASE_URL:
                result = conn.execute(text("""
                    SELECT column_name FROM information_schema.columns
                    WHERE table_name = 'jobs' AND column_name = 'mode'
                """))
            else:
                result = conn.execute(text("PRAGMA table_info(jobs)"))
                columns = [row[1] for row in result.fetchall()]
                if 'mode' in columns:
                    print("✓ jobs.mode column already exists")
                else:
                    raise Exception("Column not found")
        except:
            # Add mode column to jobs
            try:
                conn.execute(text("ALTER TABLE jobs ADD COLUMN mode VARCHAR(50) DEFAULT 'general'"))
                conn.commit()
                print("✓ Added mode column to jobs table")
            except Exception as e:
                print(f"Note: Could not add mode to jobs: {e}")

        # Check if mode column exists in content_vectors table
        try:
            if "postgresql" in DATABASE_URL:
                result = conn.execute(text("""
                    SELECT column_name FROM information_schema.columns
                    WHERE table_name = 'content_vectors' AND column_name = 'mode'
                """))
                if result.fetchone():
                    print("✓ content_vectors.mode column already exists")
                else:
                    raise Exception("Column not found")
            else:
                result = conn.execute(text("PRAGMA table_info(content_vectors)"))
                columns = [row[1] for row in result.fetchall()]
                if 'mode' in columns:
                    print("✓ content_vectors.mode column already exists")
                else:
                    raise Exception("Column not found")
        except:
            # Add mode column to content_vectors
            try:
                conn.execute(text("ALTER TABLE content_vectors ADD COLUMN mode VARCHAR(50) DEFAULT 'general'"))
                conn.commit()
                print("✓ Added mode column to content_vectors table")
            except Exception as e:
                print(f"Note: Could not add mode to content_vectors: {e}")

        # Create index on mode column for faster filtering
        try:
            if "postgresql" in DATABASE_URL:
                conn.execute(text("CREATE INDEX IF NOT EXISTS ix_content_vectors_mode ON content_vectors (mode)"))
            else:
                conn.execute(text("CREATE INDEX IF NOT EXISTS ix_content_vectors_mode ON content_vectors (mode)"))
            conn.commit()
            print("✓ Created index on content_vectors.mode")
        except Exception as e:
            print(f"Note: Could not create index: {e}")

    print("\nMigration complete!")

if __name__ == "__main__":
    print("Running database migration for mode columns...")
    migrate()
