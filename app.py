from flask import Flask, render_template, request, jsonify, session, redirect, url_for
import sqlite3
import json
import ast
import os
import smtplib
from email.message import EmailMessage
from dotenv import load_dotenv
load_dotenv()
app = Flask(__name__)

app.secret_key = "royal-spice-secret-key"
def get_db():
    conn = sqlite3.connect("restaurant.db")
    conn.row_factory = sqlite3.Row
    return conn

def send_order_email(order_id, customer_name, phone, address, items, total):
    try:
        msg = EmailMessage()

        msg["Subject"] = f"🍽️ New Royal Spice Order #{order_id}"
        msg["From"] = os.getenv("EMAIL_ADDRESS")
        msg["To"] = os.getenv("EMAIL_TO")

        items_text = ""

        for item in items:
            dish = item.get("dish")
            quantity = item.get("quantity")
            price = item.get("price", 0)

            items_text += f"{dish} × {quantity} = ₹{price * quantity}\n"

        msg.set_content(f"""
New Order Received!

Order ID: #{order_id}

Customer: {customer_name}
Phone: {phone}
Address: {address}

Ordered Items:
{items_text}

Total: ₹{total}

Status: New
""")

        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
            server.login(
                os.getenv("EMAIL_ADDRESS"),
                os.getenv("EMAIL_APP_PASSWORD")
            )
            server.send_message(msg)

        return True

    except Exception as e:
        print("Email error:", e)
        return False

def parse_items(value):
    try:
        return json.loads(value)
    except (json.JSONDecodeError, TypeError):
        try:
            return ast.literal_eval(value)
        except (ValueError, SyntaxError):
            return []
        
def create_database():
    conn = get_db()

    conn.execute("""
        CREATE TABLE IF NOT EXISTS orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            customer_name TEXT NOT NULL,
            phone TEXT NOT NULL,
            address TEXT NOT NULL,
            items TEXT NOT NULL,
            total REAL NOT NULL,
            status TEXT DEFAULT 'New'
        )
    """)
         # ================= REVIEWS TABLE =================

    conn.execute("""
        CREATE TABLE IF NOT EXISTS reviews (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id INTEGER NOT NULL UNIQUE,
            customer_name TEXT NOT NULL,
            rating INTEGER NOT NULL,
            comment TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (order_id) REFERENCES orders(id)
        )
    """)
    # Add payment status column if it does not exist
    try:
        conn.execute("""
        ALTER TABLE orders
        ADD COLUMN payment_status TEXT DEFAULT 'Pending'
        """)
    except sqlite3.OperationalError:
        pass

    conn.commit()
    conn.close()


@app.route("/")
def home():
    return render_template("index.html")

@app.route("/login", methods=["GET", "POST"])
def login():

    if request.method == "POST":

        username = request.form.get("username")
        password = request.form.get("password")

        if username == "admin" and password == "royal123":

            session["admin_logged_in"] = True

            return redirect(url_for("admin"))

        return render_template(
            "login.html",
            error="Invalid username or password"
        )

    return render_template("login.html")

@app.route("/admin")
def admin():

    if not session.get("admin_logged_in"):
        return redirect(url_for("login"))

    conn = get_db()

    orders = conn.execute("""
        SELECT * FROM orders
        ORDER BY id DESC
    """).fetchall()

    orders = [
    {
        **dict(order),
        "items_list": parse_items(order["items"])
    }
    for order in orders
]

    total_orders = conn.execute("""
        SELECT COUNT(*) FROM orders
    """).fetchone()[0]

    new_orders = conn.execute("""
        SELECT COUNT(*) FROM orders
        WHERE status = 'New'
    """).fetchone()[0]

    preparing_orders = conn.execute("""
        SELECT COUNT(*) FROM orders
        WHERE status = 'Preparing'
    """).fetchone()[0]

    total_revenue = conn.execute("""
        SELECT COALESCE(SUM(total), 0)
        FROM orders
        WHERE status = 'Delivered'
    """).fetchone()[0]

    conn.close()

    return render_template(
        "admin.html",
        orders=orders,
        total_orders=total_orders,
        new_orders=new_orders,
        preparing_orders=preparing_orders,
        total_revenue=total_revenue
    )

