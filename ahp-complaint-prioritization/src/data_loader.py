"""
Data Loader Module
Handles data integration with existing complaint management system
"""

import pandas as pd
import numpy as np
from typing import List, Dict, Optional
from datetime import datetime


class ComplaintDataLoader:
    """
    Loads and processes complaint data for AHP prioritization.
    """
    
    def __init__(self):
        self.complaints_df = None
        
    def load_from_csv(self, filepath: str) -> pd.DataFrame:
        """
        Load complaint data from CSV file.
        
        Args:
            filepath: Path to CSV file
            
        Returns:
            DataFrame with complaint data
        """
        self.complaints_df = pd.read_csv(filepath)
        return self.complaints_df
    
    def load_from_supabase(self, supabase_client, filters: Optional[Dict] = None) -> pd.DataFrame:
        """
        Load complaint data from Supabase database.
        
        Args:
            supabase_client: Initialized Supabase client
            filters: Optional dictionary of filters (e.g., {'status': 'pending'})
            
        Returns:
            DataFrame with complaint data
        """
        # Build query
        query = supabase_client.table('complaints').select('*')
        
        # Apply filters if provided
        if filters:
            for key, value in filters.items():
                query = query.eq(key, value)
        
        # Execute query
        response = query.execute()
        
        # Convert to DataFrame
        self.complaints_df = pd.DataFrame(response.data)
        return self.complaints_df
    
    def normalize_criteria_scores(self, criteria_columns: List[str]) -> pd.DataFrame:
        """
        Normalize criteria scores to 0-1 scale.
        
        Args:
            criteria_columns: List of column names containing criteria scores
            
        Returns:
            DataFrame with normalized scores
        """
        if self.complaints_df is None:
            raise ValueError("No data loaded. Call load_from_csv or load_from_supabase first.")
        
        df_normalized = self.complaints_df.copy()
        
        for col in criteria_columns:
            if col in df_normalized.columns:
                min_val = df_normalized[col].min()
                max_val = df_normalized[col].max()
                
                if max_val > min_val:
                    df_normalized[col] = (df_normalized[col] - min_val) / (max_val - min_val)
                else:
                    df_normalized[col] = 0.5  # Default if all values are same
        
        return df_normalized
    
    def calculate_safety_score(self, complaint_type: str, severity: str) -> float:
        """
        Calculate public safety risk score based on complaint type and severity.
        
        Args:
            complaint_type: Type of complaint
            severity: Severity level
            
        Returns:
            Safety score (0-1)
        """
        # Define risk levels for different complaint types
        high_risk_types = ['gas_leak', 'electrical_hazard', 'building_collapse', 'fire_hazard']
        medium_risk_types = ['water_contamination', 'broken_traffic_light', 'pothole']
        low_risk_types = ['noise_complaint', 'graffiti', 'littering']
        
        severity_multiplier = {
            'critical': 1.0,
            'high': 0.8,
            'medium': 0.5,
            'low': 0.2
        }
        
        # Calculate base score
        if complaint_type.lower() in high_risk_types:
            base_score = 0.9
        elif complaint_type.lower() in medium_risk_types:
            base_score = 0.6
        elif complaint_type.lower() in low_risk_types:
            base_score = 0.3
        else:
            base_score = 0.5  # Default for unknown types
        
        # Apply severity multiplier
        multiplier = severity_multiplier.get(severity.lower(), 0.5)
        
        return min(base_score * multiplier, 1.0)
    
    def calculate_impact_score(self, affected_people: int) -> float:
        """
        Calculate impact score based on number of affected people.
        
        Args:
            affected_people: Number of people affected
            
        Returns:
            Impact score (0-1)
        """
        # Logarithmic scale for impact
        if affected_people <= 0:
            return 0.0
        elif affected_people <= 10:
            return 0.2
        elif affected_people <= 50:
            return 0.4
        elif affected_people <= 100:
            return 0.6
        elif affected_people <= 500:
            return 0.8
        else:
            return 1.0
    
    def calculate_urgency_score(self, created_date: str, deadline_hours: Optional[int] = None) -> float:
        """
        Calculate urgency score based on time elapsed and deadline.
        
        Args:
            created_date: Complaint creation date (ISO format)
            deadline_hours: Optional deadline in hours
            
        Returns:
            Urgency score (0-1)
        """
        try:
            created = datetime.fromisoformat(created_date.replace('Z', '+00:00'))
            now = datetime.now(created.tzinfo)
            hours_elapsed = (now - created).total_seconds() / 3600
            
            if deadline_hours:
                # Score based on deadline proximity
                time_ratio = hours_elapsed / deadline_hours
                return min(time_ratio, 1.0)
            else:
                # Score based on age of complaint
                if hours_elapsed < 24:
                    return 0.9  # Very urgent
                elif hours_elapsed < 72:
                    return 0.7
                elif hours_elapsed < 168:  # 1 week
                    return 0.5
                else:
                    return max(0.3, 1.0 - (hours_elapsed / (30 * 24)))  # Decay over month
        except Exception as e:
            print(f"Error calculating urgency: {e}")
            return 0.5
    
    def calculate_resource_score(self, estimated_cost: float, complexity: str) -> float:
        """
        Calculate resource requirement score (inverse - lower is better).
        
        Args:
            estimated_cost: Estimated cost to resolve
            complexity: Complexity level (low/medium/high)
            
        Returns:
            Resource score (0-1, inverted so higher is less resources)
        """
        complexity_factor = {
            'low': 0.8,
            'medium': 0.5,
            'high': 0.2
        }
        
        # Normalize cost (inverse relationship)
        cost_score = max(0, 1.0 - min(estimated_cost / 10000, 1.0))
        
        # Combine with complexity
        complexity_score = complexity_factor.get(complexity.lower(), 0.5)
        
        return (cost_score + complexity_score) / 2
    
    def calculate_capacity_score(self, department: str, current_load: int) -> float:
        """
        Calculate department capacity score.
        
        Args:
            department: Department name
            current_load: Current number of active complaints
            
        Returns:
            Capacity score (0-1, higher means more capacity)
        """
        # Inverse relationship - more load = less capacity
        if current_load <= 5:
            return 1.0
        elif current_load <= 10:
            return 0.8
        elif current_load <= 20:
            return 0.6
        elif current_load <= 30:
            return 0.4
        else:
            return 0.2
    
    def enrich_complaint_data(self) -> pd.DataFrame:
        """
        Enrich complaint data with calculated AHP criteria scores.
        
        Returns:
            DataFrame with added criteria score columns
        """
        if self.complaints_df is None:
            raise ValueError("No data loaded.")
        
        df = self.complaints_df.copy()
        
        # Calculate scores for each criterion
        if 'type' in df.columns and 'severity' in df.columns:
            df['safety_score'] = df.apply(
                lambda row: self.calculate_safety_score(row['type'], row.get('severity', 'medium')),
                axis=1
            )
        
        if 'affected_people' in df.columns:
            df['impact_score'] = df['affected_people'].apply(self.calculate_impact_score)
        
        if 'created_at' in df.columns:
            df['urgency_score'] = df['created_at'].apply(self.calculate_urgency_score)
        
        if 'estimated_cost' in df.columns and 'complexity' in df.columns:
            df['resource_score'] = df.apply(
                lambda row: self.calculate_resource_score(row['estimated_cost'], row['complexity']),
                axis=1
            )
        
        if 'department' in df.columns and 'department_load' in df.columns:
            df['capacity_score'] = df.apply(
                lambda row: self.calculate_capacity_score(row['department'], row['department_load']),
                axis=1
            )
        
        return df
    
    def get_criteria_matrix(self) -> np.ndarray:
        """
        Get criteria scores as numpy matrix for AHP processing.
        
        Returns:
            Matrix of shape (n_complaints, n_criteria)
        """
        criteria_cols = ['safety_score', 'impact_score', 'urgency_score', 
                        'resource_score', 'capacity_score']
        
        if self.complaints_df is None:
            raise ValueError("No data loaded.")
        
        # Check which criteria columns exist
        available_cols = [col for col in criteria_cols if col in self.complaints_df.columns]
        
        if not available_cols:
            raise ValueError("No criteria score columns found. Run enrich_complaint_data first.")
        
        return self.complaints_df[available_cols].values


if __name__ == "__main__":
    # Example usage
    loader = ComplaintDataLoader()
    
    # Test with sample data
    print("Testing safety score calculation:")
    print(f"Gas leak (critical): {loader.calculate_safety_score('gas_leak', 'critical')}")
    print(f"Noise complaint (low): {loader.calculate_safety_score('noise_complaint', 'low')}")
    
    print("\nTesting impact score calculation:")
    print(f"5 people affected: {loader.calculate_impact_score(5)}")
    print(f"200 people affected: {loader.calculate_impact_score(200)}")
