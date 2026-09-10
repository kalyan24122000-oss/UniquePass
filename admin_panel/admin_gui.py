import tkinter as tk
from tkinter import ttk, messagebox
import urllib.request
import urllib.parse
import urllib.error
import json
import os

class AdminGUI:
    def __init__(self, root):
        self.root = root
        self.root.title("UniquePass Remote Admin")
        self.root.geometry("450x450")
        self.root.configure(padx=20, pady=20)

        # Variables
        self.server_url = tk.StringVar(value="https://uniquepass.onrender.com")
        self.admin_key = tk.StringVar(value="super-secret-admin-key")
        self.search_var = tk.StringVar()
        
        self.current_user_id = tk.StringVar()
        self.name_var = tk.StringVar()
        self.email_var = tk.StringVar()
        self.premium_var = tk.StringVar()

        self.setup_ui()

    def setup_ui(self):
        # Settings
        ttk.Label(self.root, text="Server Settings", font=("Helvetica", 12, "bold")).pack(anchor="w", pady=(0, 5))
        
        settings_frame = ttk.Frame(self.root)
        settings_frame.pack(fill="x", pady=5)
        
        ttk.Label(settings_frame, text="Server URL:").grid(row=0, column=0, sticky="w", pady=2)
        ttk.Entry(settings_frame, textvariable=self.server_url, width=30).grid(row=0, column=1, sticky="w", padx=10, pady=2)
        
        ttk.Label(settings_frame, text="Admin Key:").grid(row=1, column=0, sticky="w", pady=2)
        ttk.Entry(settings_frame, textvariable=self.admin_key, show="*").grid(row=1, column=1, sticky="w", padx=10, pady=2)

        ttk.Separator(self.root, orient="horizontal").pack(fill="x", pady=15)

        # Search Section
        ttk.Label(self.root, text="Search User", font=("Helvetica", 12, "bold")).pack(anchor="w", pady=(0, 5))
        search_frame = ttk.Frame(self.root)
        search_frame.pack(fill="x", pady=5)
        ttk.Entry(search_frame, textvariable=self.search_var, width=35).pack(side="left", fill="x", expand=True, padx=(0, 10))
        ttk.Button(search_frame, text="Search", command=self.search_user).pack(side="right")

        ttk.Separator(self.root, orient="horizontal").pack(fill="x", pady=15)

        # Details Section
        ttk.Label(self.root, text="User Details", font=("Helvetica", 12, "bold")).pack(anchor="w", pady=(0, 10))

        details_frame = ttk.Frame(self.root)
        details_frame.pack(fill="x")

        ttk.Label(details_frame, text="ID:").grid(row=0, column=0, sticky="w", pady=4)
        ttk.Label(details_frame, textvariable=self.current_user_id).grid(row=0, column=1, sticky="w", padx=10, pady=4)

        ttk.Label(details_frame, text="Name:").grid(row=1, column=0, sticky="w", pady=4)
        ttk.Label(details_frame, textvariable=self.name_var).grid(row=1, column=1, sticky="w", padx=10, pady=4)

        ttk.Label(details_frame, text="Email:").grid(row=2, column=0, sticky="w", pady=4)
        ttk.Label(details_frame, textvariable=self.email_var).grid(row=2, column=1, sticky="w", padx=10, pady=4)

        ttk.Label(details_frame, text="Premium:").grid(row=3, column=0, sticky="w", pady=4)
        ttk.Label(details_frame, textvariable=self.premium_var, font=("Helvetica", 10, "bold")).grid(row=3, column=1, sticky="w", padx=10, pady=4)

        self.toggle_btn = ttk.Button(self.root, text="Toggle Premium", command=self.toggle_premium, state="disabled")
        self.toggle_btn.pack(pady=20, fill="x")

    def make_request(self, endpoint, method="GET", data=None):
        url = self.server_url.get().rstrip("/") + endpoint
        headers = {
            "X-Admin-Key": self.admin_key.get(),
            "Content-Type": "application/json"
        }
        
        req_data = None
        if data:
            req_data = json.dumps(data).encode("utf-8")
            
        req = urllib.request.Request(url, data=req_data, headers=headers, method=method)
        
        try:
            with urllib.request.urlopen(req) as response:
                return json.loads(response.read().decode())
        except urllib.error.HTTPError as e:
            err_msg = e.read().decode()
            try:
                err_msg = json.loads(err_msg).get("detail", err_msg)
            except:
                pass
            raise Exception(f"HTTP {e.code}: {err_msg}")
        except Exception as e:
            raise Exception(str(e))

    def search_user(self):
        query = self.search_var.get().strip()
        if not query:
            return

        try:
            user = self.make_request(f"/admin/search?query={urllib.parse.quote(query)}")
            self.current_user_id.set(user["id"])
            self.name_var.set(user["name"])
            self.email_var.set(user["email"])
            self.premium_var.set("Active" if user["is_premium"] else "Inactive")
            self.toggle_btn.config(state="normal", text="Revoke Premium" if user["is_premium"] else "Grant Premium")
        except Exception as e:
            messagebox.showerror("Search Error", str(e))
            self.clear_details()

    def toggle_premium(self):
        user_id = self.current_user_id.get()
        if not user_id: return

        try:
            res = self.make_request("/admin/toggle_premium", method="POST", data={"user_id": user_id})
            if res.get("success"):
                new_status = res.get("new_status")
                messagebox.showinfo("Success", f"Premium status updated to {'Active' if new_status else 'Inactive'}!")
                self.search_user() # Refresh UI
        except Exception as e:
            messagebox.showerror("Update Error", str(e))

    def clear_details(self):
        self.current_user_id.set("")
        self.name_var.set("")
        self.email_var.set("")
        self.premium_var.set("")
        self.toggle_btn.config(state="disabled", text="Toggle Premium")

if __name__ == "__main__":
    root = tk.Tk()
    app = AdminGUI(root)
    root.mainloop()
