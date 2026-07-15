# Joydome API Documentation

A comprehensive freelance marketplace API built with Node.js, Express.js, and MongoDB.

## 📋 Table of Contents

- [Base Information](#base-information)
- [Authentication](#authentication)
- [User Management](#user-management)
- [Gig Management](#gig-management)
- [Order Management](#order-management)
- [Messaging System](#messaging-system)
- [Review System](#review-system)
- [Health Check](#health-check)
- [Error Handling](#error-handling)
- [Response Formats](#response-formats)

---

## 🔧 Base Information

**Base URL**: `http://localhost:8000`  
**Content-Type**: `application/json`  
**Authentication**: JWT Token (stored in httpOnly cookies)

---

## 🔐 Authentication

### Register User

```http
POST /api/auth/register
```

**Request Body:**

```json
{
  "username": "string (required)",
  "email": "string (required, unique)",
  "password": "string (required)",
  "country": "string (required)",
  "phone": "string (required, unique, international format)",
  "desc": "string (optional)",
  "img": "string (optional)",
  "isSeller": "boolean (optional, default: false)"
}
```

**Response:**

```json
{
  "message": "User has been created."
}
```

**Status Codes:**

- `201` - User created successfully
- `400` - User already exists or validation error
- `500` - Server error

---

### Login User

```http
POST /api/auth/login
```

**Request Body:**

```json
{
  "username": "string (required)",
  "password": "string (required)"
}
```

**Response:**

```json
{
  "username": "john_doe",
  "email": "john@example.com",
  "country": "Ghana",
  "phone": "+233123456789",
  "desc": "I'm a web developer",
  "img": "https://example.com/avatar.jpg",
  "isSeller": false,
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

**Status Codes:**

- `200` - Login successful
- `400` - Wrong password or username
- `404` - User not found
- `500` - Server error

---

### Logout User

```http
POST /api/auth/logout
```

**Response:**

```json
{
  "message": "User has been logged out."
}
```

**Status Codes:**

- `200` - Logout successful

---

## 👤 User Management

### Get User by ID

```http
GET /api/users/:id
```

**Parameters:**

- `id` - User ID (string)

**Response:**

```json
{
  "username": "john_doe",
  "email": "john@example.com",
  "country": "Ghana",
  "phone": "+233123456789",
  "desc": "I'm a web developer",
  "img": "https://example.com/avatar.jpg",
  "isSeller": false,
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

**Status Codes:**

- `200` - User found
- `404` - User not found
- `500` - Server error

---

### Delete User

```http
DELETE /api/users/:id
```

**Headers:**

- `Cookie: accessToken=<jwt_token>`

**Parameters:**

- `id` - User ID (string)

**Response:**

```json
{
  "message": "User has been deleted."
}
```

**Status Codes:**

- `200` - User deleted successfully
- `403` - Can only delete your own account
- `404` - User not found
- `401` - Not authenticated
- `500` - Server error

---

## 💼 Gig Management

### Create Gig

```http
POST /api/gigs
```

**Headers:**

- `Cookie: accessToken=<jwt_token>`
- `Content-Type: application/json`

**Request Body:**

```json
{
  "title": "string (required)",
  "desc": "string (required)",
  "cat": "string (required)",
  "price": "number (required)",
  "cover": "string (required)",
  "images": ["string"] (optional),
  "shortTitle": "string (required)",
  "shortDesc": "string (required)",
  "deliveryTime": "number (required)",
  "revisionNumber": "number (required)",
  "features": ["string"] (optional)
}
```

**Response:**

```json
{
  "userId": "64a1b2c3d4e5f6789012345",
  "title": "I will create a modern website",
  "desc": "Professional website development",
  "cat": "web-development",
  "price": 500,
  "cover": "https://example.com/cover.jpg",
  "images": ["https://example.com/img1.jpg"],
  "shortTitle": "Modern Website",
  "shortDesc": "Professional web design",
  "deliveryTime": 7,
  "revisionNumber": 3,
  "features": ["Responsive Design", "SEO Optimized"],
  "totalStars": 0,
  "starNumber": 0,
  "sales": 0,
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

**Status Codes:**

- `201` - Gig created successfully
- `403` - Only sellers can create gigs
- `401` - Not authenticated
- `500` - Server error

---

### Get All Gigs

```http
GET /api/gigs
```

**Query Parameters:**

- `userId` - Filter by seller ID
- `cat` - Filter by category
- `min` - Minimum price
- `max` - Maximum price
- `search` - Search in title
- `sort` - Sort field (e.g., 'createdAt', 'price')

**Example:**

```
GET /api/gigs?cat=web-development&min=100&max=1000&search=website&sort=price
```

**Response:**

```json
[
  {
    "userId": "64a1b2c3d4e5f6789012345",
    "title": "I will create a modern website",
    "desc": "Professional website development",
    "cat": "web-development",
    "price": 500,
    "cover": "https://example.com/cover.jpg",
    "images": ["https://example.com/img1.jpg"],
    "shortTitle": "Modern Website",
    "shortDesc": "Professional web design",
    "deliveryTime": 7,
    "revisionNumber": 3,
    "features": ["Responsive Design", "SEO Optimized"],
    "totalStars": 4.5,
    "starNumber": 10,
    "sales": 25,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
]
```

**Status Codes:**

- `200` - Gigs retrieved successfully
- `500` - Server error

---

### Get Single Gig

```http
GET /api/gigs/single/:id
```

**Parameters:**

- `id` - Gig ID (string)

**Response:**

```json
{
  "userId": "64a1b2c3d4e5f6789012345",
  "title": "I will create a modern website",
  "desc": "Professional website development",
  "cat": "web-development",
  "price": 500,
  "cover": "https://example.com/cover.jpg",
  "images": ["https://example.com/img1.jpg"],
  "shortTitle": "Modern Website",
  "shortDesc": "Professional web design",
  "deliveryTime": 7,
  "revisionNumber": 3,
  "features": ["Responsive Design", "SEO Optimized"],
  "totalStars": 4.5,
  "starNumber": 10,
  "sales": 25,
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

**Status Codes:**

- `200` - Gig found
- `404` - Gig not found
- `500` - Server error

---

### Delete Gig

```http
DELETE /api/gigs/:id
```

**Headers:**

- `Cookie: accessToken=<jwt_token>`

**Parameters:**

- `id` - Gig ID (string)

**Response:**

```json
{
  "message": "Gig has been deleted."
}
```

**Status Codes:**

- `200` - Gig deleted successfully
- `403` - Can only delete your own gigs
- `404` - Gig not found
- `401` - Not authenticated
- `500` - Server error

---

## 🛒 Order Management

### Get User Orders

```http
GET /api/orders
```

**Headers:**

- `Cookie: accessToken=<jwt_token>`

**Response:**

```json
[
  {
    "gigId": "64a1b2c3d4e5f6789012345",
    "img": "https://example.com/cover.jpg",
    "title": "I will create a modern website",
    "price": 500,
    "sellerId": "64a1b2c3d4e5f6789012345",
    "buyerId": "64a1b2c3d4e5f6789012346",
    "isCompleted": true,
    "payment_intent": "pi_1234567890",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
]
```

**Status Codes:**

- `200` - Orders retrieved successfully
- `401` - Not authenticated
- `500` - Server error

---

### Create Payment Intent

```http
POST /api/orders/create-payment-intent/:id
```

**Headers:**

- `Cookie: accessToken=<jwt_token>`

**Parameters:**

- `id` - Gig ID (string)

**Response:**

```json
{
  "clientSecret": "pi_1234567890_secret_abcdef"
}
```

**Status Codes:**

- `200` - Payment intent created successfully
- `404` - Gig not found
- `500` - Stripe not configured or server error
- `401` - Not authenticated

---

### Confirm Order

```http
PUT /api/orders
```

**Headers:**

- `Cookie: accessToken=<jwt_token>`
- `Content-Type: application/json`

**Request Body:**

```json
{
  "payment_intent": "pi_1234567890"
}
```

**Response:**

```json
{
  "message": "Order has been confirmed."
}
```

**Status Codes:**

- `200` - Order confirmed successfully
- `401` - Not authenticated
- `500` - Server error

---

## 💬 Messaging System

### Get User Conversations

```http
GET /api/conversations
```

**Headers:**

- `Cookie: accessToken=<jwt_token>`

**Response:**

```json
[
  {
    "id": "conv_123",
    "sellerId": "64a1b2c3d4e5f6789012345",
    "buyerId": "64a1b2c3d4e5f6789012346",
    "readBySeller": true,
    "readByBuyer": false,
    "lastMessage": "Hello, I'm interested in your gig!",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
]
```

**Status Codes:**

- `200` - Conversations retrieved successfully
- `401` - Not authenticated
- `500` - Server error

---

### Create Conversation

```http
POST /api/conversations
```

**Headers:**

- `Cookie: accessToken=<jwt_token>`
- `Content-Type: application/json`

**Request Body:**

```json
{
  "to": "64a1b2c3d4e5f6789012345"
}
```

**Response:**

```json
{
  "id": "conv_123",
  "sellerId": "64a1b2c3d4e5f6789012345",
  "buyerId": "64a1b2c3d4e5f6789012346",
  "readBySeller": true,
  "readByBuyer": false,
  "lastMessage": null,
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

**Status Codes:**

- `201` - Conversation created successfully
- `401` - Not authenticated
- `500` - Server error

---

### Get Single Conversation

```http
GET /api/conversations/single/:id
```

**Headers:**

- `Cookie: accessToken=<jwt_token>`

**Parameters:**

- `id` - Conversation ID (string)

**Response:**

```json
{
  "id": "conv_123",
  "sellerId": "64a1b2c3d4e5f6789012345",
  "buyerId": "64a1b2c3d4e5f6789012346",
  "readBySeller": true,
  "readByBuyer": false,
  "lastMessage": "Hello, I'm interested in your gig!",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

**Status Codes:**

- `200` - Conversation found
- `404` - Conversation not found
- `401` - Not authenticated
- `500` - Server error

---

### Update Conversation

```http
PUT /api/conversations/:id
```

**Headers:**

- `Cookie: accessToken=<jwt_token>`

**Parameters:**

- `id` - Conversation ID (string)

**Response:**

```json
{
  "id": "conv_123",
  "sellerId": "64a1b2c3d4e5f6789012345",
  "buyerId": "64a1b2c3d4e5f6789012346",
  "readBySeller": true,
  "readByBuyer": true,
  "lastMessage": "Hello, I'm interested in your gig!",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

**Status Codes:**

- `200` - Conversation updated successfully
- `401` - Not authenticated
- `500` - Server error

---

### Send Message

```http
POST /api/messages
```

**Headers:**

- `Cookie: accessToken=<jwt_token>`
- `Content-Type: application/json`

**Request Body:**

```json
{
  "conversationId": "conv_123",
  "desc": "Hello, I'm interested in your gig!"
}
```

**Response:**

```json
{
  "conversationId": "conv_123",
  "userId": "64a1b2c3d4e5f6789012346",
  "desc": "Hello, I'm interested in your gig!",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

**Status Codes:**

- `201` - Message sent successfully
- `401` - Not authenticated
- `500` - Server error

---

### Get Conversation Messages

```http
GET /api/messages/:id
```

**Headers:**

- `Cookie: accessToken=<jwt_token>`

**Parameters:**

- `id` - Conversation ID (string)

**Response:**

```json
[
  {
    "conversationId": "conv_123",
    "userId": "64a1b2c3d4e5f6789012346",
    "desc": "Hello, I'm interested in your gig!",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  },
  {
    "conversationId": "conv_123",
    "userId": "64a1b2c3d4e5f6789012345",
    "desc": "Hi! Thanks for your interest. What do you need?",
    "createdAt": "2024-01-01T00:01:00.000Z",
    "updatedAt": "2024-01-01T00:01:00.000Z"
  }
]
```

**Status Codes:**

- `200` - Messages retrieved successfully
- `401` - Not authenticated
- `500` - Server error

---

## ⭐ Review System

### Create Review

```http
POST /api/reviews
```

**Headers:**

- `Cookie: accessToken=<jwt_token>`
- `Content-Type: application/json`

**Request Body:**

```json
{
  "gigId": "64a1b2c3d4e5f6789012345",
  "desc": "Excellent work, highly recommended!",
  "star": 5
}
```

**Response:**

```json
{
  "gigId": "64a1b2c3d4e5f6789012345",
  "userId": "64a1b2c3d4e5f6789012346",
  "desc": "Excellent work, highly recommended!",
  "star": 5,
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

**Status Codes:**

- `201` - Review created successfully
- `403` - Sellers can't create reviews / Can only review purchased gigs / Already reviewed this gig
- `401` - Not authenticated
- `500` - Server error

---

### Get Gig Reviews

```http
GET /api/reviews/:gigId
```

**Parameters:**

- `gigId` - Gig ID (string)

**Response:**

```json
[
  {
    "gigId": "64a1b2c3d4e5f6789012345",
    "userId": "64a1b2c3d4e5f6789012346",
    "desc": "Excellent work, highly recommended!",
    "star": 5,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
]
```

**Status Codes:**

- `200` - Reviews retrieved successfully
- `500` - Server error

---

### Delete Review

```http
DELETE /api/reviews/:id
```

**Headers:**

- `Cookie: accessToken=<jwt_token>`

**Parameters:**

- `id` - Review ID (string)

**Response:**

```json
{
  "message": "Review has been deleted."
}
```

**Status Codes:**

- `200` - Review deleted successfully
- `403` - Can only delete your own review
- `404` - Review not found
- `401` - Not authenticated
- `500` - Server error

---

## 🏥 Health Check

### API Health Status

```http
GET /health
```

**Response:**

```json
{
  "status": "OK",
  "message": "Joydome API is running",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

**Status Codes:**

- `200` - API is healthy

---

## ❌ Error Handling

### Error Response Format

```json
{
  "stack": "Error stack trace (development only)",
  "message": "Error message"
}
```

### Common Error Codes

- `400` - Bad Request (validation errors, duplicate data)
- `401` - Unauthorized (not authenticated)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found (resource doesn't exist)
- `500` - Internal Server Error (server-side error)

---

## 📊 Response Formats

### Success Response

- **200** - OK (successful GET, PUT, DELETE)
- **201** - Created (successful POST)

### Error Response

- **400** - Bad Request
- **401** - Unauthorized
- **403** - Forbidden
- **404** - Not Found
- **500** - Internal Server Error

---

## 🔒 Authentication

All protected endpoints require a valid JWT token stored in an httpOnly cookie named `accessToken`. The token is automatically included in requests when the user is logged in.

### Token Payload

```json
{
  "id": "user_id",
  "isSeller": "boolean"
}
```

---

## 📝 Notes

- All timestamps are in ISO 8601 format
- Phone numbers must be in international format (e.g., +233123456789)
- Star ratings are integers from 1 to 5
- Prices are in the smallest currency unit (e.g., cents for USD)
- Stripe integration is optional - payment features will be disabled if not configured
- All protected routes require authentication via JWT token
- Role-based access control is enforced for certain operations
