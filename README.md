# Community Complaint Management System

A comprehensive web application for managing and tracking community complaints with geospatial analysis, role-based access control, and real-time monitoring capabilities.

## 🌟 Features

### 📍 Interactive Map Integration
- **Real-time Complaint Mapping**: Visualize complaints geographically using Leaflet.js
- **Geospatial Analysis**: Advanced spatial querying and clustering analysis
- **Heatmap Visualization**: Identify complaint hotspots and density patterns
- **Drawing Tools**: Create custom polygons and areas for analysis
- **Location Tracking**: GPS-based complaint reporting with precise coordinates

### 👥 Role-Based Access Control
- **Public Users**: Report complaints, view status, track submissions
- **Field Agents**: Manage assigned complaints, update status, navigate to locations
- **Department Admins**: Oversee department-specific complaints and resources
- **System Admins**: Full system access, user management, analytics dashboard

### 📊 Analytics & Reporting
- **Real-time Dashboard**: Comprehensive statistics and performance metrics
- **Complaint Trends**: Historical analysis with charts and graphs
- **Performance Tracking**: Resolution times, response rates, satisfaction metrics
- **Data Export**: CSV/Excel export functionality for reports
- **Predictive Analytics**: Complaint pattern recognition and forecasting

### 🔧 Advanced Management Tools
- **Complaint Assignment**: Automatic and manual assignment to field agents
- **Status Tracking**: Multi-stage workflow (Open → In Progress → Resolved)
- **Comment System**: Internal communication and updates
- **Category Management**: Customizable complaint categories with icons
- **Department Integration**: Multi-department workflow support

## 🛠️ Tech Stack

### Frontend
- **React 18.2.0** - Modern UI framework
- **React Router Dom** - Client-side routing
- **Tailwind CSS** - Utility-first CSS framework
- **Lucide React** - Beautiful icon library

### Mapping & Visualization
- **Leaflet.js** - Interactive mapping library
- **React Leaflet** - React components for Leaflet
- **Leaflet Draw** - Drawing tools for map annotations
- **Leaflet MarkerCluster** - Marker clustering for performance
- **Leaflet Heat** - Heatmap visualization
- **Turf.js** - Advanced geospatial analysis

### Charts & Analytics
- **Chart.js** - Data visualization library
- **Recharts** - React charting library
- **Date-fns** - Date manipulation utilities

### Backend & Database
- **Supabase** - Backend-as-a-Service platform
- **PostgreSQL** - Robust relational database with PostGIS
- **Row Level Security** - Fine-grained access control

### Additional Libraries
- **Axios** - HTTP client for API requests
- **jQuery** - DOM manipulation and utilities
- **FontAwesome** - Additional icon set
- **XLSX** - Excel file generation and export

## 📦 Installation

### Prerequisites
- Node.js (v16.0.0 or higher)
- npm or yarn package manager
- Supabase account and project

### Setup Instructions

1. **Clone the repository**
   ```bash
   git clone https://github.com/abdulrehman1481/frontend-web.git
   cd frontend-web
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Configuration**
   
   Create a `.env` file in the root directory:
   ```env
   # Supabase Configuration
   REACT_APP_SUPABASE_URL=your_supabase_project_url
   REACT_APP_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. **Database Setup**
   
   Execute the SQL files in the following order:
   ```bash
   # Navigate to database schema directory
   cd src/databaseschema/
   
   # Execute schema files in your Supabase SQL editor:
   # 1. db.sql (main schema)
   # 2. add_complaint_comment.sql
   # 3. add_department_to_complaints.sql
   # 4. community_stats_functions.sql
   # 5. department_functions.sql
   # 6. field_agent_functions.sql
   # 7. user_preferences.sql
   ```

5. **Insert Initial Data**
   ```bash
   # Execute the categories insert script
   cd src/databasequeries/
   # Run insert_categories.sql in Supabase SQL editor
   ```

6. **Start Development Server**
   ```bash
   npm start
   ```

   The application will open at `http://localhost:3000`

## 🚀 Usage

### For Public Users
1. **Register/Login**: Create account or sign in
2. **Report Complaint**: Click on map location or use current GPS
3. **Add Details**: Select category, add description, upload photos
4. **Track Status**: Monitor complaint progress in dashboard

### For Administrators
1. **Access Admin Panel**: Login with admin credentials
2. **Manage Complaints**: View, assign, and update complaint status
3. **User Management**: Create/edit users and assign roles
4. **Analytics**: Review performance metrics and generate reports
5. **Map Analysis**: Use drawing tools for spatial analysis

### For Field Agents
1. **View Assignments**: Check assigned complaints in dashboard
2. **Navigate to Location**: Use integrated GPS navigation
3. **Update Status**: Change complaint status and add comments
4. **Upload Evidence**: Attach photos and completion reports

## 📁 Project Structure

```
frontend-web/
├── public/                 # Static assets
├── src/
│   ├── components/        # Reusable React components
│   │   ├── admin/         # Admin-specific components
│   │   ├── map/           # Map-related components
│   │   └── sidebar/       # Navigation components
│   ├── pages/             # Main application pages
│   ├── utils/             # Utility functions and helpers
│   ├── styles/            # CSS stylesheets
│   ├── databaseschema/    # SQL schema files
│   └── databasequeries/   # SQL query files
├── build/                 # Production build files
└── docs/                 # Documentation files
```

## 🔧 Configuration

### Environment Variables
- `REACT_APP_SUPABASE_URL`: Your Supabase project URL
- `REACT_APP_SUPABASE_ANON_KEY`: Supabase anonymous key

### Build Configuration
- **Development**: `npm start`
- **Production**: `npm run build`
- **Testing**: `npm test`

## 🌍 Deployment

### Netlify (Recommended)
1. Build the project: `npm run build`
2. Deploy the `build` folder to Netlify
3. Configure environment variables in Netlify dashboard

### Manual Deployment
1. Run `npm run build`
2. Upload `build` folder contents to your web server
3. Configure environment variables on your hosting platform

## 🔐 Security Features

- **Row Level Security (RLS)**: Database-level access control
- **Role-based permissions**: Granular access control
- **Environment variables**: Secure API key management
- **Input validation**: Frontend and backend data validation
- **HTTPS enforcement**: Secure data transmission

## 📈 Performance Optimizations

- **Marker clustering**: Efficient large dataset rendering
- **Lazy loading**: Components loaded on demand
- **Image optimization**: Compressed images and assets
- **Caching strategies**: Optimized API response caching
- **Bundle splitting**: Reduced initial load times

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/new-feature`
3. Commit changes: `git commit -am 'Add new feature'`
4. Push to branch: `git push origin feature/new-feature`
5. Submit pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🐛 Known Issues

- Map rendering performance on mobile devices
- Large dataset handling optimization needed
- IE11 compatibility issues

## 🔮 Future Enhancements

- [ ] Mobile application development
- [ ] Push notifications for status updates
- [ ] AI-powered complaint categorization
- [ ] Advanced predictive analytics
- [ ] Multi-language support
- [ ] Offline functionality
- [ ] Integration with external GIS systems

## 📞 Support

For support and questions:
- Create an issue on GitHub
- Contact the development team
- Check the documentation wiki

## 🏆 Acknowledgments

- OpenStreetMap contributors for map data
- Supabase team for backend infrastructure
- React and Leaflet.js communities
- All contributors and testers

---

**Built with ❤️ for better community management**
