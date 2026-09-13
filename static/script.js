// ================= MOBILE MENU =================

const menuToggle = document.querySelector("#menuToggle");
const navLinks = document.querySelector("#navLinks");

if (menuToggle) {
    menuToggle.addEventListener("click", () => {
        navLinks.classList.toggle("active");
    });
}


// ================= MENU PRICES =================

const prices = {
    "Butter Chicken": 299,
    "Paneer Tikka": 249,
    "Chicken Biryani": 279,
    "Garlic Naan": 89,
    "Veg Thali": 199,
    "Gulab Jamun": 99
};


// ================= SHOPPING CART =================

let cart = [];


// Create cart box automatically

const orderSection = document.querySelector("#order");

if (orderSection) {

    const cartBox = document.createElement("div");

    cartBox.id = "cartBox";

    cartBox.innerHTML = `
        <h2>🛒 Your Cart</h2>

        <div id="cartItems">
            <p>Your cart is empty.</p>
        </div>

        <div id="cartTotal">
            Total: ₹0
        </div>
    `;

    orderSection.insertBefore(
        cartBox,
        orderSection.firstChild
    );
}


// ================= ADD TO CART =================

const addButtons = document.querySelectorAll(".add-btn");

addButtons.forEach(button => {

    button.addEventListener("click", () => {

        const item =
            button.getAttribute("data-item");

        const price = prices[item];

        if (!price) {
            alert("Item price not found.");
            return;
        }


        // Check if item already exists

        const existingItem =
            cart.find(product => product.dish === item);


        if (existingItem) {

            existingItem.quantity++;

        } else {

            cart.push({
                dish: item,
                quantity: 1,
                price: price
            });

        }


        updateCart();


        // Scroll to order section

        if (orderSection) {

            orderSection.scrollIntoView({
                behavior: "smooth"
            });

        }

    });

});


// ================= UPDATE CART =================

function updateCart() {

    const cartItems =
        document.querySelector("#cartItems");

    const cartTotal =
        document.querySelector("#cartTotal");


    if (!cartItems || !cartTotal) {
        return;
    }


    // Empty cart

    if (cart.length === 0) {

        cartItems.innerHTML =
            "<p>Your cart is empty.</p>";

        cartTotal.textContent =
            "Total: ₹0";

        return;
    }


    let total = 0;

    cartItems.innerHTML = "";


    cart.forEach((item, index) => {

        const itemTotal =
            item.price * item.quantity;

        total += itemTotal;


        const div =
            document.createElement("div");

        div.className = "cart-item";


        div.innerHTML = `
            <div>
                <strong>${item.dish}</strong>
                <br>
                ₹${item.price} × ${item.quantity}
            </div>

            <div>

                <button
                    type="button"
                    onclick="decreaseItem(${index})">
                    −
                </button>

                <span>
                    ${item.quantity}
                </span>

                <button
                    type="button"
                    onclick="increaseItem(${index})">
                    +
                </button>

                <button
                    type="button"
                    onclick="removeItem(${index})">
                    ❌
                </button>

            </div>
        `;


        cartItems.appendChild(div);

    });


    cartTotal.textContent =
        "Total: ₹" + total;

}


// ================= INCREASE ITEM =================

function increaseItem(index) {

    cart[index].quantity++;

    updateCart();

}


// ================= DECREASE ITEM =================

function decreaseItem(index) {

    if (cart[index].quantity > 1) {

        cart[index].quantity--;

    } else {

        cart.splice(index, 1);

    }

    updateCart();

}


// ================= REMOVE ITEM =================

function removeItem(index) {

    cart.splice(index, 1);

    updateCart();

}

// ================= ORDER FORM =================

const orderForm =
    document.querySelector("#orderForm");

let isSubmitting = false;