@app.route("/logout")
def logout():

    session.pop("admin_logged_in", None)

    return redirect(url_for("login"))


@app.route("/api/order", methods=["POST"])
def place_order():

    data = request.get_json(silent=True) or {}

    customer_name = data.get("customer_name")
    phone = data.get("phone")
    address = data.get("address")
    items = data.get("items")

    # ================= BASIC VALIDATION =================

    if not customer_name or not phone or not address or not items:
        return jsonify({
            "success": False,
            "message": "Please fill all required details."
        }), 400

    # ================= BACKEND VALIDATION =================

    customer_name = str(customer_name).strip()
    phone = str(phone).strip()
    address = str(address).strip()

    if len(customer_name) < 2:
        return jsonify({
            "success": False,
            "message": "Invalid customer name."
        }), 400

    if not phone.isdigit() or len(phone) != 10:
        return jsonify({
            "success": False,
            "message": "Please enter a valid 10-digit phone number."
        }), 400

    if len(address) < 5:
        return jsonify({
            "success": False,
            "message": "Please enter a valid address."
        }), 400

    if not isinstance(items, list) or len(items) == 0:
        return jsonify({
            "success": False,
            "message": "Your cart is empty."
        }), 400

    # ================= SERVER-SIDE PRICE CALCULATION =================

    menu_prices = {
        "Butter Chicken": 299,
        "Paneer Tikka": 249,
        "Chicken Biryani": 279,
        "Garlic Naan": 89,
        "Veg Thali": 199,
        "Gulab Jamun": 99
    }

    calculated_total = 0

    for item in items:

        dish = item.get("dish")
        quantity = item.get("quantity")

        if dish not in menu_prices:
            return jsonify({
                "success": False,
                "message": f"Invalid dish: {dish}"
            }), 400

        try:
            quantity = int(quantity)
        except (TypeError, ValueError):
            return jsonify({
                "success": False,
                "message": "Invalid quantity."
            }), 400

        if quantity < 1:
            return jsonify({
                "success": False,
                "message": "Invalid quantity."
            }), 400

        calculated_total += menu_prices[dish] * quantity

    # Backend khud total calculate karega
    total = calculated_total

    # ================= SAVE ORDER =================

    conn = get_db()

    cursor = conn.execute("""
        INSERT INTO orders
        (customer_name, phone, address, items, total)
        VALUES (?, ?, ?, ?, ?)
    """, (
        customer_name,
        phone,
        address,
        str(items),
        total
    ))

    order_id = cursor.lastrowid
    conn.commit()
    conn.close()

    return jsonify({
        "success": True,
        "message": "Order placed successfully!",
        "order_id": order_id,
        "email_sent": False
    })

@app.route("/api/order/<int:order_id>/status", methods=["POST"])
def update_status(order_id):

    # 🔐 ADMIN SECURITY CHECK
    if not session.get("admin_logged_in"):
        return jsonify({
            "success": False,
            "message": "Admin login required."
        }), 401

    data = request.get_json(silent=True) or {}
    status = data.get("status")

    if status not in ["New", "Preparing", "Delivered"]:
        return jsonify({
            "success": False,
            "message": "Invalid status"
        }), 400

    conn = get_db()

    conn.execute("""
        UPDATE orders
        SET status = ?
        WHERE id = ?
    """, (status, order_id))

    conn.commit()
    conn.close()

    return jsonify({
        "success": True,
        "message": "Status updated successfully"
    })

