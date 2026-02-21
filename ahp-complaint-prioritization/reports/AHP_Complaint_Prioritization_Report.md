# AHP Complaint Prioritization Report

**Prepared for:** Civic Services Directorate  
**Analysis Date:** 26 December 2025  
**Data Source:** reports generated via main.py execution (80 active complaints)

---

## 1. Executive Overview
- The Analytic Hierarchy Process (AHP) engine reprioritized 80 Islamabad complaints using refreshed, diversified dummy data.
- Structural safety and gas-related incidents dominate the critical list, reflecting the 42.42% weight assigned to public safety risk.
- Quartile bands distribute evenly across critical, high, medium, and low priority, ensuring balanced workload segmentation.
- Visual assets and interactive map exports located in reports/charts support briefing decks and operational dashboards.

## 2. Methodology Summary
- Criteria applied: Public Safety Risk, Scale of Impact, Urgency Level, Resource Requirements, Department Capacity.
- Pairwise comparisons follow municipal risk guidance, producing normalized eigenvector weights via AHP.
- Complaint records enriched with five 0–1 criteria scores (safety, impact, urgency, resource inversion, capacity).
- Weighted scoring computes a single priority index per complaint; dense ranking resolves ties.

## 3. Criteria Weighting
| Criterion | Weight | Influence |
| --- | --- | --- |
| Public Safety Risk | 0.4242 | 42.4% |
| Urgency Level | 0.2318 | 23.2% |
| Scale of Impact | 0.1868 | 18.7% |
| Department Capacity | 0.0857 | 8.6% |
| Resource Requirements | 0.0715 | 7.2% |

## 4. Consistency Check
- Consistency Ratio (CR): 0.0144
- Status: Pass (CR < 0.10). Pairwise judgements remain coherent and actionable.

## 5. Dataset Snapshot
- Total complaints scored: 80
- Severity mix: 24 critical, 25 high, 18 medium, 13 low
- Status mix: 27 in_progress, 21 pending, 13 scheduled, 13 resolved, 6 escalated
- Predominant types (top five): building_collapse (10), water_contamination (10), fire_hazard (8), pothole (7), littering (7)

## 6. Prioritization Results
### 6.1 Priority Bands
- Critical (top quartile): 20 complaints
- High: 20 complaints
- Medium: 20 complaints
- Low: 20 complaints

### 6.2 Top Priority Complaints
| Rank | ID | Title | Department | Status | Priority Score |
| --- | --- | --- | --- | --- | --- |
| 1 | C-1077 | Wall Collapse Risk F-10 | Building Safety | resolved | 0.725 |
| 2 | C-1067 | Gas Pressure Drop E-7 Markaz | Public Works | resolved | 0.711 |
| 3 | C-1010 | Unsafe Building Report Blue Area | Building Safety | in_progress | 0.707 |
| 3 | C-1028 | Pipeline Leak Near Shakarparian Park | Public Works | resolved | 0.707 |
| 4 | C-1002 | Gas Leak Alert 7th Avenue | Public Works | in_progress | 0.705 |
| 5 | C-1061 | Electrical Hazard Serena Chowk | Public Works | scheduled | 0.699 |
| 6 | C-1009 | Unsafe Building Report 9th Avenue | Building Safety | resolved | 0.697 |
| 6 | C-1004 | Wall Collapse Risk F-10 Markaz | Building Safety | pending | 0.697 |
| 6 | C-1015 | Fire Safety Breach PWD | Fire Department | scheduled | 0.697 |
| 6 | C-1075 | Gas Leak Alert I-11 Industrial | Public Works | scheduled | 0.697 |

### 6.3 Observations
- Structural and gas incidents form 70% of the top 10, reinforcing the dominance of safety and impact criteria.
- Resolution progress: 40% of top 10 already resolved or scheduled, indicating effective follow-up on highest risks.
- Capacity scores moderately reduce priority for departments reporting heavier workloads, ensuring realistic dispatch expectations.

## 7. Departmental Highlights
- Building Safety: 5 of top 10 items; prioritize structural inspections and temporary closures.
- Public Works (Gas/Electrical/Lighting): 4 of top 10; coordinate with utility providers for rapid mitigation.
- Fire Department: 1 of top 10; focus on fire suppression readiness in mixed-use commercial zones.

## 8. Visual Assets
### Figure 1. Criteria Weight Distribution
*Insert image:* reports/charts/criteria_weights.png

### Figure 2. Priority Distribution by Level
*Insert image:* reports/charts/priority_distribution.png

### Figure 3. Priority by Complaint Type
*Insert image:* reports/charts/priority_by_type.png

### Figure 4. Priority Levels by Department
*Insert image:* reports/charts/priority_levels.png

### Figure 5. Criteria Heatmap
*Insert image:* reports/charts/criteria_heatmap.png

### Figure 6. Interactive Priority Map
*Insert map screenshot:* capture from reports/charts/priority_map.html showcasing 80 geocoded complaints and priority gradations.

## 9. Recommendations
- Validate high-priority structural sites (C-1077, C-1010) with on-site engineering assessments within 24 hours.
- Deploy rapid-response crews for unresolved gas alerts (C-1002, C-1027) and electrical hazards (C-1061, C-1049).
- Use Quartile segmentation to assign field teams by urgency while monitoring department load indicators.
- Refresh dataset weekly or upon major incident updates to keep AHP outputs synchronized with ground reality.
