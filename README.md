# JaMoveo – Real-Time Band Rehearsal Platform

JaMoveo is a collaborative web application designed to streamline live band rehearsals. It allows musicians to join a real-time session, follow synced lyrics and chords, and enables an admin to control song progression through live synchronization and auto-scrolling functionality.

## Live App
- Frontend: https://jamoveo-frontend-x8uo.onrender.com
- Backend API: https://jamoveo-backend-t3oa.onrender.com

## Features

- Role-based user access (instrumentalist or vocalist)
- Secure admin mode with authorization code
- Real-time synchronization of lyrics and chords using Socket.IO
- Admin-controlled auto-scroll with adjustable speed
- Persistent song selection with local fallback
- Responsive frontend design using TailwindCSS

## Tech Stack

**Frontend:**
- React.js
- TailwindCSS
- Axios
- React Router

**Backend:**
- Node.js
- Express.js
- MongoDB (Mongoose)
- JWT for authentication
- Socket.IO for real-time communication

## User Roles

- **User (default):** Can view selected songs and follow scrolling lyrics and chords
- **Admin:** Has control over song selection, line and word sync, and global auto-scroll behavior

## Admin Registration Security

Admin privileges are only granted if the correct admin authorization code is entered during registration.

### How it Works

- The backend reads a secret value from the environment variable `ADMIN_SECRET`
- During registration, if the entered `adminCode` matches the value `adminadminadmin`, the user is registered with the role `admin`
- If the code is not provided or incorrect, the user defaults to the role `user`
- The frontend does not expose the `ADMIN_SECRET` value

### Default Admin Name

To register as the admin, you must enter username as "admin" , and the adminCode must be `adminadminadmin`.

## Setup Instructions

### 1. Clone the Repository

```bash
git clone https://github.com/TamerAbu/jamoveo
cd jamoveo

Install Dependencies:
cd server
npm install


To start the backend server:
npm start

This runs the Node.js + Express backend on http://localhost:5000.

To start the React frontend:
npm start

3. Environment Configuration
Create a .env file in the /server directory and include the following:

PORT=5000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
JWT_EXPIRE=30d
ADMIN_SECRET=adminadminadmin

Make sure to replace your_mongodb_connection_string and your_jwt_secret with actual secure values.

Project Structure Overview
bash
Copy
Edit
client/         # React frontend
server/         # Node.js + Express backend
├── models/     # Mongoose schemas
├── routes/     # Express routes
├── controllers # Logic for auth and songs
├── utils/      # Socket handlers and middleware

