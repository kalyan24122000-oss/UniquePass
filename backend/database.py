import sqlite3
import uuid

DB_PATH = "passwords.db"

def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """Initializes the SQLite database and creates necessary tables."""
    conn = get_connection()
    c = conn.cursor()
    
    # Generated passwords table
    c.execute('''
        CREATE TABLE IF NOT EXISTS generated_passwords (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            password_hash TEXT UNIQUE NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            length INTEGER NOT NULL
        )
    ''')
    c.execute('CREATE INDEX IF NOT EXISTS idx_hash ON generated_passwords(password_hash)')
    
    # Users table
    c.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            is_premium BOOLEAN DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    conn.commit()
    conn.close()

def store_password_hash(pwd_hash: str, length: int) -> bool:
    """Attempts to atomically store a password hash."""
    try:
        conn = get_connection()
        c = conn.cursor()
        c.execute('INSERT INTO generated_passwords (password_hash, length) VALUES (?, ?)', (pwd_hash, length))
        conn.commit()
        conn.close()
        return True
    except sqlite3.IntegrityError:
        return False
    except Exception as e:
        print(f"DB Error: {e}")
        return False

def create_user(name: str, email: str, pwd_hash: str):
    """Creates a new user and returns their unique ID."""
    user_id = "UP-" + str(uuid.uuid4())[:8].upper()
    try:
        conn = get_connection()
        c = conn.cursor()
        c.execute('INSERT INTO users (id, name, email, password_hash) VALUES (?, ?, ?, ?)', 
                  (user_id, name, email, pwd_hash))
        conn.commit()
        conn.close()
        return user_id
    except sqlite3.IntegrityError:
        return None # Email already exists

def get_user_by_email(email: str):
    conn = get_connection()
    c = conn.cursor()
    c.execute('SELECT * FROM users WHERE email = ?', (email,))
    user = c.fetchone()
    conn.close()
    return dict(user) if user else None

def get_user_by_id(user_id: str):
    conn = get_connection()
    c = conn.cursor()
    c.execute('SELECT * FROM users WHERE id = ?', (user_id,))
    user = c.fetchone()
    conn.close()
    return dict(user) if user else None