@app.route("/api/order/<int:order_id>", methods=["GET"])
def get_order(order_id):

    conn = get_db()

    order = conn.execute("""
        SELECT id, customer_name, items, total, status
        FROM orders
        WHERE id = ?
    """, (order_id,)).fetchone()

    conn.close()

    if not order:
        return jsonify({
            "success": False,
            "message": "Order not found"
        }), 404

    return jsonify({
        "success": True,
        "order": {
            "id": order["id"],
            "customer_name": order["customer_name"],
            "items": parse_items(order["items"]),
            "total": order["total"],
            "status": order["status"]
        }
    })

# ================= SUBMIT REVIEW =================

@app.route("/api/review", methods=["POST"])
def submit_review():

    data = request.get_json(silent=True) or {}

    order_id = data.get("order_id")
    rating = data.get("rating")
    comment = data.get("comment", "").strip()

    if not order_id or not rating:
        return jsonify({
            "success": False,
            "message": "Order ID and rating are required."
        }), 400

    try:
        rating = int(rating)
    except (TypeError, ValueError):
        return jsonify({
            "success": False,
            "message": "Invalid rating."
        }), 400

    if rating < 1 or rating > 5:
        return jsonify({
            "success": False,
            "message": "Rating must be between 1 and 5."
        }), 400

    conn = get_db()

    # Check order
    order = conn.execute("""
        SELECT *
        FROM orders
        WHERE id = ?
    """, (order_id,)).fetchone()

    if not order:
        conn.close()

        return jsonify({
            "success": False,
            "message": "Order not found."
        }), 404

    # Only delivered orders can review
    if order["status"] != "Delivered":
        conn.close()

        return jsonify({
            "success": False,
            "message": "You can review only after the order is delivered."
        }), 400

    # Check duplicate review
    existing_review = conn.execute("""
        SELECT id
        FROM reviews
        WHERE order_id = ?
    """, (order_id,)).fetchone()

    if existing_review:
        conn.close()

        return jsonify({
            "success": False,
            "message": "You have already reviewed this order."
        }), 400

    # Save review
    conn.execute("""
        INSERT INTO reviews
        (order_id, customer_name, rating, comment)
        VALUES (?, ?, ?, ?)
    """, (
        order_id,
        order["customer_name"],
        rating,
        comment
    ))

    conn.commit()
    conn.close()

    return jsonify({
        "success": True,
        "message": "Thank you for your review!"
    })
# ================= GET REVIEWS =================

@app.route("/api/reviews", methods=["GET"])
def get_reviews():

    conn = get_db()

    reviews = conn.execute("""
        SELECT *
        FROM reviews
        ORDER BY id DESC
    """).fetchall()

    average = conn.execute("""
        SELECT AVG(rating) AS average_rating
        FROM reviews
    """).fetchone()

    average_rating = average["average_rating"] or 0

    review_list = []

    for review in reviews:

        review_list.append({
            "id": review["id"],
            "order_id": review["order_id"],
            "customer_name": review["customer_name"],
            "rating": review["rating"],
            "comment": review["comment"],
            "created_at": review["created_at"]
        })

    conn.close()

    return jsonify({
        "success": True,
        "average_rating": round(average_rating, 1),
        "total_reviews": len(review_list),
        "reviews": review_list
    })
@app.route("/api/order/<int:order_id>", methods=["DELETE"])
def delete_order(order_id):
    if not session.get("admin_logged_in"):
        return jsonify({
            "success": False,
            "message": "Admin login required."
        }), 401
    conn = get_db()

    cursor = conn.execute(
        "DELETE FROM orders WHERE id = ?",
        (order_id,)
    )

    conn.commit()
    conn.close()

    if cursor.rowcount == 0:
        return jsonify({
            "success": False,
            "message": "Order not found"
        }), 404

    return jsonify({
        "success": True,
        "message": "Order deleted successfully"
    })

if __name__ == "__main__":
    create_database()
    app.run(host="0.0.0.0", port=5000, debug=True)