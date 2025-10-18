# 🚀 Enhanced Demo Account Setup

## Overview
Comprehensive demo environment with professional structure, multiple departments, and realistic complaints workflow.

**Main Demo Account:**
- Email: admin@demo.gov
- Password: 12345678

---

## 📋 Quick Setup (3 Steps)

### Step 1: Update Emails & Passwords
Run: `update_emails_and_passwords.sql` in **Supabase SQL Editor**
- Updates all emails to professional addresses
- Sets demo passwords for easy testing

### Step 2: Create Demo Data
Run: `demo_setup.sql` in **Supabase SQL Editor**
- Creates departments, categories, users, and sample complaints

### Step 3: Test Login
```
Email: admin@demo.gov
Password: 12345678
```

---

## 🏢 Departments & Users

### Super Admins (Full Access)
| Name | Email | Password | Role |
|------|-------|----------|------|
| **Super Admin** | **admin@demo.gov** | **12345678** | System Administrator |
| Admin User | admin.deputy@demo.gov | Demo123! | Deputy Administrator |

### Department Admins
| Name | Email | Department | Password |
|------|-------|------------|----------|
| John Smith | john.smith@publicworks.demo.gov | Public Works | Demo123! |
| Abdul Nadeem | abdul.nadeem@sanitation.demo.gov | Sanitation | Demo123! |
| Mike Davis | mike.davis@emergency.demo.gov | Emergency Services | Demo123! |

### Field Agents
| Name | Email | Department | Password |
|------|-------|------------|----------|
| Abdul Rehman | abdul.rehman@parks.demo.gov | Parks & Recreation | Demo123! |
| Lisa Martinez | lisa.martinez@parks.demo.gov | Parks & Recreation | Demo123! |
| Goheer Hassan | goheer.hassan@emergency.demo.gov | Emergency Services | Demo123! |
| Chris Lee | chris.lee@emergency.demo.gov | Emergency Services | Demo123! |

### Public Users (Citizens)
| Name | Email | Password |
|------|-------|----------|
| Alice Cooper | alice.cooper@citizen.demo.gov | Demo123! |
| Abdul Rehman Nadeem | abdulrehman.nadeem@citizen.demo.gov | Demo123! |

---

## 🏗️ What You Get

### 🏢 **10 Departments**
Public Works, Sanitation, Water & Sewage, Electrical Services, Public Safety, Parks & Recreation, Traffic Management, Building & Planning, Environmental Services, Emergency Services

### 📋 **40 Categories**
- **Public Works**: Pothole Repair, Road Damage, Sidewalk Repair, Bridge Maintenance
- **Sanitation**: Garbage Collection, Illegal Dumping, Pest Control, Public Toilet Issues
- **Water & Sewage**: Water Leakage, Sewage Issues, Water Quality, Drainage Problems
- **Electrical**: Street Light Fault, Power Outage, Traffic Signals, Electrical Hazards
- **Public Safety**: Safety Hazards, Suspicious Activity, Vandalism, Noise Complaints
- **Parks**: Park Maintenance, Playground Safety, Sports Facilities, Tree Trimming
- **Traffic**: Traffic Congestion, Parking Violations, Road Signs, Speed Bumps
- **Building**: Code Violations, Zoning Issues, Construction Noise, Permit Issues
- **Environment**: Air Quality, Hazardous Materials, Recycling, Wildlife Problems
- **Emergency**: Emergency Response, Fire Hazards, Flood Warnings, Gas Leaks

### 📝 **15 Sample Complaints**
- **6 Open**: Various priorities and departments
- **4 In Progress**: Assigned to field agents with progress updates
- **5 Resolved**: Completed with resolution dates and notes

### 💬 **13 Comment Threads**
Realistic conversations between citizens, field agents, and department admins

---

## 🎯 Demo Scenarios

### 1. Super Admin Dashboard
- Login: admin@demo.gov / 12345678
- View all departments and complaints
- Access user management and system settings
- Generate reports across all departments

### 2. Department Management
- Login: john.smith@publicworks.demo.gov / Demo123!
- Manage Public Works complaints
- Assign tasks to field agents
- Review and approve work

### 3. Field Agent Operations
- Login: abdul.rehman@parks.demo.gov / Demo123!
- View assigned complaints in Parks department
- Update complaint status and add progress notes
- Mark complaints as resolved

### 4. Citizen Reporting
- Login: alice.cooper@citizen.demo.gov / Demo123!
- Report new complaints with location
- Track status of submitted complaints
- View public complaint map

---

## 🚨 Troubleshooting

**Can't login with main admin?**
```sql
UPDATE auth.users 
SET encrypted_password = crypt('12345678', gen_salt('bf'))
WHERE email = 'admin@demo.gov';
```

**Need to reset all passwords?**
Re-run: `update_emails_and_passwords.sql`

**Missing complaints/users?**
Re-run: `demo_setup.sql`

---

## 📁 Files Structure

### Core Setup Files
- **`README.md`** - This guide
- **`demo_setup.sql`** - Main setup script (run second)
- **`update_emails_and_passwords.sql`** - Email & password setup (run first)

### Database Schema Files
- `db.sql` - Main database schema
- `department_functions.sql` - Department management functions
- `field_agent_functions.sql` - Field agent utilities
- Other utility files...

---

## ✨ Key Features

✅ **Professional Email Structure** - Organized by department and role  
✅ **Realistic Workflow** - Open → In Progress → Resolved with comments  
✅ **Multi-Department Support** - 10 departments with specialized categories  
✅ **Priority System** - Low, Medium, High priority complaints  
✅ **Geographic Data** - All complaints have location coordinates  
✅ **Comment System** - Internal and public communication  
✅ **Role-Based Access** - Different permissions for each user type  

**Perfect for demos, testing, and showcasing your complaint management system! 🎉**