if (orderForm) {

    orderForm.addEventListener(
        "submit",
        async function (event) {

            event.preventDefault();

            // Prevent duplicate order
            if (isSubmitting) {
                return;
            }

            isSubmitting = true;

            // Customer details

            const name =
                document
                    .querySelector("#name")
                    .value
                    .trim();

            const phone =
                document
                    .querySelector("#phone")
                    .value
                    .trim();

            const address =
                document
                    .querySelector("#address")
                    .value
                    .trim();


            // Check cart

            if (cart.length === 0) {

                alert(
                    "🛒 Please add at least one item to your cart."
                );

                isSubmitting = false;
                return;
            }


            // Calculate total

            let total = 0;

            cart.forEach(item => {

                total +=
                    item.price * item.quantity;

            });


            // PHONE VALIDATION

            if (!/^[0-9]{10}$/.test(phone)) {

                alert(
                    "❌ Please enter a valid 10-digit phone number."
                );

                isSubmitting = false;
                return;
            }


            // NAME VALIDATION

            if (name.length < 2) {

                alert(
                    "❌ Please enter a valid name."
                );

                isSubmitting = false;
                return;
            }


            // ADDRESS VALIDATION

            if (address.length < 5) {

                alert(
                    "❌ Please enter a valid address."
                );

                isSubmitting = false;
                return;
            }


            // ================= ORDER DATA =================

            const orderData = {

                customer_name: name,

                phone: phone,

                address: address,

                items: cart,

                total: total

            };

            
            // ================= SEND TO FLASK =================

            try {

                const response =
                    await fetch(
                        "/api/order",
                        {
                            method: "POST",

                            headers: {
                                "Content-Type":
                                    "application/json"
                            },

                            body:
                                JSON.stringify(
                                    orderData
                                )
                        }
                    );


                const result =
                    await response.json();


                if (result.success) {

                    document
                        .querySelector("#successOrderId")
                        .textContent = result.order_id;

                    document
                        .querySelector("#successTotal")
                        .textContent = total;

                    document
                        .querySelector("#successModal")
                        .classList.add("show");


                    // Empty cart

                    cart = [];

                    updateCart();


                    // Reset form

                    orderForm.reset();


                } else {

                    alert(
                        "❌ " + result.message
                    );

                }


            } catch (error) {

                console.error(
                    "Order Error:",
                    error
                );

                alert(
                    "❌ Server se connection nahi ho paya."
                );


            } finally {

                // Allow next order

                isSubmitting = false;

            }

        }
    );

}

// ================= ORDER TRACKING =================
let trackingInterval = null;
// ================= ORDER TRACKING =================

async function trackOrder() {

    const orderId =
        document.querySelector("#trackOrderId").value.trim();

    const resultBox =
        document.querySelector("#trackingResult");

    if (!orderId) {

        resultBox.innerHTML =
            "<p>⚠️ Please enter your Order ID.</p>";

        return;
    }

    try {

        const response =
            await fetch(`/api/order/${orderId}`);

        const result =
            await response.json();

        if (!result.success) {

            resultBox.innerHTML =
                "<p>❌ Order not found.</p>";

            return;
        }

        const order = result.order;


        // ================= STATUS =================

        let newClass = "";
        let preparingClass = "";
        let deliveredClass = "";

        if (order.status === "New") {

            newClass = "active";

        }

        if (order.status === "Preparing") {

            newClass = "completed";
            preparingClass = "active";

        }

        if (order.status === "Delivered") {

            newClass = "completed";
            preparingClass = "completed";
            deliveredClass = "active";

        }


        // ================= ORDER ITEMS =================

        const itemsHTML = order.items.map(item => `

            <div class="tracking-item">

                <span>
                    ${item.dish} × ${item.quantity}
                </span>

                <strong>
                    ₹${item.price * item.quantity}
                </strong>

            </div>

        `).join("");
       // ================= CUSTOMER RATING =================

let reviewHTML = "";

if (order.status === "Delivered") {
    reviewHTML = `
        <div class="review-box">
            <h3>⭐ Rate Your Experience</h3>
            <p>How was your Royal Spice order?</p>

            <div class="star-rating">
                <button type="button" onclick="selectRating(1)">★</button>
                <button type="button" onclick="selectRating(2)">★</button>
                <button type="button" onclick="selectRating(3)">★</button>
                <button type="button" onclick="selectRating(4)">★</button>
                <button type="button" onclick="selectRating(5)">★</button>
            </div>

            <textarea
                id="reviewComment"
                placeholder="Write your review (optional)..."
                rows="4"></textarea>

            <button
                type="button"
                class="submit-review-btn"
                onclick="submitReview(${order.id})">
                Submit Review
            </button>

            <p id="reviewMessage" class="review-message"></p>
        </div>
    `;
}




         
        // ================= SHOW RESULT =================
         
        resultBox.innerHTML = `

            <div class="tracking-card">

                <h3>Order #${order.id}</h3>

                <p>
                    <strong>Customer:</strong>
                    ${order.customer_name}
                </p>


                <!-- STATUS TIMELINE -->

                <div class="tracking-timeline">

                    <div class="track-step ${newClass}">

                        <div class="track-icon">
                            📦
                        </div>

                        <div>
                            <strong>Order Placed</strong>
                            <small>New</small>
                        </div>

                    </div>


                    <div class="track-line"></div>


                    <div class="track-step ${preparingClass}">

                        <div class="track-icon">
                            👨‍🍳
                        </div>

                        <div>
                            <strong>Preparing</strong>
                            <small>Kitchen is preparing</small>
                        </div>

                    </div>


                    <div class="track-line"></div>


                    <div class="track-step ${deliveredClass}">

                        <div class="track-icon">
                            🛵
                        </div>

                        <div>
                            <strong>Delivered</strong>
                            <small>Order delivered</small>
                        </div>

                    </div>

                </div>


                <!-- ORDER ITEMS -->

                <div class="tracking-items">

                    <h4>📦 Ordered Items</h4>

                    ${itemsHTML}

                </div>


                <!-- TOTAL -->

                <div class="tracking-total">

                    <span>Total</span>

                    <strong>
                        ₹${order.total}
                    </strong>

                </div>
                     ${reviewHTML}
            </div>

        `;


        // ================= AUTO REFRESH =================
// ================= AUTO REFRESH =================



      

    } catch (error) {

        console.error(error);

        resultBox.innerHTML =
            "<p>❌ Server se connection nahi ho paya.</p>";

    }

}

