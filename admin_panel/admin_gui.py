import tkinter as tk
from tkinter import ttk, messagebox
import sqlite3
import os

# Connect to the DB from admin_panel directory to backend directory
DB_PATH = os.path.join(os.path.dirname(__file__), "..", "backend", "passwords.db")

def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def search_user():
    query = search_var.get().strip()
    if not query:
        return

    try:
        conn = get_connection()
        c = conn.cursor()
        c.execute('SELECT * FROM users WHERE id = ? OR email = ?', (query, query))
        user = c.fetchone()
        conn.close()

        if user:
            current_user_id.set(user["id"])
            name_var.set(user["name"])
            email_var.set(user["email"])
            premium_var.set("Active" if user["is_premium"] else "Inactive")
            toggle_btn.config(state="normal", text="Revoke Premium" if user["is_premium"] else "Grant Premium")
        else:
            messagebox.showerror("Not Found", "User not found.")
            clear_details()
    except Exception as e:
        messagebox.showerror("DB Error", str(e))

def toggle_premium():
    user_id = current_user_id.get()
    if not user_id: return

    try:
        conn = get_connection()
        c = conn.cursor()
        c.execute('SELECT is_premium FROM users WHERE id = ?', (user_id,))
        user = c.fetchone()
        
        if user:
            new_status = 0 if user["is_premium"] else 1
            c.execute('UPDATE users SET is_premium = ? WHERE id = ?', (new_status, user_id))
            conn.commit()
            messagebox.showinfo("Success", f"Premium status updated to {'Active' if new_status else 'Inactive'}!")
            
            # Refresh UI
            search_user()
        conn.close()
    except Exception as e:
        messagebox.showerror("DB Error", str(e))

def clear_details():
    current_user_id.set("")
    name_var.set("")
    email_var.set("")
    premium_var.set("")
    toggle_btn.config(state="disabled", text="Toggle Premium")

app = tk.Tk()
app.title("UniquePass Control Panel")
app.geometry("420x350")
app.configure(padx=20, pady=20)

# Variables
search_var = tk.StringVar()
current_user_id = tk.StringVar()
name_var = tk.StringVar()
email_var = tk.StringVar()
premium_var = tk.StringVar()

# Header
ttk.Label(app, text="Manage UniquePass Premium", font=("Helvetica", 14, "bold")).pack(anchor="center", pady=(0, 20))

# Search Section
search_frame = ttk.Frame(app)
search_frame.pack(fill="x", pady=5)
ttk.Label(search_frame, text="Search User (ID or Email):").pack(anchor="w")
entry_frame = ttk.Frame(search_frame)
entry_frame.pack(fill="x", pady=5)
ttk.Entry(entry_frame, textvariable=search_var, width=35).pack(side="left", fill="x", expand=True, padx=(0, 10))
ttk.Button(entry_frame, text="Search", command=search_user).pack(side="right")

ttk.Separator(app, orient="horizontal").pack(fill="x", pady=15)

# Details Section
details_frame = ttk.Frame(app)
details_frame.pack(fill="x")

ttk.Label(details_frame, text="ID:").grid(row=0, column=0, sticky="w", pady=4)
ttk.Label(details_frame, textvariable=current_user_id).grid(row=0, column=1, sticky="w", padx=10, pady=4)

ttk.Label(details_frame, text="Name:").grid(row=1, column=0, sticky="w", pady=4)
ttk.Label(details_frame, textvariable=name_var).grid(row=1, column=1, sticky="w", padx=10, pady=4)

ttk.Label(details_frame, text="Email:").grid(row=2, column=0, sticky="w", pady=4)
ttk.Label(details_frame, textvariable=email_var).grid(row=2, column=1, sticky="w", padx=10, pady=4)

ttk.Label(details_frame, text="Premium:").grid(row=3, column=0, sticky="w", pady=4)
ttk.Label(details_frame, textvariable=premium_var, font=("Helvetica", 10, "bold")).grid(row=3, column=1, sticky="w", padx=10, pady=4)

toggle_btn = ttk.Button(app, text="Toggle Premium", command=toggle_premium, state="disabled")
toggle_btn.pack(pady=20, fill="x")

app.mainloop()
