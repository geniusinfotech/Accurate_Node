# glitera Computer Store - Backend API Documentation

Complete API reference for the glitera Computer Store backend. This document provides all endpoints with request/response examples to help you design the frontend.

**Base URL**: `http://localhost:9004`  
**Authentication**: JWT Bearer Token (where required)

## Table of Contents
- [Authentication](#authentication)
- [Users](#users)
- [Managers](#managers)
- [Admins](#admins)
- [Activity & Tracking](#activity--tracking)
- [Products](#products)
- [Categories](#categories)
- [Cart](#cart)
- [Wishlist](#wishlist)
- [Orders](#orders)
- [Reviews](#reviews)
- [Testimonials](#testimonials)
- [Custom Requests (Build PC)](#custom-requests)
- [Bot/Chat](#bot)
- [Payment](#payment)
- [Deals & Offers](#deals--offers)

---

## 🔐 Authentication

### Register User
**POST** `/auth/register`

**Request Body:**
```json
{
  "firstname": "John",
  "lastname": "Doe",
  "email": "john@example.com",
  "password": "SecurePass123!",
  "phone": "+1234567890",
  "address": {
    "street": "123 Main St",
    "city": "New York",
    "state": "NY",
    "zip": "10001",
    "country": "USA"
  }
}
```

**Response (201):**
```json
{
  "_id": "507f1f77bcf86cd799439011",
  "firstname": "John",
  "lastname": "Doe",
  "username": "john",
  "email": "john@example.com",
  "roles": ["user"],
  "createdAt": "2026-01-25T10:00:00.000Z",
  "updatedAt": "2026-01-25T10:00:00.000Z"
}
```

---

### Login
**POST** `/auth/login`

**Request Body:**
```json
{
  "email": "john@example.com",
  "password": "SecurePass123!"
}
```

**Response (200):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "userId": "507f1f77bcf86cd799439011",
  "email": "john@example.com",
  "roles": ["user"],
  "username": "john",
  "createdAt": "2026-01-25T10:00:00.000Z",
  "updatedAt": "2026-01-25T10:00:00.000Z"
}
```

---

### Get Current User
**GET** `/auth/me`  
**Auth Required**: Yes

**Response (200):**
```json
{
  "_id": "507f1f77bcf86cd799439011",
  "firstname": "John",
  "lastname": "Doe",
  "username": "john",
  "email": "john@example.com",
  "roles": ["user"]
}
```

---

### Change Password
**POST** `/auth/change-password`  
**Auth Required**: Yes

**Request Body:**
```json
{
  "oldPassword": "OldSecurePass123!",
  "newPassword": "NewSecurePass123!"
}
```

**Response (200):**
```json
{
  "message": "Password changed successfully"
}
```

---

### Forgot Password
**POST** `/auth/forgot-password`

**Request Body:**
```json
{
  "email": "john@example.com"
}
```

**Response (200):**
```json
{
  "message": "If the email exists, a password reset link has been sent"
}
```

---

### Reset Password
**POST** `/auth/reset-password`

**Request Body:**
```json
{
  "token": "reset-token-from-email",
  "newPassword": "NewSecurePass123!"
}
```

**Response (200):**
```json
{
  "message": "Password reset successfully"
}
```

---

### Logout
**POST** `/auth/logout`  
**Auth Required**: Yes

**Response (200):**
```json
{
  "message": "Successfully logged out",
  "username": "john",
  "timestamp": "2026-01-25T10:30:00.000Z"
}
```

---

## 👤 Users

### Get My Profile
**GET** `/users/me`  
**Auth Required**: Yes

**Response (200):**
```json
{
  "_id": "507f1f77bcf86cd799439011",
  "firstname": "John",
  "lastname": "Doe",
  "username": "john",
  "email": "john@example.com",
  "phone": "+1234567890",
  "address": {
    "street": "123 Main St",
    "city": "New York",
    "state": "NY",
    "zip": "10001",
    "country": "USA"
  },
  "roles": ["user"],
  "isActive": true,
  "createdAt": "2026-01-25T10:00:00.000Z",
  "updatedAt": "2026-01-25T10:00:00.000Z"
}
```

---

### List All Users (Admin Only)
**GET** `/users`  
**Auth Required**: Yes (Admin)

**Response (200):**
```json
[
  {
    "_id": "507f1f77bcf86cd799439011",
    "firstname": "John",
    "lastname": "Doe",
    "email": "john@example.com",
    "roles": ["user"],
    "isActive": true,
    "createdAt": "2026-01-25T10:00:00.000Z"
  }
]
```

---

## 👔 Managers

### Create Manager
**POST** `/managers`  
**Auth Required**: Yes (Admin)

**Request Body:**
```json
{
  "firstname": "John",
  "lastname": "Doe",
  "email": "john@example.com",
  "password": "securepassword",
  "permissions": ["ORDERS_VIEW"],
  "dashboardWidgets": ["Orders"]
}
```

### Get My Configuration
**GET** `/managers/me/config`  
**Auth Required**: Yes (Manager/Admin)
**Description**: Fetch current manager permissions and dashboard layout.

### List All Managers
**GET** `/managers`  
**Auth Required**: Yes (Admin)

### Update Manager Permissions
**PATCH** `/managers/:userId/permissions`  
**Auth Required**: Yes (Admin)

### Update Manager Status
**PATCH** `/managers/:userId/status`  
**Auth Required**: Yes (Admin)

---

## 👑 Admins

### Create Admin
**POST** `/admins`  
**Auth Required**: Yes (Admin)
**Description**: Creates a new admin account and profile.

### Get My Configuration
**GET** `/admins/me/config`  
**Auth Required**: Yes (Admin)

### Update Admin Settings
**PATCH** `/admins/:userId/settings`  
**Auth Required**: Yes (Admin)

---

## 📉 Activity & Tracking

### Session Security
- **Auto-Logout**: Admin & Manager sessions expire after **30 minutes of inactivity**.
- **Inactivity Detection**: Requests with a gap > **5 minutes** result in "Idle" time calculation.

### Get Manager Activity Report
**GET** `/managers/activity/report`  
**Auth Required**: Yes (Admin)
**Query Params**: `startDate`, `endDate` (ISO Strings)

**Response:**
```json
[
  {
    "manager": "John Doe",
    "totalHours": 42.5,
    "activeHours": 38.2,
    "idleHours": 4.3,
    "sessionCount": 12
  }
]
```

---

### Update User Roles (Admin Only)
**PATCH** `/users/:id/roles`  
**Auth Required**: Yes (Admin)

**Request Body:**
```json
{
  "roles": ["user", "manager"]
}
```

**Response (200):**
```json
{
  "_id": "507f1f77bcf86cd799439011",
  "roles": ["user", "manager"]
}
```

---

### Update User Status (Admin Only)
**PATCH** `/users/:id/status`  
**Auth Required**: Yes (Admin)

**Request Body:**
```json
{
  "isActive": false
}
```

**Response (200):**
```json
{
  "_id": "507f1f77bcf86cd799439011",
  "isActive": false
}
```

---

### Get User's Wishlist (Admin Only)
**GET** `/users/:id/wishlist`  
**Auth Required**: Yes (Admin/Manager)

**Response (200):**
```json
{
  "userId": "507f1f77bcf86cd799439011",
  "products": [
    {
      "_id": "607f1f77bcf86cd799439013",
      "name": "Dell XPS 15",
      "price": 1499.99,
      "image": "dell-xps-15.jpg"
    }
  ]
}
```

---

## 🛍 Products

### List All Products
**GET** `/products`  
**Query Parameters:**
- `page` (default: 1)
- `limit` (default: 10)
- `search` (optional)

**Example**: `/products?page=1&limit=20&search=laptop`

**Response (200):**
```json
{
  "products": [
    {
      "_id": "607f1f77bcf86cd799439013",
      "name": "Dell XPS 15",
      "description": "High-performance laptop",
      "price": 1499.99,
      "discount": 10,
      "stock": 25,
      "categoryName": "Laptops",
      "categoryId": "507f1f77bcf86cd799439015",
      "brand": "Dell",
      "productType": "Laptop",
      "productCategory": "Laptop/Notebook",
      "images": ["dell-xps-1.jpg", "dell-xps-2.jpg"],
      "image": "dell-xps-1.jpg",
      "sku": "DELL-XPS-15-001",
      "averageRating": 4.5,
      "numReviews": 120,
      "isActive": true,
      "isNewProduct": false,
      "categoryFields": {
        "processor": "Intel i7-12700H",
        "ram": "16GB DDR5",
        "storage": "512GB NVMe SSD",
        "display": "15.6\" FHD"
      },
      "createdAt": "2026-01-20T10:00:00.000Z",
      "updatedAt": "2026-01-25T10:00:00.000Z"
    }
  ],
  "total": 150,
  "page": 1,
  "limit": 20
}
```

---

### Get Single Product
**GET** `/products/:id`

**Response (200):**
```json
{
  "_id": "607f1f77bcf86cd799439013",
  "name": "Dell XPS 15",
  "description": "High-performance laptop with latest Intel processors",
  "price": 1499.99,
  "discount": 10,
  "stock": 25,
  "categoryName": "Laptops",
  "brand": "Dell",
  "images": ["dell-xps-1.jpg", "dell-xps-2.jpg"],
  "sku": "DELL-XPS-15-001",
  "averageRating": 4.5,
  "numReviews": 120,
  "categoryFields": {
    "processor": "Intel i7-12700H",
    "ram": "16GB DDR5",
    "storage": "512GB NVMe SSD"
  }
}
```

---

### Get Products by Category
**GET** `/products/category/:category`

**Example**: `/products/category/Laptops`

**Response (200):**
```json
[
  {
    "_id": "607f1f77bcf86cd799439013",
    "name": "Dell XPS 15",
    "price": 1499.99,
    "categoryName": "Laptops"
  }
]
```

---

### Create Product (Admin/Manager)
**POST** `/products`  
**Auth Required**: Yes (Admin/Manager)  
**Content-Type**: `multipart/form-data`

**Form Data:**
```
name: Dell XPS 15
description: High-performance laptop
price: 1499.99
stock: 25
categoryName: Laptops
categoryId: 507f1f77bcf86cd799439015
brand: Dell
productType: Laptop
productCategory: Laptop/Notebook
sku: DELL-XPS-15-001
images: [File, File] (multiple files)
categoryFields: {"processor": "Intel i7", "ram": "16GB"}
```

**Response (201):**
```json
{
  "_id": "607f1f77bcf86cd799439013",
  "name": "Dell XPS 15",
  "price": 1499.99,
  "images": ["image-1643123456.jpg", "image-1643123457.jpg"]
}
```

---

### Update Product (Admin/Manager)
**PATCH** `/products/:id`  
**Auth Required**: Yes (Admin/Manager)  
**Content-Type**: `multipart/form-data`

**Form Data:**
```
price: 1399.99
stock: 30
images: [File] (optional - new images)
```

**Response (200):**
```json
{
  "_id": "607f1f77bcf86cd799439013",
  "price": 1399.99,
  "stock": 30
}
```

---

### Delete Product (Admin/Manager)
**DELETE** `/products/:id`  
**Auth Required**: Yes (Admin/Manager)

**Response (200):**
```json
{
  "message": "Product deleted successfully"
}
```

---

### Bulk Upload Products (Admin/Manager)
**POST** `/products/bulk-upload`  
**Auth Required**: Yes (Admin/Manager)  
**Content-Type**: `multipart/form-data`  
**Query Parameters:**
- `productCategory` (optional): e.g., "Laptop/Notebook"

**Form Data:**
```
file: products.xlsx
```

**Response (200):**
```json
{
  "message": "Bulk upload completed",
  "created": 45,
  "failed": 5,
  "errors": [
    {
      "row": 12,
      "error": "Missing required field: sku"
    }
  ]
}
```

---

### Bulk Price Update (Admin/Manager)
**POST** `/products/bulk-price-update`  
**Auth Required**: Yes (Admin/Manager)  
**Content-Type**: `multipart/form-data`

**Form Data:**
```
file: price-update.xlsx
```

**Response (200):**
```json
{
  "message": "Prices updated successfully",
  "updated": 30
}
```

---

### Find Compatible Parts
**GET** `/products/pc-builder/compatibility`  
**Query Parameters:**
- `category`: Part category (e.g., "RAM")
- `baseProductId`: Base product ID (e.g., motherboard ID)

**Example**: `/products/pc-builder/compatibility?category=RAM&baseProductId=507f1f77bcf86cd799439013`

**Response (200):**
```json
[
  {
    "_id": "607f1f77bcf86cd799439014",
    "name": "Corsair Vengeance 16GB DDR4",
    "price": 89.99,
    "compatibility": {
      "ramType": "DDR4",
      "speed": "3200MHz"
    }
  }
]
```

---

## 📂 Categories

### List All Categories
**GET** `/categories`

**Response (200):**
```json
[
  {
    "_id": "507f1f77bcf86cd799439015",
    "name": "Laptops",
    "description": "Laptop computers",
    "createdAt": "2026-01-01T10:00:00.000Z"
  },
  {
    "_id": "507f1f77bcf86cd799439016",
    "name": "CPUs",
    "description": "Computer processors"
  }
]
```

---

### Get Single Category
**GET** `/categories/:id`

**Response (200):**
```json
{
  "_id": "507f1f77bcf86cd799439015",
  "name": "Laptops",
  "description": "Laptop computers"
}
```

---

### Create Category (Admin Only)
**POST** `/categories`  
**Auth Required**: Yes (Admin)

**Request Body:**
```json
{
  "name": "Graphics Cards",
  "description": "GPU for gaming and rendering"
}
```

**Response (201):**
```json
{
  "_id": "507f1f77bcf86cd799439017",
  "name": "Graphics Cards",
  "description": "GPU for gaming and rendering"
}
```

---

### Update Category (Admin Only)
**PATCH** `/categories/:id`  
**Auth Required**: Yes (Admin)

**Request Body:**
```json
{
  "description": "Updated description"
}
```

**Response (200):**
```json
{
  "_id": "507f1f77bcf86cd799439015",
  "description": "Updated description"
}
```

---

### Delete Category (Admin Only)
**DELETE** `/categories/:id`  
**Auth Required**: Yes (Admin)

**Response (200):**
```json
{
  "message": "Category deleted successfully"
}
```

---

## 🛒 Cart

### Get My Cart
**GET** `/cart`  
**Auth Required**: Yes

**Response (200):**
```json
{
  "userId": "507f1f77bcf86cd799439011",
  "items": [
    {
      "productId": "607f1f77bcf86cd799439013",
      "name": "Dell XPS 15",
      "price": 1499.99,
      "quantity": 2,
      "image": "dell-xps-1.jpg",
      "subtotal": 2999.98
    }
  ],
  "totalAmount": 2999.98,
  "totalItems": 2
}
```

---

### Add to Cart
**POST** `/cart/add`  
**Auth Required**: Yes

**Request Body:**
```json
{
  "productId": "607f1f77bcf86cd799439013",
  "quantity": 2
}
```

**Response (200):**
```json
{
  "message": "Product added to cart",
  "cart": {
    "items": [
      {
        "productId": "607f1f77bcf86cd799439013",
        "quantity": 2
      }
    ],
    "totalAmount": 2999.98
  }
}
```

---

### Remove from Cart
**DELETE** `/cart/item/:productId`  
**Auth Required**: Yes

**Response (200):**
```json
{
  "message": "Product removed from cart"
}
```

---

## ❤️ Wishlist

### Get My Wishlist
**GET** `/wishlist`  
**Auth Required**: Yes

**Response (200):**
```json
{
  "userId": "507f1f77bcf86cd799439011",
  "products": [
    {
      "_id": "607f1f77bcf86cd799439013",
      "name": "Dell XPS 15",
      "price": 1499.99,
      "image": "dell-xps-1.jpg",
      "addedAt": "2026-01-24T10:00:00.000Z"
    }
  ],
  "count": 1
}
```

---

### Add to Wishlist
**POST** `/wishlist`  
**Auth Required**: Yes

**Request Body:**
```json
{
  "productId": "607f1f77bcf86cd799439013"
}
```

**Response (200):**
```json
{
  "message": "Product added to wishlist"
}
```

---

### Get Wishlist Count
**GET** `/wishlist/count`  
**Auth Required**: Yes

**Response (200):**
```json
{
  "count": 5
}
```

---

### Check if Product in Wishlist
**GET** `/wishlist/check/:productId`  
**Auth Required**: Yes

**Response (200):**
```json
{
  "isInWishlist": true
}
```

---

### Remove from Wishlist
**DELETE** `/wishlist/:productId`  
**Auth Required**: Yes

**Response (200):**
```json
{
  "message": "Product removed from wishlist"
}
```

---

### Clear Wishlist
**DELETE** `/wishlist`  
**Auth Required**: Yes

**Response (200):**
```json
{
  "message": "Wishlist cleared"
}
```

---

## 📦 Orders

### Create Order
**POST** `/orders`  
**Auth Required**: Yes

**Request Body:**
```json
{
  "shippingAddress": {
    "street": "123 Main St",
    "city": "New York",
    "state": "NY",
    "zip": "10001",
    "country": "USA",
    "phone": "+1234567890"
  }
}
```

**Response (201):**
```json
{
  "_id": "707f1f77bcf86cd799439020",
  "userId": "507f1f77bcf86cd799439011",
  "items": [
    {
      "productId": "607f1f77bcf86cd799439013",
      "quantity": 2,
      "price": 1499.99
    }
  ],
  "totalAmount": 2999.98,
  "status": "pending",
  "paymentMethod": "cod",
  "shippingAddress": {
    "street": "123 Main St",
    "city": "New York",
    "state": "NY",
    "zip": "10001",
    "country": "USA",
    "phone": "+1234567890"
  },
  "createdAt": "2026-01-25T10:00:00.000Z"
}
```

---

### Get My Orders
**GET** `/orders/my-orders`  
**Auth Required**: Yes

**Response (200):**
```json
[
  {
    "_id": "707f1f77bcf86cd799439020",
    "totalAmount": 2999.98,
    "status": "pending",
    "items": [
      {
        "productId": {
          "_id": "607f1f77bcf86cd799439013",
          "name": "Dell XPS 15",
          "image": "dell-xps-1.jpg"
        },
        "quantity": 2,
        "price": 1499.99
      }
    ],
    "createdAt": "2026-01-25T10:00:00.000Z"
  }
]
```

---

### Get All Orders (Admin/Manager)
**GET** `/orders`  
**Auth Required**: Yes (Admin/Manager)

**Response (200):**
```json
[
  {
    "_id": "707f1f77bcf86cd799439020",
    "userId": {
      "_id": "507f1f77bcf86cd799439011",
      "firstname": "John",
      "lastname": "Doe",
      "email": "john@example.com"
    },
    "totalAmount": 2999.98,
    "status": "pending",
    "createdAt": "2026-01-25T10:00:00.000Z"
  }
]
```

---

### Get Single Order
**GET** `/orders/:id`  
**Auth Required**: Yes

**Response (200):**
```json
{
  "_id": "707f1f77bcf86cd799439020",
  "userId": "507f1f77bcf86cd799439011",
  "items": [
    {
      "productId": {
        "_id": "607f1f77bcf86cd799439013",
        "name": "Dell XPS 15",
        "price": 1499.99,
        "image": "dell-xps-1.jpg"
      },
      "quantity": 2,
      "price": 1499.99
    }
  ],
  "totalAmount": 2999.98,
  "status": "pending",
  "shippingAddress": {
    "street": "123 Main St",
    "city": "New York"
  }
}
```

---

### Update Order Status (Admin/Manager)
**PATCH** `/orders/:id/status`  
**Auth Required**: Yes (Admin/Manager)

**Request Body:**
```json
{
  "status": "confirmed"
}
```

**Allowed Status Values:**
- `pending`
- `confirmed`
- `processing`
- `shipped`
- `delivered`
- `cancelled`

**Response (200):**
```json
{
  "_id": "707f1f77bcf86cd799439020",
  "status": "confirmed",
  "updatedAt": "2026-01-25T10:30:00.000Z"
}
```

---

## ⭐ Reviews

### Get Product Reviews
**GET** `/reviews?productId=:productId`

**Example**: `/reviews?productId=607f1f77bcf86cd799439013`

**Response (200):**
```json
[
  {
    "_id": "807f1f77bcf86cd799439025",
    "userId": {
      "_id": "507f1f77bcf86cd799439011",
      "firstname": "John",
      "lastname": "Doe"
    },
    "productId": "607f1f77bcf86cd799439013",
    "rating": 5,
    "comment": "Excellent laptop, highly recommended!",
    "createdAt": "2026-01-20T10:00:00.000Z"
  }
]
```

---

### Create Review
**POST** `/reviews`  
**Auth Required**: Yes (Optional - depends on config)

**Request Body:**
```json
{
  "productId": "607f1f77bcf86cd799439013",
  "rating": 5,
  "comment": "Excellent product!"
}
```

**Response (201):**
```json
{
  "_id": "807f1f77bcf86cd799439025",
  "userId": "507f1f77bcf86cd799439011",
  "productId": "607f1f77bcf86cd799439013",
  "rating": 5,
  "comment": "Excellent product!",
  "createdAt": "2026-01-25T10:00:00.000Z"
}
```

---

### Delete Review (Admin)
**DELETE** `/reviews/:id`  
**Auth Required**: Yes (Admin)

**Response (200):**
```json
{
  "message": "Review deleted successfully"
}
```

---

## 💬 Testimonials

### Get Active Testimonials
**GET** `/testimonials/active`

**Response (200):**
```json
[
  {
    "_id": "907f1f77bcf86cd799439030",
    "name": "Sarah Johnson",
    "role": "CEO, Tech Corp",
    "content": "Best computer store for enterprise solutions!",
    "rating": 5,
    "image": "sarah-testimonial.jpg",
    "videoLink": null,
    "isActive": true,
    "createdAt": "2026-01-15T10:00:00.000Z"
  }
]
```

---

### Get All Testimonials
**GET** `/testimonials`

**Response (200):**
```json
[
  {
    "_id": "907f1f77bcf86cd799439030",
    "name": "Sarah  Johnson",
    "content": "Best computer store!"
  }
]
```

---

### Create Testimonial (Admin/Manager)
**POST** `/testimonials`  
**Auth Required**: Yes (Admin/Manager)  
**Content-Type**: `multipart/form-data`

**Form Data:**
```
name: Sarah Johnson
role: CEO, Tech Corp
content: Best computer store for enterprise solutions!
rating: 5
image: [File] (optional)
videoLink: https://youtube.com/... (optional)
```

**Response (201):**
```json
{
  "_id": "907f1f77bcf86cd799439030",
  "name": "Sarah Johnson",
  "content": "Best computer store!"
}
```

---

### Update Testimonial (Admin/Manager)
**PATCH** `/testimonials/:id`  
**Auth Required**: Yes (Admin/Manager)  
**Content-Type**: `multipart/form-data`

**Response (200):**
```json
{
  "_id": "907f1f77bcf86cd799439030",
  "name": "Sarah Johnson"
}
```

---

### Toggle Testimonial Active Status (Admin/Manager)
**PATCH** `/testimonials/:id/toggle-active`  
**Auth Required**: Yes (Admin/Manager)

**Response (200):**
```json
{
  "_id": "907f1f77bcf86cd799439030",
  "isActive": false
}
```

---

### Delete Testimonial (Admin/Manager)
**DELETE** `/testimonials/:id`  
**Auth Required**: Yes (Admin/Manager)

**Response (200):**
```json
{
  "message": "Testimonial deleted successfully"
}
```

---

## 🔧 Custom Requests (Build Your PC)

### Create Custom Request
**POST** `/custom-requests`  
**Auth Required**: Yes

**Request Body:**
```json
{
  "name": "Gaming PC Build",
  "description": "Need a high-end gaming PC for 4K gaming",
  "budget": 3000,
  "preferences": "RGB lighting, quiet cooling"
}
```

**Response (201):**
```json
{
  "_id": "a07f1f77bcf86cd799439035",
  "userId": "507f1f77bcf86cd799439011",
  "name": "Gaming PC Build",
  "description": "Need a high-end gaming PC for 4K gaming",
  "budget": 3000,
  "status": "pending",
  "createdAt": "2026-01-25T10:00:00.000Z"
}
```

---

### Get My Custom Requests
**GET** `/custom-requests/my`  
**Auth Required**: Yes

**Response (200):**
```json
[
  {
    "_id": "a07f1f77bcf86cd799439035",
    "name": "Gaming PC Build",
    "status": "pending",
    "budget": 3000,
    "createdAt": "2026-01-25T10:00:00.000Z"
  }
]
```

---

### Get All Custom Requests (Admin/Manager)
**GET** `/custom-requests`  
**Auth Required**: Yes (Admin/Manager)

**Response (200):**
```json
[
  {
    "_id": "a07f1f77bcf86cd799439035",
    "userId": {
      "_id": "507f1f77bcf86cd799439011",
      "firstname": "John",
      "email": "john@example.com"
    },
    "name": "Gaming PC Build",
    "status": "pending",
    "budget": 3000
  }
]
```

---

### Get Single Custom Request
**GET** `/custom-requests/:id`  
**Auth Required**: Yes (Admin/Manager)

**Response (200):**
```json
{
  "_id": "a07f1f77bcf86cd799439035",
  "name": "Gaming PC Build",
  "description": "Need a high-end gaming PC",
  "budget": 3000,
  "status": "pending"
}
```

---

### Update Custom Request Status (Admin/Manager)
**PATCH** `/custom-requests/:id/status`  
**Auth Required**: Yes (Admin/Manager)

**Request Body:**
```json
{
  "status": "in_progress"
}
```

**Allowed Status Values:**
- `pending`
- `in_progress`
- `completed`
- `rejected`

**Response (200):**
```json
{
  "_id": "a07f1f77bcf86cd799439035",
  "status": "in_progress"
}
```

---

## 🤖 Bot

### Chat with Bot
**POST** `/bot/chat`

**Request Body:**
```json
{
  "message": "Recommend a good laptop for programming"
}
```

**Response (200):**
```json
{
  "response": "I recommend the Dell XPS 15 or MacBook Pro 14. Both offer excellent performance for development work."
}
```

---

## 💳 Payment

### Process Checkout
**POST** `/payment/checkout`  
**Auth Required**: Yes

**Request Body:**
```json
{
  "amount": 2999.98,
  "currency": "USD"
}
```

**Response (200):**
```json
{
  "success": true,
  "transactionId": "txn_1234567890",
  "amount": 2999.98,
  "currency": "USD",
  "status": "completed"
}
```

---

## 🎁 Deals & Offers

### Get All Deals
**GET** `/deals-offers`

**Response (200):**
```json
[
  {
    "_id": "b07f1f77bcf86cd799439040",
    "title": "Black Friday Sale",
    "description": "Up to 50% off on selected items",
    "discountPercentage": 50,
    "startDate": "2026-11-25T00:00:00.000Z",
    "endDate": "2026-11-30T23:59:59.000Z",
    "isActive": true,
    "applicableProducts": ["607f1f77bcf86cd799439013"]
  }
]
```

---

### Create Deal (Admin/Manager)
**POST** `/deals-offers`  
**Auth Required**: Yes (Admin/Manager)

**Request Body:**
```json
{
  "title": "Summer Sale",
  "description": "20% off on all laptops",
  "discountPercentage": 20,
  "startDate": "2026-06-01T00:00:00.000Z",
  "endDate": "2026-06-30T23:59:59.000Z"
}
```

**Response (201):**
```json
{
  "_id": "b07f1f77bcf86cd799439041",
  "title": "Summer Sale",
  "discountPercentage": 20
}
```

---

## 🔒 Security Features

### Rate Limiting
All endpoints are rate-limited:
- **Global**: 100 requests per minute
- **Authentication endpoints**: 5 requests per 15 minutes

When rate limit is exceeded:
```json
{
  "statusCode": 429,
  "message": "Too Many Requests"
}
```

---

### Error Responses

**400 Bad Request:**
```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "errors": ["Email is required", "Password must be at least 12 characters"]
}
```

**401 Unauthorized:**
```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

**403 Forbidden:**
```json
{
  "statusCode": 403,
  "message": "Forbidden - Insufficient permissions"
}
```

**404 Not Found:**
```json
{
  "statusCode": 404,
  "message": "Resource not found"
}
```

**500 Internal Server Error:**
```json
{
  "statusCode": 500,
  "message": "Internal server error"
}
```

---

## 📝 Notes for Frontend Development

### Authentication Flow
1. Call `/auth/login` to get `access_token`
2. Store token in localStorage or secure cookie
3. Include token in all protected requests:
   ```javascript
   headers: {
     'Authorization': `Bearer ${access_token}`
   }
   ```

### Pagination
Most list endpoints support pagination:
```
GET /products?page=1&limit=20
```

### File Uploads
Use `FormData` for file uploads:
```javascript
const formData = new FormData();
formData.append('name', 'Product Name');
formData.append('price', '999.99');
formData.append('images', fileInput.files[0]);
formData.append('images', fileInput.files[1]);

fetch('/products', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`
  },
  body: formData
});
```

### Image URLs
Images are served from `/uploads/` directory:
```
http://localhost:9004/uploads/image-1643123456.jpg
```

### CORS
Allowed origins are configured in `.env`:
```env
ALLOWED_ORIGINS=http://localhost:9005,https://yourfrontend.com
```

---

**Need Help?** Contact the backend team or check the [Security Walkthrough](walkthrough.md) for production deployment guidelines.
