# SquirrelNVR - User Management & Access Control

## 🔐 User Management System

### Overview
SquirrelNVR includes a comprehensive user management system with:
- **User Accounts** - Individual users with credentials
- **User Groups** - Group users with similar permissions
- **Role-Based Access Control (RBAC)** - Admin, User, Viewer roles
- **Granular Permissions** - 11 different permission types
- **Camera-Level Access Control** - Per-user/group camera access
- **Configurable Ports** - Separate ports for remote viewers

---

## 👥 User Roles

### Admin
- **Full system access** - All permissions
- **User management** - Create, edit, delete users and groups
- **System configuration** - Change all settings
- **All cameras** - Access to every camera
- **Cannot be restricted**

### User
- **Configurable permissions** - Based on groups and individual settings
- **Limited management** - Can view and use assigned features
- **Camera restrictions** - Only sees allowed cameras
- **No system changes** - Cannot modify system settings

### Viewer
- **Read-only access** - View live feeds and recordings
- **No management** - Cannot change any settings
- **Camera restrictions** - Only sees allowed cameras
- **No downloads** - Cannot download recordings (unless granted)

---

## 🎯 Permissions System

### Available Permissions

| Permission | Description | API Endpoint Access |
|-----------|-------------|-------------------|
| `canViewLive` | View live camera feeds | GET /api/cameras (live) |
| `canViewRecordings` | View recorded footage | GET /api/recordings |
| `canDownloadRecordings` | Download recordings | GET /api/recordings/:id/video |
| `canManageCameras` | Add/edit/delete cameras | POST/PUT/DELETE /api/cameras |
| `canManageRecordings` | Delete recordings | DELETE /api/recordings |
| `canManageAlarms` | Configure alarms | POST/PUT/DELETE /api/alarms |
| `canManageUsers` | Create/edit users | POST/PUT/DELETE /api/users |
| `canManageSystem` | System settings | PUT /api/system/settings |
| `canControlPTZ` | Control PTZ cameras | POST /api/ptz/:id/command |
| `canViewAIDetections` | View AI detections | GET /api/detections |
| `canExportData` | Export data/reports | GET /api/export/* |

---

## 📹 Camera Access Control

### Three Levels of Camera Access

1. **All Cameras Access** (`allCamerasAccess: true`)
   - User/group can access ALL cameras
   - Includes future cameras automatically
   - Best for: Admins, security managers

2. **Specific Cameras** (`allowedCameraIds: [...]`)
   - User/group can access only listed cameras
   - Must explicitly add new cameras
   - Best for: Department-specific users

3. **No Access** (empty array)
   - User/group cannot access any cameras
   - Must be granted through groups or direct assignment

### Access Hierarchy
```
Admin Role → ALL CAMERAS (always)
↓
User's Direct Access → Specific cameras or all
↓
User's Groups → Combined camera access from all groups
↓
Final Access → Union of all above
```

---

## 🏢 User Groups

### Creating a Group

```javascript
POST /api/groups
{
  "name": "Security Team",
  "description": "24/7 security monitoring team",
  
  // Permissions
  "canViewLive": true,
  "canViewRecordings": true,
  "canDownloadRecordings": true,
  "canControlPTZ": true,
  "canViewAIDetections": true,
  "canManageAlarms": false,
  
  // Camera Access
  "allCamerasAccess": true,
  "allowedCameraIds": []  // Empty since allCamerasAccess is true
}
```

### Pre-configured Group Examples

#### 1. **Security Team**
```javascript
{
  "name": "Security Team",
  "canViewLive": true,
  "canViewRecordings": true,
  "canDownloadRecordings": true,
  "canControlPTZ": true,
  "canViewAIDetections": true,
  "canManageAlarms": true,
  "allCamerasAccess": true
}
```

#### 2. **Department Supervisors**
```javascript
{
  "name": "Department Supervisors",
  "canViewLive": true,
  "canViewRecordings": true,
  "canViewAIDetections": true,
  "allowedCameraIds": ["cam-dept-1", "cam-dept-2", "cam-lobby"],
  "allCamerasAccess": false
}
```

#### 3. **Read-Only Viewers**
```javascript
{
  "name": "Read-Only Viewers",
  "canViewLive": true,
  "canViewRecordings": true,
  "allCamerasAccess": false,
  "allowedCameraIds": ["cam-public-1", "cam-lobby"]
}
```

#### 4. **System Administrators**
```javascript
{
  "name": "System Administrators",
  // All permissions set to true
  "canViewLive": true,
  "canViewRecordings": true,
  "canDownloadRecordings": true,
  "canManageCameras": true,
  "canManageRecordings": true,
  "canManageAlarms": true,
  "canManageUsers": true,
  "canManageSystem": true,
  "canControlPTZ": true,
  "canViewAIDetections": true,
  "canExportData": true,
  "allCamerasAccess": true
}
```

---

## 👤 Creating Users

### Basic User Creation
```javascript
POST /api/users
{
  "username": "john.doe",
  "email": "john.doe@company.com",
  "password": "SecurePassword123!",
  "role": "user",
  "enabled": true,
  
  // Group membership
  "groupIds": ["group-id-1", "group-id-2"],
  
  // Direct camera access (optional, overrides group)
  "allowedCameraIds": ["camera-1", "camera-2"],
  "allCamerasAccess": false
}
```

### User with All Cameras
```javascript
POST /api/users
{
  "username": "security.chief",
  "email": "security@company.com",
  "password": "SecurePassword123!",
  "role": "user",
  "groupIds": ["security-team"],
  "allCamerasAccess": true  // Has access to ALL cameras
}
```

---

## 🔧 API Endpoints

### User Management
```
GET    /api/users              - List all users (admin only)
GET    /api/users/:id          - Get user details (self or admin)
POST   /api/users              - Create user (admin only)
PUT    /api/users/:id          - Update user (self or admin)
DELETE /api/users/:id          - Delete user (admin only)
GET    /api/users/:id/permissions - Get user's effective permissions
```

### Group Management
```
GET    /api/groups             - List all groups (admin only)
GET    /api/groups/:id         - Get group details
POST   /api/groups             - Create group (admin only)
PUT    /api/groups/:id         - Update group (admin only)
DELETE /api/groups/:id         - Delete group (admin only)
POST   /api/groups/:id/users   - Add users to group
DELETE /api/groups/:id/users/:userId - Remove user from group
```

---

## 🌐 Remote Viewer Configuration

### Configurable Ports

Edit `.env` file:
```bash
# Main API Server
PORT=3000

# Remote Viewer Port (HTTP)
REMOTE_VIEWER_PORT=8080

# Remote Viewer Port (HTTPS)
REMOTE_VIEWER_HTTPS_PORT=8443

# Enable HTTPS
ENABLE_HTTPS=false
```

### Multiple Port Setup

**Scenario 1: Internal + External Access**
```bash
# Internal network (LAN)
PORT=3000
REMOTE_VIEWER_PORT=8080

# External access (through firewall)
# Forward external port 443 → internal 8443
ENABLE_HTTPS=true
REMOTE_VIEWER_HTTPS_PORT=8443
```

**Scenario 2: Department Separation**
```bash
# Admin interface
PORT=3000

# Security team viewers
REMOTE_VIEWER_PORT=8080

# Management viewers (separate network)
# Configure additional reverse proxy to route to different port
```

### Access URLs

- **Admin Interface**: `http://server:3000`
- **Remote Viewers (HTTP)**: `http://server:8080`
- **Remote Viewers (HTTPS)**: `https://server:8443`

---

## 🔐 Security Best Practices

### Password Policy
- Minimum 8 characters
- Require complexity (uppercase, lowercase, numbers, symbols)
- Implement password expiration (30/60/90 days)
- Prevent password reuse

### Account Security
- Enable account lockout after failed attempts
- Implement session timeout (configurable)
- Use HTTPS for all remote access
- Enable two-factor authentication (future feature)

### Permission Management
- **Principle of Least Privilege** - Grant minimum permissions needed
- **Regular Audits** - Review user permissions quarterly
- **Group-Based Management** - Use groups for easier administration
- **Separate Admin Accounts** - Don't use admin for daily tasks

---

## 📊 Permission Examples by Role

### Example 1: Security Guard (24/7 Monitoring)
```javascript
{
  "role": "user",
  "groups": ["Security Team"],
  "permissions": {
    "canViewLive": true,
    "canViewRecordings": true,
    "canControlPTZ": true,
    "canViewAIDetections": true,
    "canManageAlarms": true,  // Can acknowledge alarms
    "allCamerasAccess": true
  }
}
```

### Example 2: HR Manager (Specific Cameras)
```javascript
{
  "role": "user",
  "groups": ["HR Department"],
  "permissions": {
    "canViewLive": true,
    "canViewRecordings": true,
    "canDownloadRecordings": true,  // For incidents
    "allowedCameraIds": [
      "camera-entrance",
      "camera-hr-office",
      "camera-parking-lot"
    ]
  }
}
```

### Example 3: Building Maintenance (Read-Only)
```javascript
{
  "role": "viewer",
  "groups": ["Maintenance"],
  "permissions": {
    "canViewLive": true,
    "allowedCameraIds": [
      "camera-mechanical-room",
      "camera-loading-dock",
      "camera-storage"
    ]
  }
}
```

### Example 4: External Auditor (Temporary Access)
```javascript
{
  "role": "viewer",
  "enabled": true,  // Will be disabled after audit
  "permissions": {
    "canViewRecordings": true,
    "canExportData": true,
    "allowedCameraIds": ["camera-1", "camera-2"],  // Specific incident cameras
    // No live viewing, no downloads
  }
}
```

---

## 🛠️ Administration Tasks

### Adding a New Employee
1. Create user account
2. Assign to appropriate group(s)
3. Set camera access (if different from group)
4. Test login and verify permissions

### Changing Departments
1. Remove user from old group
2. Add user to new group
3. Verify camera access updated correctly

### Terminating Access
1. Disable user account (don't delete immediately)
2. Remove from all groups
3. After retention period, delete account

### Emergency Access
1. Create temporary admin account
2. Grant full access
3. Set expiration date
4. Monitor usage
5. Disable after use

---

## 📈 Monitoring & Auditing

### User Activity Logging
- Login/logout events
- Permission changes
- Camera access attempts
- Recording downloads
- System configuration changes

### Reports Available
- Active user sessions
- Permission audit report
- Camera access by user
- Failed login attempts
- User activity summary

---

## 🚀 Quick Start Examples

### Setup: Small Business (5 cameras)
```javascript
// 1. Create groups
POST /api/groups - "Owners" (all access)
POST /api/groups - "Staff" (limited access)

// 2. Create users
POST /api/users - Owner account → "Owners" group
POST /api/users - 3 Staff accounts → "Staff" group

// 3. Configure cameras
PUT /api/cameras/:id - Assign cameras to groups
```

### Setup: Enterprise (100+ cameras)
```javascript
// 1. Create department groups
POST /api/groups - "IT Security"
POST /api/groups - "Facilities"
POST /api/groups - "HR"
POST /api/groups - "Operations"

// 2. Create role-based groups
POST /api/groups - "Admins"
POST /api/groups - "Supervisors"
POST /api/groups - "Viewers"

// 3. Assign users to multiple groups
POST /api/users - User gets permissions from all groups combined

// 4. Organize cameras by location/department
PUT /api/cameras/:id - Tag cameras with metadata
PUT /api/groups/:id - Assign camera groups
```

---

**All user management features are accessible via the Web UI and REST API!**
