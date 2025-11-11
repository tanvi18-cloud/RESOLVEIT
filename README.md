# ResolveIt – Dispute Resolution Platform

Overview

ResolveIt is a web application designed to help individuals and communities resolve disputes through a structured mediation process. The platform allows users to register disputes, upload evidence, nominate witnesses, and work with a panel of experts to reach a fair agreement. Admins can manage cases, track progress, and generate formal agreements.

---

## Features

- **User Registration:** Register as a party with personal details and a photo.
- **Case Registration:** Submit dispute details, upload proof (images, videos, audio), and provide opposite party info.
- **Admin Dashboard:** Secure login, view/filter cases, real-time updates, and manage the case lifecycle.
- **Witness Nomination:** Add witnesses for each case.
- **Panel Creation:** Form a mediation panel with required expertise (lawyer, religious scholar, community member).
- **Agreement Generation:** Create and download a formal agreement for resolved cases.
- **Educational Resources:** Access articles, videos, and workshops on mediation and conflict resolution.

---

## Setup Instructions

1. *Install Dependencies*
   ```bash
   npm install
   ```

2. *Start MongoDB*
   - Make sure MongoDB is running on your system (local or Atlas).

3. *Start the Backend*
   ```bash
   node index.js
   ```
   or
   ```bash
   npm start
   ```

4. *Open the Frontend*
   - In your browser, go to:
     ```
     http://localhost:3000/frontend/index.html
     ```

---

#How to Use

- *Register a User:* Go to "Register User", fill out the form, and upload a photo.
- *Register a Case:* Go to "Register Case", fill out the details, upload proof, and submit.
- *Admin Actions:*
  - Log in as admin (`admin` / `password123`).
  - View and filter cases.
  - Nominate witnesses and create a panel for each case.
  - Mark cases as resolved and generate agreements.
- *Educational Resources:*Browse articles, videos, and workshops from the navbar.

---

#API Documentation

- Import the provided `ResolveIt_API_Tests.postman_collection.json` into Postman to test all API endpoints.

---

#Database Schema

- User and case schemas are defined in `index.js` using Mongoose.

---

#Security

- Helmet, CORS, and rate limiting are enabled.
- Admin dashboard is protected by JWT authentication.
- All user input is validated and sanitized.
- No inline JavaScript; CSP-compliant.
- File uploads are handled securely.

---

#Screenshots

Screenshots of all major features are included in the `/screenshots` folder.

---

#Notes

- If you have any issues running the app, make sure MongoDB is running and all dependencies are installed.
- For any questions, please refer to the code comments or contact the developer.

---# RESOLVEIT
