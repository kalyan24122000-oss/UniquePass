from flask import Flask, request, jsonify
from flask_cors import CORS
from database import init_db, store_password_hash, create_user, get_user_by_email, get_user_by_id
from generator import generate_password
from security import hash_password, calculate_strength
from auth import hash_user_password, verify_user_password, create_access_token, decode_access_token
import logging
import httpx
import os

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

N8N_WEBHOOK_URL = os.getenv("N8N_WEBHOOK_URL", "https://kausgh.app.n8n.cloud/webhook/generate-password")

with app.app_context():
    init_db()
    logger.info("Database initialized.")

def get_current_user(req):
    auth_header = req.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        return None, ("Missing or invalid token", 401)
    token = auth_header.split(" ")[1]
    payload = decode_access_token(token)
    if not payload:
        return None, ("Token expired or invalid", 401)
    user = get_user_by_id(payload.get("sub"))
    if not user:
        return None, ("User not found", 401)
    return user, None

@app.route("/health", methods=["GET"])
def health_check():
    return jsonify({"status": "ok"})

@app.route("/register", methods=["POST"])
def register():
    data = request.json
    if not data or not all(k in data for k in ("name", "email", "password")):
        return jsonify({"detail": "Missing fields"}), 400
    pwd_hash = hash_user_password(data["password"])
    user_id = create_user(data["name"], data["email"], pwd_hash)
    if not user_id:
        return jsonify({"detail": "Email already registered"}), 400
    return jsonify({"success": True, "user_id": user_id})

@app.route("/login", methods=["POST"])
def login():
    data = request.json
    if not data or not all(k in data for k in ("email", "password")):
        return jsonify({"detail": "Missing fields"}), 400
    
    user = get_user_by_email(data["email"])
    if not user or not verify_user_password(data["password"], user["password_hash"]):
        return jsonify({"detail": "Invalid email or password"}), 401
    
    token = create_access_token({"sub": user["id"]})
    return jsonify({"success": True, "access_token": token, "token_type": "bearer"})

@app.route("/users/me", methods=["GET"])
def get_profile():
    user, err = get_current_user(request)
    if err: return jsonify({"detail": err[0]}), err[1]
    return jsonify({
        "id": user["id"],
        "name": user["name"],
        "email": user["email"],
        "is_premium": bool(user["is_premium"])
    })

@app.route("/generate", methods=["POST"])
def generate_endpoint():
    user, err = get_current_user(request)
    if err: return jsonify({"detail": err[0]}), err[1]
    
    req_data = request.json or {}
    length = int(req_data.get("length", 20))
    uppercase = req_data.get("uppercase", True)
    lowercase = req_data.get("lowercase", True)
    numbers = req_data.get("numbers", True)
    symbols = req_data.get("symbols", True)
    symbol_set = req_data.get("symbol_set", "!@#$%^&*")
    require_each_category = req_data.get("require_each_category", True)

    if not (uppercase or lowercase or numbers or symbols):
        return jsonify({"detail": "At least one character set must be selected."}), 400

    # --- Premium Routing to n8n ---
    if user["is_premium"]:
        try:
            with httpx.Client() as client:
                payload = req_data.copy()
                payload["user_id"] = user["id"]
                resp = client.post(N8N_WEBHOOK_URL, json=payload, timeout=10.0)
                
                if resp.status_code == 200:
                    data = resp.json()
                    ai_password = data.get("password")
                    if ai_password:
                        strength = calculate_strength(ai_password, uppercase, lowercase, numbers, symbols, symbol_set)
                        return jsonify({
                            "success": True,
                            "password": ai_password,
                            "length": len(ai_password),
                            "strength": strength,
                            "source": "ai"
                        })
        except Exception as e:
            logger.error(f"n8n webhook failed: {e}. Falling back to local generation.")

    # --- Standard Local Generation ---
    max_retries = 10
    for _ in range(max_retries):
        try:
            pwd = generate_password(
                length, uppercase, lowercase, numbers, symbols, symbol_set, require_each_category
            )
        except ValueError as e:
            return jsonify({"detail": str(e)}), 400

        pwd_hash = hash_password(pwd)
        success = store_password_hash(pwd_hash, length)

        if success:
            strength = calculate_strength(pwd, uppercase, lowercase, numbers, symbols, symbol_set)
            return jsonify({
                "success": True,
                "password": pwd,
                "length": length,
                "strength": strength,
                "source": "local"
            })

    return jsonify({"detail": "Could not guarantee a unique password."}), 500

ADMIN_SECRET = os.getenv("ADMIN_SECRET", "super-secret-admin-key")

def require_admin(req):
    return req.headers.get("X-Admin-Key") == ADMIN_SECRET

@app.route("/admin/search", methods=["GET"])
def admin_search():
    if not require_admin(request): return jsonify({"detail": "Unauthorized"}), 401
    query = request.args.get("query", "").strip()
    if not query: return jsonify({"detail": "No query"}), 400
    
    from database import get_connection
    conn = get_connection()
    c = conn.cursor()
    c.execute('SELECT id, name, email, is_premium FROM users WHERE id = ? OR email = ?', (query, query))
    user = c.fetchone()
    conn.close()
    if not user: return jsonify({"detail": "User not found"}), 404
    return jsonify(dict(user))

@app.route("/admin/toggle_premium", methods=["POST"])
def admin_toggle():
    if not require_admin(request): return jsonify({"detail": "Unauthorized"}), 401
    user_id = request.json.get("user_id")
    if not user_id: return jsonify({"detail": "No user ID"}), 400

    from database import get_connection
    conn = get_connection()
    c = conn.cursor()
    c.execute('SELECT is_premium FROM users WHERE id = ?', (user_id,))
    user = c.fetchone()
    if not user:
        conn.close()
        return jsonify({"detail": "User not found"}), 404
    
    new_status = 0 if user["is_premium"] else 1
    c.execute('UPDATE users SET is_premium = ? WHERE id = ?', (new_status, user_id))
    conn.commit()
    conn.close()
    return jsonify({"success": True, "new_status": bool(new_status)})

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=8000, debug=True)
