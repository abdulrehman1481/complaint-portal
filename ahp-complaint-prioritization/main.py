"""
Main Application Entry Point
AHP-Based Complaint Prioritization System
"""

import sys
import argparse
from pathlib import Path
import pandas as pd

# Add src to path
sys.path.insert(0, str(Path(__file__).parent / 'src'))

from src.ahp_core import AHPCore
from src.data_loader import ComplaintDataLoader
from src.prioritizer import ComplaintPrioritizer
from src.visualizer import PrioritizationVisualizer


def main():
    """Main application function."""
    
    # Parse command line arguments
    parser = argparse.ArgumentParser(
        description='AHP-Based Complaint Prioritization System'
    )
    parser.add_argument(
        '--input', 
        type=str, 
        default='data/sample_complaints.csv',
        help='Input CSV file with complaint data'
    )
    parser.add_argument(
        '--output', 
        type=str, 
        default='data/prioritized_results.csv',
        help='Output CSV file for prioritized results'
    )
    parser.add_argument(
        '--report', 
        type=str, 
        default='reports/summary_report.txt',
        help='Output text file for summary report'
    )
    parser.add_argument(
        '--visualize', 
        action='store_true',
        help='Generate visualization charts'
    )
    parser.add_argument(
        '--map', 
        action='store_true',
        help='Generate interactive map visualization (requires folium)'
    )
    parser.add_argument(
        '--top-n', 
        type=int, 
        default=10,
        help='Number of top priority complaints to display'
    )
    
    args = parser.parse_args()
    
    print("=" * 70)
    print("AHP-BASED COMPLAINT PRIORITIZATION SYSTEM")
    print("=" * 70)
    print()
    
    # Step 1: Initialize components
    print("Step 1: Initializing AHP Prioritization Engine...")
    prioritizer = ComplaintPrioritizer()
    data_loader = ComplaintDataLoader()
    
    # Step 2: Load default criteria weights
    print("Step 2: Loading default criteria weights...")
    prioritizer.load_default_weights()
    print()
    
    print("Criteria Weights:")
    for criterion, weight in zip(prioritizer.criteria, prioritizer.ahp.weights):
        print(f"  • {criterion:<30} {weight:.4f} ({weight*100:.1f}%)")
    print()
    
    # Step 3: Load complaint data
    print(f"Step 3: Loading complaint data from {args.input}...")
    try:
        complaints_df = data_loader.load_from_csv(args.input)
        print(f"[OK] Loaded {len(complaints_df)} complaints")
    except FileNotFoundError:
        print(f"[ERROR] Input file '{args.input}' not found")
        print("  Please create sample data or specify a valid input file")
        return
    except Exception as e:
        print(f"[ERROR] Error loading data: {e}")
        return
    print()
    
    # Step 4: Enrich data with criteria scores
    print("Step 4: Calculating criteria scores for each complaint...")
    enriched_df = data_loader.enrich_complaint_data()
    print("[OK] Criteria scores calculated")
    print()
    
    # Step 5: Prioritize complaints
    print("Step 5: Applying AHP algorithm to prioritize complaints...")
    prioritized_df = prioritizer.prioritize_complaints(enriched_df)
    print(f"[OK] Prioritization complete")
    print()
    
    # Step 6: Display results
    print(f"Step 6: Top {args.top_n} Priority Complaints:")
    print("-" * 70)
    
    top_complaints = prioritizer.get_top_priorities(args.top_n)
    for idx, row in top_complaints.iterrows():
        rank = int(row['priority_rank'])
        complaint_id = row.get('id', 'N/A')
        title = row.get('title', 'No title')[:50]
        score = row['priority_score']
        status = row.get('status', 'N/A')
        
        print(f"#{rank:2d} | Score: {score:.4f} | [{complaint_id}] {title}")
        print(f"     Status: {status}")
        print()
    
    # Step 7: Export results
    print(f"Step 7: Exporting results to {args.output}...")
    prioritizer.export_results(args.output, include_scores=True)
    print()
    
    # Step 8: Generate summary report
    print(f"Step 8: Generating summary report...")
    report = prioritizer.generate_summary_report()
    
    # Save report to file
    report_path = Path(args.report)
    report_path.parent.mkdir(parents=True, exist_ok=True)
    with open(report_path, 'w', encoding='utf-8') as f:
        f.write(report)
    
    print(f"[OK] Summary report saved to {args.report}")
    print()
    
    # Display report
    print(report)
    
    # Step 9: Visualizations (optional)
    if args.visualize:
        print("Step 9: Generating visualizations...")
        visualizer = PrioritizationVisualizer()
        
        # Create reports directory for charts
        charts_dir = Path('reports/charts')
        charts_dir.mkdir(parents=True, exist_ok=True)
        
        # Criteria weights chart
        visualizer.plot_criteria_weights(
            prioritizer.criteria, 
            prioritizer.ahp.weights,
            save_path=charts_dir / 'criteria_weights.png'
        )
        
        # Priority distribution
        visualizer.plot_priority_distribution(
            prioritized_df,
            save_path=charts_dir / 'priority_distribution.png'
        )
        
        # Priority by type
        if 'type' in prioritized_df.columns:
            visualizer.plot_priority_by_category(
                prioritized_df,
                category_col='type',
                save_path=charts_dir / 'priority_by_type.png'
            )
        
        # Priority levels pie chart
        categories = prioritizer.get_priority_categories()
        visualizer.plot_priority_levels(
            categories,
            save_path=charts_dir / 'priority_levels.png'
        )
        
        # Criteria scores heatmap
        visualizer.plot_criteria_scores_heatmap(
            prioritized_df,
            top_n=min(20, len(prioritized_df)),
            save_path=charts_dir / 'criteria_heatmap.png'
        )
        
        print("[OK] All visualizations generated and saved to reports/charts/")
        print()
    
    # Step 10: Generate interactive map (optional)
    if args.map:
        print("Step 10: Generating interactive priority map...")
        visualizer = PrioritizationVisualizer()
        
        # Create reports directory
        charts_dir = Path('reports/charts')
        charts_dir.mkdir(parents=True, exist_ok=True)
        
        # Generate map with all complaints or top N
        map_top_n = None if not hasattr(args, 'top_n') else None  # Show all by default
        visualizer.plot_priority_map(
            prioritized_df,
            save_path=charts_dir / 'priority_map.html',
            top_n=map_top_n
        )
        
        print("[OK] Interactive map generated!")
        print(f"  Open reports/charts/priority_map.html in your browser to view")
        print()
    
    print("=" * 70)
    print("PRIORITIZATION COMPLETE")
    print("=" * 70)
    print()
    print("Output files:")
    print(f"  • Prioritized data: {args.output}")
    print(f"  • Summary report:   {args.report}")
    if args.visualize:
        print(f"  • Visualizations:   reports/charts/")
    if args.map:
        print(f"  • Interactive Map:  reports/charts/priority_map.html")
    print()


if __name__ == "__main__":
    main()
