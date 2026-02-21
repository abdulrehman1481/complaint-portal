"""
Visualization Module
Creates charts and visual reports for AHP results
"""

import matplotlib.pyplot as plt
import seaborn as sns
import pandas as pd
import numpy as np
from typing import List, Dict, Optional
try:
    import folium
    from folium import plugins
    FOLIUM_AVAILABLE = True
except ImportError:
    FOLIUM_AVAILABLE = False
    print("Warning: folium not installed. Map visualization will not be available.")


class PrioritizationVisualizer:
    """
    Creates visualizations for complaint prioritization results.
    """
    
    def __init__(self):
        # Set style
        sns.set_style("whitegrid")
        plt.rcParams['figure.figsize'] = (12, 8)
        
    def plot_criteria_weights(self, criteria: List[str], weights: np.ndarray, 
                              save_path: Optional[str] = None):
        """
        Create bar chart of criteria weights.
        
        Args:
            criteria: List of criteria names
            weights: Array of criteria weights
            save_path: Optional path to save figure
        """
        fig, ax = plt.subplots(figsize=(10, 6))
        
        # Create bar chart
        bars = ax.barh(criteria, weights, color='steelblue', alpha=0.8)
        
        # Add percentage labels
        for i, (bar, weight) in enumerate(zip(bars, weights)):
            ax.text(weight + 0.01, i, f'{weight*100:.1f}%', 
                   va='center', fontsize=10, fontweight='bold')
        
        ax.set_xlabel('Weight', fontsize=12, fontweight='bold')
        ax.set_title('AHP Criteria Weights for Complaint Prioritization', 
                    fontsize=14, fontweight='bold', pad=20)
        ax.set_xlim(0, max(weights) * 1.15)
        
        plt.tight_layout()
        
        if save_path:
            plt.savefig(save_path, dpi=300, bbox_inches='tight')
            print(f"[OK] Criteria weights chart saved to {save_path}")
        
        plt.show()
    
    def plot_priority_distribution(self, complaints_df: pd.DataFrame, 
                                   save_path: Optional[str] = None):
        """
        Create histogram of priority score distribution.
        
        Args:
            complaints_df: DataFrame with priority scores
            save_path: Optional path to save figure
        """
        fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 5))
        
        # Histogram
        ax1.hist(complaints_df['priority_score'], bins=30, 
                color='steelblue', alpha=0.7, edgecolor='black')
        ax1.set_xlabel('Priority Score', fontsize=11, fontweight='bold')
        ax1.set_ylabel('Number of Complaints', fontsize=11, fontweight='bold')
        ax1.set_title('Distribution of Priority Scores', fontsize=12, fontweight='bold')
        ax1.axvline(complaints_df['priority_score'].mean(), 
                   color='red', linestyle='--', linewidth=2, label='Mean')
        ax1.legend()
        
        # Box plot
        ax2.boxplot(complaints_df['priority_score'], vert=True)
        ax2.set_ylabel('Priority Score', fontsize=11, fontweight='bold')
        ax2.set_title('Priority Score Box Plot', fontsize=12, fontweight='bold')
        ax2.set_xticklabels(['All Complaints'])
        
        plt.tight_layout()
        
        if save_path:
            plt.savefig(save_path, dpi=300, bbox_inches='tight')
            print(f"[OK] Distribution chart saved to {save_path}")
        
        plt.show()
    
    def plot_priority_by_category(self, complaints_df: pd.DataFrame,
                                  category_col: str = 'type',
                                  save_path: Optional[str] = None):
        """
        Create bar chart of average priority by category.
        
        Args:
            complaints_df: DataFrame with complaints
            category_col: Column name for categorization
            save_path: Optional path to save figure
        """
        # Calculate average priority by category
        category_priorities = complaints_df.groupby(category_col)['priority_score'].agg(['mean', 'count'])
        category_priorities = category_priorities.sort_values('mean', ascending=False)
        
        fig, ax = plt.subplots(figsize=(12, 6))
        
        # Create bars
        bars = ax.bar(range(len(category_priorities)), category_priorities['mean'], 
                     color='steelblue', alpha=0.8)
        
        # Color top 3 differently
        for i in range(min(3, len(bars))):
            bars[i].set_color('coral')
        
        # Labels
        ax.set_xticks(range(len(category_priorities)))
        ax.set_xticklabels(category_priorities.index, rotation=45, ha='right')
        ax.set_ylabel('Average Priority Score', fontsize=11, fontweight='bold')
        ax.set_xlabel(category_col.capitalize(), fontsize=11, fontweight='bold')
        ax.set_title(f'Average Priority Score by {category_col.capitalize()}', 
                    fontsize=13, fontweight='bold', pad=15)
        
        # Add count annotations
        for i, (idx, row) in enumerate(category_priorities.iterrows()):
            ax.text(i, row['mean'] + 0.01, f"n={int(row['count'])}", 
                   ha='center', va='bottom', fontsize=9)
        
        plt.tight_layout()
        
        if save_path:
            plt.savefig(save_path, dpi=300, bbox_inches='tight')
            print(f"[OK] Category priority chart saved to {save_path}")
        
        plt.show()
    
    def plot_criteria_scores_heatmap(self, complaints_df: pd.DataFrame, 
                                     top_n: int = 20,
                                     save_path: Optional[str] = None):
        """
        Create heatmap of criteria scores for top N complaints.
        
        Args:
            complaints_df: DataFrame with complaints and scores
            top_n: Number of top complaints to show
            save_path: Optional path to save figure
        """
        # Get top N complaints
        top_complaints = complaints_df.head(top_n)
        
        # Criteria columns
        criteria_cols = ['safety_score', 'impact_score', 'urgency_score',
                        'resource_score', 'capacity_score']
        
        # Check which columns exist
        available_cols = [col for col in criteria_cols if col in top_complaints.columns]
        
        if not available_cols:
            print("No criteria score columns found for heatmap")
            return
        
        # Create heatmap data
        heatmap_data = top_complaints[available_cols].values
        
        # Create labels
        if 'id' in top_complaints.columns:
            y_labels = [f"#{int(row['priority_rank'])} - {row['id']}" 
                       for _, row in top_complaints.iterrows()]
        else:
            y_labels = [f"#{int(row['priority_rank'])}" 
                       for _, row in top_complaints.iterrows()]
        
        x_labels = [col.replace('_score', '').replace('_', ' ').title() 
                   for col in available_cols]
        
        # Create figure
        fig, ax = plt.subplots(figsize=(10, max(8, top_n * 0.4)))
        
        # Create heatmap
        im = ax.imshow(heatmap_data, cmap='RdYlGn', aspect='auto', vmin=0, vmax=1)
        
        # Labels
        ax.set_xticks(range(len(x_labels)))
        ax.set_yticks(range(len(y_labels)))
        ax.set_xticklabels(x_labels, rotation=45, ha='right')
        ax.set_yticklabels(y_labels)
        
        # Colorbar
        cbar = plt.colorbar(im, ax=ax)
        cbar.set_label('Score', rotation=270, labelpad=20, fontweight='bold')
        
        # Title
        ax.set_title(f'Criteria Scores for Top {top_n} Priority Complaints', 
                    fontsize=13, fontweight='bold', pad=15)
        
        # Add text annotations
        for i in range(len(y_labels)):
            for j in range(len(x_labels)):
                text = ax.text(j, i, f'{heatmap_data[i, j]:.2f}',
                             ha="center", va="center", color="black", fontsize=8)
        
        plt.tight_layout()
        
        if save_path:
            plt.savefig(save_path, dpi=300, bbox_inches='tight')
            print(f"[OK] Criteria heatmap saved to {save_path}")
        
        plt.show()
    
    def plot_priority_levels(self, priority_categories: Dict[str, pd.DataFrame],
                           save_path: Optional[str] = None):
        """
        Create pie chart of priority level distribution.
        
        Args:
            priority_categories: Dictionary with priority levels and DataFrames
            save_path: Optional path to save figure
        """
        # Count complaints in each category
        counts = {level: len(df) for level, df in priority_categories.items()}
        
        fig, ax = plt.subplots(figsize=(10, 7))
        
        # Colors
        colors = {'critical': '#d62728', 'high': '#ff7f0e', 
                 'medium': '#ffbb78', 'low': '#98df8a'}
        
        # Create pie chart
        wedges, texts, autotexts = ax.pie(
            counts.values(), 
            labels=[f'{level.capitalize()}\n({count} complaints)' 
                   for level, count in counts.items()],
            colors=[colors[level] for level in counts.keys()],
            autopct='%1.1f%%',
            startangle=90,
            textprops={'fontsize': 11, 'fontweight': 'bold'}
        )
        
        # Make percentage text white
        for autotext in autotexts:
            autotext.set_color('white')
            autotext.set_fontsize(12)
        
        ax.set_title('Complaint Distribution by Priority Level', 
                    fontsize=14, fontweight='bold', pad=20)
        
        plt.tight_layout()
        
        if save_path:
            plt.savefig(save_path, dpi=300, bbox_inches='tight')
            print(f"[OK] Priority levels chart saved to {save_path}")
        
        plt.show()
    
    def create_comparison_matrix_visualization(self, comparison_matrix: np.ndarray,
                                              criteria: List[str],
                                              save_path: Optional[str] = None):
        """
        Visualize the pairwise comparison matrix.
        
        Args:
            comparison_matrix: AHP comparison matrix
            criteria: List of criteria names
            save_path: Optional path to save figure
        """
        fig, ax = plt.subplots(figsize=(10, 8))
        
        # Create heatmap
        im = ax.imshow(comparison_matrix, cmap='YlOrRd', aspect='auto')
        
        # Labels
        ax.set_xticks(range(len(criteria)))
        ax.set_yticks(range(len(criteria)))
        ax.set_xticklabels(criteria, rotation=45, ha='right')
        ax.set_yticklabels(criteria)
        
        # Colorbar
        cbar = plt.colorbar(im, ax=ax)
        cbar.set_label('Comparison Value', rotation=270, labelpad=20, fontweight='bold')
        
        # Title
        ax.set_title('AHP Pairwise Comparison Matrix', 
                    fontsize=14, fontweight='bold', pad=15)
        
        # Add text annotations
        for i in range(len(criteria)):
            for j in range(len(criteria)):
                text = ax.text(j, i, f'{comparison_matrix[i, j]:.2f}',
                             ha="center", va="center", 
                             color="white" if comparison_matrix[i, j] > 3 else "black",
                             fontsize=9, fontweight='bold')
        
        plt.tight_layout()
        
        if save_path:
            plt.savefig(save_path, dpi=300, bbox_inches='tight')
            print(f"[OK] Comparison matrix visualization saved to {save_path}")
        
        plt.show()
    
    def plot_priority_map(self, complaints_df: pd.DataFrame,
                         save_path: Optional[str] = None,
                         top_n: Optional[int] = None):
        """
        Create an interactive map visualization of complaints based on priority.
        
        Args:
            complaints_df: DataFrame with complaints including latitude/longitude
            save_path: Optional path to save HTML map file
            top_n: Optional number of top priority complaints to show (None = all)
        """
        if not FOLIUM_AVAILABLE:
            print("[ERROR] folium package is required for map visualization")
            print("  Install it with: pip install folium")
            return
        
        # Check for required columns
        required_cols = ['latitude', 'longitude', 'priority_score']
        missing_cols = [col for col in required_cols if col not in complaints_df.columns]
        
        if missing_cols:
            print(f"[ERROR] Missing required columns for map: {missing_cols}")
            return
        
        # Filter to top N if specified
        map_df = complaints_df.copy()
        if top_n:
            map_df = map_df.head(top_n)
        
        # Remove rows with missing coordinates
        map_df = map_df.dropna(subset=['latitude', 'longitude'])
        
        if len(map_df) == 0:
            print("[ERROR] No complaints with valid coordinates found")
            return
        
        # Calculate center of map (Islamabad center as default)
        center_lat = map_df['latitude'].mean() if not map_df.empty else 33.6844
        center_lon = map_df['longitude'].mean() if not map_df.empty else 73.0479
        
        # Create base map
        m = folium.Map(
            location=[center_lat, center_lon],
            zoom_start=12,
            tiles='OpenStreetMap'
        )
        
        # Add additional tile layers
        folium.TileLayer('CartoDB positron', name='Light Map').add_to(m)
        folium.TileLayer('CartoDB dark_matter', name='Dark Map').add_to(m)
        
        # Define color scale based on priority score
        def get_marker_color(priority_score, priority_rank):
            """Determine marker color based on priority."""
            if priority_rank <= 10:
                return 'red'
            elif priority_rank <= 25:
                return 'orange'
            elif priority_rank <= 50:
                return 'yellow'
            else:
                return 'green'
        
        def get_marker_size(priority_score, priority_rank):
            """Determine marker size based on priority."""
            if priority_rank <= 10:
                return 12
            elif priority_rank <= 25:
                return 10
            elif priority_rank <= 50:
                return 8
            else:
                return 6
        
        # Add markers for each complaint
        for idx, row in map_df.iterrows():
            lat = row['latitude']
            lon = row['longitude']
            priority_score = row['priority_score']
            priority_rank = int(row.get('priority_rank', 0))
            
            # Get complaint details
            complaint_id = row.get('id', 'N/A')
            title = row.get('title', 'Unknown Complaint')
            severity = row.get('severity', 'N/A')
            complaint_type = row.get('type', 'N/A')
            department = row.get('department', 'N/A')
            affected_people = row.get('affected_people', 'N/A')
            location_name = row.get('location_name', 'Unknown Location')
            description = row.get('description', 'No description')
            
            # Determine color and size
            color = get_marker_color(priority_score, priority_rank)
            size = get_marker_size(priority_score, priority_rank)
            
            # Create popup HTML
            popup_html = f"""
            <div style="font-family: Arial, sans-serif; width: 300px;">
                <h4 style="color: {color}; margin-bottom: 8px;">
                    #{priority_rank} - {complaint_id}
                </h4>
                <h5 style="margin: 4px 0;">{title}</h5>
                <hr style="margin: 8px 0;">
                <table style="width: 100%; font-size: 12px;">
                    <tr>
                        <td><b>Priority Score:</b></td>
                        <td>{priority_score:.4f}</td>
                    </tr>
                    <tr>
                        <td><b>Location:</b></td>
                        <td>{location_name}</td>
                    </tr>
                    <tr>
                        <td><b>Type:</b></td>
                        <td>{complaint_type.replace('_', ' ').title()}</td>
                    </tr>
                    <tr>
                        <td><b>Severity:</b></td>
                        <td><span style="color: {'red' if severity == 'critical' else 'orange' if severity == 'high' else 'blue'};">
                            {severity.upper()}
                        </span></td>
                    </tr>
                    <tr>
                        <td><b>Department:</b></td>
                        <td>{department}</td>
                    </tr>
                    <tr>
                        <td><b>Affected People:</b></td>
                        <td>{affected_people}</td>
                    </tr>
                </table>
                <hr style="margin: 8px 0;">
                <p style="font-size: 11px; margin: 4px 0;"><i>{description[:150]}...</i></p>
            </div>
            """
            
            # Add marker
            folium.CircleMarker(
                location=[lat, lon],
                radius=size,
                popup=folium.Popup(popup_html, max_width=350),
                color=color,
                fill=True,
                fillColor=color,
                fillOpacity=0.7,
                weight=2
            ).add_to(m)
            
            # Add label for top 10 complaints
            if priority_rank <= 10:
                folium.Marker(
                    location=[lat, lon],
                    icon=folium.DivIcon(html=f"""
                        <div style="font-size: 10px; font-weight: bold; color: white; 
                        background-color: {color}; padding: 2px 5px; border-radius: 3px;
                        border: 1px solid white;">
                            #{priority_rank}
                        </div>
                    """)
                ).add_to(m)
        
        # Add a legend
        legend_html = '''
        <div style="position: fixed; 
                    bottom: 50px; right: 50px; width: 200px; height: auto; 
                    background-color: white; z-index:9999; font-size:14px;
                    border:2px solid grey; border-radius: 5px; padding: 10px;">
            <h4 style="margin-top: 0;">Priority Levels</h4>
            <p><span style="color: red;">●</span> Top 1-10 (Critical)</p>
            <p><span style="color: orange;">●</span> Top 11-25 (High)</p>
            <p><span style="color: yellow;">●</span> Top 26-50 (Medium)</p>
            <p><span style="color: green;">●</span> 51+ (Low)</p>
            <hr>
            <p style="font-size: 11px; margin-top: 8px;">
                Click markers for details<br>
                Total: ''' + str(len(map_df)) + ''' complaints
            </p>
        </div>
        '''
        m.get_root().html.add_child(folium.Element(legend_html))
        
        # Add marker cluster for better performance with many markers
        if len(map_df) > 100:
            marker_cluster = plugins.MarkerCluster().add_to(m)
        
        # Add fullscreen button
        plugins.Fullscreen(position='topleft').add_to(m)
        
        # Add layer control
        folium.LayerControl().add_to(m)
        
        # Add title
        title_html = '''
        <div style="position: fixed; 
                    top: 10px; left: 50px; width: auto; height: auto; 
                    background-color: white; z-index:9999; font-size:16px;
                    border:2px solid grey; border-radius: 5px; padding: 10px;">
            <h3 style="margin: 0;">AHP-Based Complaint Priority Map - Islamabad</h3>
        </div>
        '''
        m.get_root().html.add_child(folium.Element(title_html))
        
        # Save map
        if save_path:
            m.save(save_path)
            print(f"[OK] Interactive map saved to {save_path}")
            print(f"  Open in browser to view {len(map_df)} complaints")
        
        return m


if __name__ == "__main__":
    print("Visualization Module - Testing")
    
    # Example: Create sample data for testing
    visualizer = PrioritizationVisualizer()
    
    # Test criteria weights visualization
    criteria = ["Public Safety", "Impact Scale", "Urgency", "Resources", "Capacity"]
    weights = np.array([0.35, 0.25, 0.20, 0.12, 0.08])
    
    print("\nGenerating sample criteria weights chart...")
    visualizer.plot_criteria_weights(criteria, weights)
