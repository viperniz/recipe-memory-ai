"""Add mode column to PostgreSQL database"""
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import create_engine, text

# Use Supabase PostgreSQL directly
DATABASE_URL = "postgresql://postgres.flhmppxqcrydvmxiiazn:wyhET61ZYxFrtFgX@aws-0-us-west-2.pooler.supabase.com:5432/postgres"

print(f"Database URL: PostgreSQL (Supabase)")

engine = create_engine(DATABASE_URL, connect_args={"sslmode": "require"})

with engine.connect() as conn:
    # Add mode column to jobs table
    print("\nAdding mode column to jobs table...")
    try:
        conn.execute(text("ALTER TABLE jobs ADD COLUMN mode VARCHAR(50) DEFAULT 'general'"))
        conn.commit()
        print("  ✓ Added mode column to jobs table")
    except Exception as e:
        if "already exists" in str(e).lower() or "duplicate" in str(e).lower():
            print("  ✓ jobs.mode column already exists")
        else:
            print(f"  Error: {e}")
            conn.rollback()

    # Add mode column to content_vectors table
    print("\nAdding mode column to content_vectors table...")
    try:
        conn.execute(text("ALTER TABLE content_vectors ADD COLUMN mode VARCHAR(50) DEFAULT 'general'"))
        conn.commit()
        print("  ✓ Added mode column to content_vectors table")
    except Exception as e:
        if "already exists" in str(e).lower() or "duplicate" in str(e).lower():
            print("  ✓ content_vectors.mode column already exists")
        else:
            print(f"  Error: {e}")
            conn.rollback()

    # Create index
    print("\nCreating index on content_vectors.mode...")
    try:
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_content_vectors_mode ON content_vectors (mode)"))
        conn.commit()
        print("  ✓ Created index")
    except Exception as e:
        print(f"  Note: {e}")
        conn.rollback()

print("\n✓ Migration complete! Restart your API server.")
