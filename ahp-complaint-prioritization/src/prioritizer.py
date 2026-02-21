"""
Complaint Prioritization Engine
Applies AHP algorithm to complaint data for priority ranking
"""

import numpy as np
import pandas as pd
from typing import Dict, List, Tuple, Optional
from ahp_core import AHPCore
from data_loader import ComplaintDataLoader


class ComplaintPrioritizer:
    """
    Main prioritization engine that combines AHP with complaint data.
    """
    
    # Default criteria for complaint prioritization
    DEFAULT_CRITERIA = [
        "Public Safety Risk",
        "Scale of Impact",
        "Urgency Level",
        "Resource Requirements",
        "Department Capacity"
    ]
    
    def __init__(self, criteria: Optional[List[str]] = None):
        """
        Initialize prioritization engine.
        
        Args:
            criteria: List of criteria names (uses defaults if not provided)
        """
        self.criteria = criteria or self.DEFAULT_CRITERIA
        self.ahp = AHPCore(self.criteria)
        self.data_loader = ComplaintDataLoader()
        self.prioritized_complaints = None
        
    def set_criteria_weights(self, pairwise_comparisons: Dict[Tuple[str, str], float]):
        """
        Set criteria weights using pairwise comparisons.
        
        Args:
            pairwise_comparisons: Dictionary of pairwise comparison values
        """
        self.ahp.create_comparison_matrix(pairwise_comparisons)
        self.ahp.calculate_weights()
        self.ahp.calculate_consistency_ratio()
        
        # Validate consistency
        if not self.ahp.is_consistent():
            print(f"WARNING: Inconsistent comparisons detected (CR = {self.ahp.consistency_ratio:.4f})")
            print("Please review your pairwise comparisons.")
        else:
            print(f"[OK] Consistent comparisons (CR = {self.ahp.consistency_ratio:.4f})")
    
    def load_default_weights(self):
        """
        Load default pairwise comparisons based on typical municipal priorities.
        """
        # Default comparisons favoring public safety and urgency
        default_comparisons = {
            ("Public Safety Risk", "Scale of Impact"): 3,      # Safety moderately more important
            ("Public Safety Risk", "Urgency Level"): 2,        # Safety slightly more important
            ("Public Safety Risk", "Resource Requirements"): 5,  # Safety much more important
            ("Public Safety Risk", "Department Capacity"): 4,   # Safety more important
            ("Scale of Impact", "Urgency Level"): 1,           # Equal importance
            ("Scale of Impact", "Resource Requirements"): 3,    # Impact moderately more important
            ("Scale of Impact", "Department Capacity"): 2,      # Impact slightly more important
            ("Urgency Level", "Resource Requirements"): 4,      # Urgency more important
            ("Urgency Level", "Department Capacity"): 3,        # Urgency moderately more important
            ("Resource Requirements", "Department Capacity"): 1 # Equal importance
        }
        
        self.set_criteria_weights(default_comparisons)
    
    def prioritize_complaints(self, complaints_df: pd.DataFrame) -> pd.DataFrame:
        """
        Calculate priority scores for all complaints.
        
        Args:
            complaints_df: DataFrame with complaint data and criteria scores
            
        Returns:
            DataFrame with added priority_score and priority_rank columns
        """
        if self.ahp.weights is None:
            raise ValueError("Criteria weights not set. Call set_criteria_weights or load_default_weights first.")
        
        # Get criteria scores
        criteria_cols = ['safety_score', 'impact_score', 'urgency_score', 
                        'resource_score', 'capacity_score']
        
        # Ensure all criteria columns exist
        missing_cols = [col for col in criteria_cols if col not in complaints_df.columns]
        if missing_cols:
            raise ValueError(f"Missing criteria columns: {missing_cols}")
        
        # Calculate weighted priority scores
        scores_matrix = complaints_df[criteria_cols].values
        priority_scores = np.dot(scores_matrix, self.ahp.weights)
        
        # Add to DataFrame
        result_df = complaints_df.copy()
        result_df['priority_score'] = priority_scores
        
        # Rank complaints (1 = highest priority)
        result_df['priority_rank'] = result_df['priority_score'].rank(ascending=False, method='dense')
        
        # Sort by priority
        result_df = result_df.sort_values('priority_score', ascending=False)
        
        self.prioritized_complaints = result_df
        return result_df
    
    def get_priority_categories(self) -> Dict[str, pd.DataFrame]:
        """
        Categorize complaints into priority levels.
        
        Returns:
            Dictionary with 'critical', 'high', 'medium', 'low' priority DataFrames
        """
        if self.prioritized_complaints is None:
            raise ValueError("No prioritized complaints. Run prioritize_complaints first.")
        
        df = self.prioritized_complaints
        
        # Define thresholds
        q75 = df['priority_score'].quantile(0.75)
        q50 = df['priority_score'].quantile(0.50)
        q25 = df['priority_score'].quantile(0.25)
        
        return {
            'critical': df[df['priority_score'] >= q75],
            'high': df[(df['priority_score'] >= q50) & (df['priority_score'] < q75)],
            'medium': df[(df['priority_score'] >= q25) & (df['priority_score'] < q50)],
            'low': df[df['priority_score'] < q25]
        }
    
    def get_top_priorities(self, n: int = 10) -> pd.DataFrame:
        """
        Get top N highest priority complaints.
        
        Args:
            n: Number of top complaints to return
            
        Returns:
            DataFrame with top N complaints
        """
        if self.prioritized_complaints is None:
            raise ValueError("No prioritized complaints. Run prioritize_complaints first.")
        
        return self.prioritized_complaints.head(n)
    
    def get_department_priorities(self, department: str) -> pd.DataFrame:
        """
        Get prioritized complaints for a specific department.
        
        Args:
            department: Department name
            
        Returns:
            DataFrame with department complaints sorted by priority
        """
        if self.prioritized_complaints is None:
            raise ValueError("No prioritized complaints. Run prioritize_complaints first.")
        
        dept_complaints = self.prioritized_complaints[
            self.prioritized_complaints['department'] == department
        ]
        
        return dept_complaints.sort_values('priority_score', ascending=False)
    
    def export_results(self, filepath: str, include_scores: bool = True):
        """
        Export prioritized results to CSV.
        
        Args:
            filepath: Output file path
            include_scores: Whether to include individual criteria scores
        """
        if self.prioritized_complaints is None:
            raise ValueError("No prioritized complaints. Run prioritize_complaints first.")
        
        # Select columns to export
        base_cols = ['id', 'title', 'type', 'department', 'status', 
                    'priority_score', 'priority_rank']
        
        if include_scores:
            score_cols = ['safety_score', 'impact_score', 'urgency_score',
                         'resource_score', 'capacity_score']
            export_cols = base_cols + score_cols
        else:
            export_cols = base_cols
        
        # Filter to available columns
        available_cols = [col for col in export_cols if col in self.prioritized_complaints.columns]
        
        # Export
        self.prioritized_complaints[available_cols].to_csv(filepath, index=False)
        print(f"[OK] Results exported to {filepath}")
    
    def generate_summary_report(self) -> str:
        """
        Generate text summary of prioritization results.
        
        Returns:
            Formatted summary report string
        """
        if self.prioritized_complaints is None:
            return "No prioritization results available."
        
        categories = self.get_priority_categories()
        
        report = []
        report.append("=" * 60)
        report.append("COMPLAINT PRIORITIZATION SUMMARY REPORT")
        report.append("=" * 60)
        report.append("")
        
        # AHP Weights
        report.append("CRITERIA WEIGHTS:")
        report.append("-" * 60)
        for criterion, weight in zip(self.criteria, self.ahp.weights):
            report.append(f"  {criterion:.<40} {weight:.4f} ({weight*100:.1f}%)")
        report.append("")
        
        # Consistency
        report.append(f"Consistency Ratio: {self.ahp.consistency_ratio:.4f}")
        status = "[OK] ACCEPTABLE" if self.ahp.is_consistent() else "[X] NOT ACCEPTABLE"
        report.append(f"Consistency Status: {status}")
        report.append("")
        
        # Statistics
        report.append("PRIORITIZATION STATISTICS:")
        report.append("-" * 60)
        report.append(f"  Total Complaints: {len(self.prioritized_complaints)}")
        report.append(f"  Critical Priority: {len(categories['critical'])}")
        report.append(f"  High Priority: {len(categories['high'])}")
        report.append(f"  Medium Priority: {len(categories['medium'])}")
        report.append(f"  Low Priority: {len(categories['low'])}")
        report.append("")
        
        # Top 5 complaints
        report.append("TOP 5 PRIORITY COMPLAINTS:")
        report.append("-" * 60)
        top5 = self.get_top_priorities(5)
        
        for idx, row in top5.iterrows():
            complaint_id = row.get('id', 'N/A')
            title = row.get('title', 'No title')[:40]
            score = row['priority_score']
            rank = int(row['priority_rank'])
            report.append(f"  #{rank} [{complaint_id}] {title}")
            report.append(f"      Priority Score: {score:.4f}")
        
        report.append("")
        report.append("=" * 60)
        
        return "\n".join(report)


if __name__ == "__main__":
    # Example usage
    print("Complaint Prioritization Engine - Example")
    print("=" * 50)
    
    # Initialize prioritizer
    prioritizer = ComplaintPrioritizer()
    
    # Load default weights
    print("\nLoading default criteria weights...")
    prioritizer.load_default_weights()
    
    print("\nCriteria Weights:")
    for criterion, weight in zip(prioritizer.criteria, prioritizer.ahp.weights):
        print(f"  {criterion}: {weight:.4f} ({weight*100:.1f}%)")