// ================= SUCCESS POPUP =================

function closeSuccessModal() {

    document
        .querySelector("#successModal")
        .classList.remove("show");

}


function goToTracking() {

    closeSuccessModal();

    document
        .querySelector("#track")
        .scrollIntoView({
            behavior: "smooth"
        });

}

// ================= CUSTOMER RATING =================

let selectedRating = 0;

function selectRating(rating) {

    selectedRating = rating;

    const stars =
        document.querySelectorAll(".star-rating button");

    stars.forEach((star, index) => {

        if (index < rating) {
            star.classList.add("selected");
        } else {
            star.classList.remove("selected");
        }

    });
}


// ================= SUBMIT REVIEW =================

async function submitReview(orderId) {

    const message =
        document.querySelector("#reviewMessage");

    const comment =
        document.querySelector("#reviewComment").value.trim();


    if (selectedRating === 0) {

        message.textContent =
            "⭐ Please select a rating.";

        return;
    }


    try {

        const response =
            await fetch("/api/review", {

                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({

                    order_id: orderId,

                    rating: selectedRating,

                    comment: comment

                })

            });


        const result =
            await response.json();


        if (result.success) {

            message.textContent =
                "✅ Thank you for your review!";


            document
                .querySelector(".submit-review-btn")
                .disabled = true;


            document
                .querySelector("#reviewComment")
                .disabled = true;


            document
                .querySelectorAll(".star-rating button")
                .forEach(button => {

                    button.disabled = true;

                });


            loadReviews();


        } else {

            message.textContent =
                "❌ " + result.message;

        }


    } catch (error) {

        console.error(
            "Review Error:",
            error
        );

        message.textContent =
            "❌ Server connection failed.";

    }

}
// Initial cart display


// ================= LOAD REVIEWS =================

async function loadReviews() {

    const container =
        document.querySelector("#reviewsContainer");

    if (!container) {
        return;
    }


    try {

        const response =
            await fetch("/api/reviews");

        const result =
            await response.json();


        if (!result.success) {
            return;
        }


        // Average rating

        document.querySelector(
            "#averageRating"
        ).textContent =
            result.average_rating;


        document.querySelector(
            "#totalReviews"
        ).textContent =
            result.total_reviews;


        // Average stars

        const rounded =
            Math.round(result.average_rating);

        document.querySelector(
            "#averageStars"
        ).textContent =
            "★".repeat(rounded) +
            "☆".repeat(5 - rounded);


        // No reviews

        if (result.reviews.length === 0) {

            container.innerHTML = `
                <div class="no-reviews">
                    <h3>No reviews yet</h3>
                    <p>Be the first to review Royal Spice!</p>
                </div>
            `;

            return;
        }


        // Reviews

        container.innerHTML =
            result.reviews.map(review => `

                <div class="review-card">

                    <div class="review-top">

                        <div>

                            <h3>
                                ${review.customer_name}
                            </h3>

                            <span>
                                Order #${review.order_id}
                            </span>

                        </div>


                        <div class="review-stars">

                            ${
                                "★".repeat(review.rating)
                            }${
                                "☆".repeat(5 - review.rating)
                            }

                        </div>

                    </div>


                    ${
                        review.comment
                        ?
                        `<p class="review-comment">
                            "${review.comment}"
                        </p>`
                        :
                        ""
                    }

                </div>

            `).join("");


    } catch (error) {

        console.error(
            "Reviews Error:",
            error
        );

    }

}


// Load reviews when page opens

document.addEventListener(
    "DOMContentLoaded",
    loadReviews
);
updateCart();