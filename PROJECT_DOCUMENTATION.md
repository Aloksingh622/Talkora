# SparkHub Project Documentation

## 1. Project Overview
SparkHub is a comprehensive real-time chat application enabling users to communicate seamlessly. It features a full-stack architecture with a React-based frontend and a Node.js/Express backend, utilizing specialized services for database management, real-time communication, and media handling.

## 2. Technology Stack

### Backend
- **Runtime:** Node.js
- **Framework:** Express.js
- **Database:** PostgreSQL (via Prisma ORM)
- **Caching/Real-time:** Redis
- **Real-time Communication:** Socket.io
- **Authentication:** JSON Web Tokens (JWT), BCryptJS
- **Email Service:** SendGrid
- **File Storage:** Cloudinary
- **Push Notifications:** Firebase Admin
- **Validation:** Validator.js

### Frontend
- **Framework:** React (Vite)
- **State Management:** Redux Toolkit
- **Styling:** Tailwind CSS, DaisyUI
- **Routing:** React Router DOM
- **HTTP Client:** Axios
- **Real-time Client:** Socket.io Client
- **Form Handling:** React Hook Form, Zod
- **Animations:** Framer Motion
- **Notifications:** React Hot Toast

## 3. Project Structure

### Backend Structure (`/backend`)
- **src/controllers**: Handles business logic for incoming requests.
- **src/routes**: Defines API endpoints and maps them to controllers.
- **src/middlewares**: Express middlewares for auth, validation, etc.
- **src/database**: Database connection and configuration.
- **src/realtime**: Socket.io logic and event handlers.
- **src/redis**: Redis client and caching logic.
- **src/emailservice**: SendGrid integration for emails.
- **src/utils**: Utility functions (helpers).
- **prisma**: Prisma schema and migrations.

### Frontend Structure (`/frontend`)
- **src/components**: Reusable UI components.
- **src/pages**: Full page components representing routes.
- **src/redux**: Redux slices and store configuration.
- **src/services**: API service calls (Axios setup).
- **src/context**: React Context providers (if any).
- **src/utils**: Helper functions and constants.
- **src/assets**: Static assets (images, icons).

## 4. Setup and Installation

### Prerequisites
- Node.js (v18+ recommended)
- PostgreSQL Database
- Redis Instance
- Cloudinary Account
- SendGrid Account
- Firebase Project

### Backend Setup
1. Navigate to the backend directory:
   ```bash
   cd SparkHub/backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Configure Environment Variables:
   Create a `.env` file in `SparkHub/backend` and add the following keys:
   ```env
   PORT=4000
   DATABASE_URL="postgresql://user:password@localhost:5432/SparkHub"
   JWT_SECRET="your_jwt_secret"
   REDIS_URL="redis://localhost:6379"
   CLOUDINARY_CLOUD_NAME="..."
   CLOUDINARY_API_KEY="..."
   CLOUDINARY_API_SECRET="..."
   SENDGRID_API_KEY="..."
   ```
4. **Firebase Setup:**
   - Download your Firebase Admin SDK service account key.
   - Rename it to `ServiceAccount.json`.
   - Place it in the `SparkHub/backend` directory (process.cwd() root).

5. Run Database Migrations:
   ```bash
   npx prisma migrate dev
   ```
6. Start the Server:
   ```bash
   npm run dev
   ```
   The backend will run on `http://localhost:4000`.

### Frontend Setup
1. Navigate to the frontend directory:
   ```bash
   cd SparkHub/frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Configure Environment Variables:
   Create a `.env` file in `SparkHub/frontend` to point to the backend and configure Firebase:
   ```env
   VITE_API_URL="http://localhost:4000"
   
   # Firebase Configuration
   VITE_FIREBASE_API_KEY="..."
   VITE_FIREBASE_AUTH_DOMAIN="..."
   VITE_FIREBASE_PROJECT_ID="..."
   VITE_FIREBASE_STORAGE_BUCKET="..."
   VITE_FIREBASE_MESSAGING_SENDER_ID="..."
   VITE_FIREBASE_APP_ID="..."
   VITE_FIREBASE_MEASUREMENT_ID="..."
   ```
4. Start the Development Server:
   ```bash
   npm run dev
   ```
   The frontend will run on `http://localhost:5173`.

## 5. Key Features
- **User Authentication**: Secure signup and login with JWT and password hashing.
- **Real-time Messaging**: Instant messaging using Socket.io and Redis.
- **Media Support**: Image uploads handled via Cloudinary.
- **Email Notifications**: Integration with SendGrid for transactional emails.
- **Responsive Design**: Modern UI built with Tailwind CSS and DaisyUI.
