Backend – Internal Reporting System

This backend service powers the Internal Reporting System by providing secure RESTful APIs for authentication, report workflows, organizational management, notifications, and analytics.

The backend is built using Node.js and Express.js following modular enterprise backend architecture principles.

Backend Technologies
Node.js
Express.js
JWT Authentication
PostgreSQL
bcrypt.js
Helmet.js
Multer
dotenv
CORS
Backend Responsibilities

The backend handles:

User authentication and authorization
Department and team management
Employee management
Report submission workflows
Multi-stage approval system
Notifications
File uploads (PDF reports)
Analytics and tracking
Role-based access control
Backend Architecture

The project follows a layered backend architecture for scalability and maintainability.

/src
 ├── config
 ├── controllers
 ├── middlewares
 ├── routes
 ├── services
 ├── uploads
 ├── utils
 └── index.js
Folder Structure Explanation
Folder	Purpose
config	Database connection and environment configurations
controllers	Request handlers and API logic
middlewares	Authentication, authorization, validation, and error handling
routes	API route definitions
services	Business logic and reusable service layers
uploads	Uploaded PDF report files
utils	Utility/helper functions
index.js	Main server entry point
Core Backend Features
Authentication & Security
JWT-based authentication
Password hashing with bcrypt
Protected routes
Role-based authorization
Secure headers using Helmet.js
Token verification middleware
Organization Management
Admin Capabilities
Create departments
Create teams
Register employees
Assign users to teams and departments
Manage roles and permissions
Report Management

Employees can:

Submit reports
Upload PDF documents
Track submission status
View report history

System supports:

Scheduled submissions
Report categorization
Status tracking
Submission timestamps
Approval Workflow

The backend implements a two-stage approval process:

Stage 1 – Department Review

Department reviewer can:

Approve reports
Reject reports
Request changes
Stage 2 – Final Approval

Final approver can:

Final approve reports
Reject reports
Return reports for corrections
Notification System

The backend triggers notifications when:

Reports are assigned
Reports are submitted
Reviews are completed
Reports are approved/rejected

Notification channels:

In-app notifications
Email-ready architecture
File Upload Handling

The system supports PDF report uploads using Multer.

Uploaded files are stored inside:

/src/uploads

Features:

PDF validation
Secure upload handling
File path storage
Report attachment support
RESTful API Design

The backend exposes RESTful APIs for:

Module	Description
Auth API	Authentication & login
Users API	Employee management
Departments API	Department management
Teams API	Team operations
Reports API	Report submissions
Workflow API	Approval workflows
Notifications API	System alerts
Dashboard API	Analytics and summaries
Middleware Features

Custom middleware includes:

JWT verification
Role authorization
Error handling
Request validation
File upload validation
Security middleware
Database Integration

The backend integrates with PostgreSQL for persistent storage.

Main entities:

Users
Departments
Teams
Reports
Reviews
Notifications
Approval Logs

Database relationships enforce:

Referential integrity
Organizational hierarchy
Workflow tracking
Security Measures

Implemented backend security practices include:

JWT token authentication
Password hashing
Helmet.js protection
Environment variable protection
Input validation
Route protection
Error handling middleware
API Workflow Example
Report Submission Flow
Employee authenticates
JWT token is validated
Report data submitted
PDF uploaded
Report stored in database
Reviewer notified
Status updated to Pending Review
Environment Variables

Create a .env file:

PORT=5000
DATABASE_URL=your_database_url
JWT_SECRET=your_secret_key
Running the Backend
Install Dependencies
npm install
Start Development Server
npm run dev
Start Production Server
npm start
Backend Entry Point

Main server file:

/src/index.js

Responsibilities:

Express app initialization
Middleware setup
Route registration
Database connection
Server startup
Development Practices

The backend follows:

Modular architecture
Separation of concerns
Service-based business logic
RESTful API standards
Secure authentication practices
Reusable middleware patterns
Git-based version control workflow
Future Improvements

Planned enhancements:

Real-time notifications
WebSocket integration
Audit trail logging
Rate limiting
API documentation with Swagger
Cloud file storage
Background job queues
Advanced analytics APIs
Author
Mugisha Yves

Full-Stack Developer Intern

Backend Stack:

Node.js
Express.js
PostgreSQL
JWT Authentication
Backend Status

Current Progress: 70% Complete

Completed:

Authentication system
API structure
Role-based middleware
Report workflows
Department/team APIs
File uploads
Dashboard endpoints

Remaining:

Final testing
Optimization
Notification improvements
Production polishing
License

Developed for internship and educational purposes.
