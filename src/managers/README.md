# Manager Management System - Frontend Guide

This module handles manager permissions, dashboard configurations, and activity tracking.

## 🛡️ Authentication & Session Security
- **Auto Logout**: Admin and Manager sessions auto-expire after **30 minutes of inactivity**. Any API request after this period will return `401 Unauthorized`.
- **Activity Heartbeat**: The system automatically tracks "Active" vs "Idle" time. 
    - **Idle Time**: Starts if there is no API activity for more than **5 minutes**.
    - **Active Time**: Calculated based on the gap between requests within the 5-minute threshold.

---

## 🚀 API Endpoints

### 1. Manager Configuration (RBAC & Widgets)

#### Create Manager (Admin Only)
- **Endpoint**: `POST /managers`
- **Access**: Admin
{
  "firstname": "John",
  "lastname": "Doe",
  "email": "[EMAIL_ADDRESS]",
  "password": "securepassword",
  "permissions": ["ORDERS_VIEW"],
  "dashboardWidgets": ["Orders"]
}
```

#### Get Current Manager Config
- **Endpoint**: `GET /managers/me/config`
- **Access**: Manager, Admin
- **Description**: Returns the permissions and dashboard widgets for the logged-in user.
- **Response**:
```json
{
  "_id": "65b...",
  "user": "65a...",
  "permissions": ["ORDERS_VIEW", "CHAT_ACCESS"],
  "dashboardWidgets": ["Orders", "Live Chat"],
  "status": "active"
}
```

#### Get All Managers (Admin Only)
- **Endpoint**: `GET /managers`
- **Access**: Admin
- **Description**: List all managers with their user details and current configs.

#### Update Manager Permissions (Admin Only)
- **Endpoint**: `PATCH /managers/:userId/permissions`
- **Body**:
```json
{
  "permissions": ["ORDERS_VIEW", "STOCK_UPDATE"]
}
```

#### Update Dashboard Widgets (Admin Only)
- **Endpoint**: `PATCH /managers/:userId/widgets`
- **Body**:
```json
{
  "widgets": ["Orders", "Daily Tasks", "Low Stock Alert"]
}
```

#### Update Status (Admin Only)
- **Endpoint**: `PATCH /managers/:userId/status`
- **Body**:
```json
{
  "status": "active" // or "inactive"
}
```

---

### 2. Activity Reporting (Admin Only)

#### Get All Managers Report
- **Endpoint**: `GET /managers/activity/report`
- **Query Params**:
    - `startDate` (ISO String, Optional)
    - `endDate` (ISO String, Optional)
- **Response**:
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

#### Get Specific Manager Report
- **Endpoint**: `GET /managers/activity/report/:managerId`
- **Query Params**: same as above.

---

### 3. Admin Configuration

#### Create Admin (Admin Only)
- **Endpoint**: `POST /admins`
- **Access**: Admin (Existing)
- **Description**: Creates a new user account with the `admin` role and a corresponding admin profile document.
- **Body**:
```json
{
  "firstname": "Jane",
  "lastname": "Smith",
  "email": "jane@example.com",
  "password": "securepassword",
  "settings": {}
}
```

#### Get Current Admin Config
- **Endpoint**: `GET /admins/me/config`
- **Access**: Admin
- **Description**: Returns the settings for the logged-in admin.

#### Update Admin Settings (Admin Only)
- **Endpoint**: `PATCH /admins/:userId/settings`
- **Body**:
```json
{
  "settings": { "theme": "dark", "notifications": true }
}
```

---

## 🛠️ Implementation Notes for Frontend

1. **Handling 401**: Ensure the frontend global interceptor handles `401 Unauthorized` by clearing the local session and redirecting to the login page with a "Session Expired" message.
2. **Dashboard Rendering**: Use the `dashboardWidgets` array from `/managers/me/config` to conditionally render UI components on the manager's dashboard.
3. **Permissions**: Use the `permissions` array for granular UI control (e.g., hiding the "Edit Order" button if `ORDER_UPDATE` is missing).
4. **Reports**: The hours are returned as decimals. Convert to `HH:MM` format if necessary for display.
