"""
AHP Core Algorithm Implementation
Analytic Hierarchy Process for Multi-Criteria Decision Making

This module implements the core AHP methodology including:
- Pairwise comparison matrix creation
- Eigenvector calculation for priority weights
- Consistency ratio validation
"""

import numpy as np
from typing import List, Dict, Tuple


class AHPCore:
    """
    Core AHP algorithm implementation for calculating priority weights
    from pairwise comparison matrices.
    """
    
    # Random Index (RI) values for consistency checking (Saaty, 1980)
    RANDOM_INDEX = {
        1: 0.00, 2: 0.00, 3: 0.58, 4: 0.90, 5: 1.12,
        6: 1.24, 7: 1.32, 8: 1.41, 9: 1.45, 10: 1.49
    }
    
    def __init__(self, criteria: List[str]):
        """
        Initialize AHP with criteria names.
        
        Args:
            criteria: List of criteria names for decision making
        """
        self.criteria = criteria
        self.n_criteria = len(criteria)
        self.comparison_matrix = None
        self.weights = None
        self.consistency_ratio = None
        
    def create_comparison_matrix(self, pairwise_values: Dict[Tuple[str, str], float]) -> np.ndarray:
        """
        Create pairwise comparison matrix from preference values.
        
        Args:
            pairwise_values: Dictionary with (criterion1, criterion2) as key
                           and comparison value as value (1-9 scale)
                           
        Returns:
            n x n comparison matrix
        """
        matrix = np.ones((self.n_criteria, self.n_criteria))
        
        for i, crit_i in enumerate(self.criteria):
            for j, crit_j in enumerate(self.criteria):
                if i < j:  # Upper triangle
                    key = (crit_i, crit_j)
                    if key in pairwise_values:
                        matrix[i][j] = pairwise_values[key]
                        matrix[j][i] = 1.0 / pairwise_values[key]  # Reciprocal
                        
        self.comparison_matrix = matrix
        return matrix
    
    def calculate_weights(self) -> np.ndarray:
        """
        Calculate priority weights using eigenvector method.
        
        Returns:
            Normalized priority weight vector
        """
        if self.comparison_matrix is None:
            raise ValueError("Comparison matrix not initialized. Call create_comparison_matrix first.")
        
        # Calculate eigenvalues and eigenvectors
        eigenvalues, eigenvectors = np.linalg.eig(self.comparison_matrix)
        
        # Get principal eigenvector (corresponding to max eigenvalue)
        max_eigenvalue_idx = np.argmax(eigenvalues)
        principal_eigenvector = np.real(eigenvectors[:, max_eigenvalue_idx])
        
        # Normalize to get weights (sum = 1)
        self.weights = principal_eigenvector / np.sum(principal_eigenvector)
        
        return self.weights
    
    def calculate_consistency_ratio(self) -> float:
        """
        Calculate Consistency Ratio (CR) to validate decision consistency.
        CR < 0.1 indicates acceptable consistency.
        
        Returns:
            Consistency Ratio (CR)
        """
        if self.comparison_matrix is None or self.weights is None:
            raise ValueError("Matrix and weights must be calculated first.")
        
        # Calculate lambda_max (maximum eigenvalue)
        eigenvalues = np.linalg.eigvals(self.comparison_matrix)
        lambda_max = np.max(np.real(eigenvalues))
        
        # Calculate Consistency Index (CI)
        ci = (lambda_max - self.n_criteria) / (self.n_criteria - 1)
        
        # Get Random Index (RI) for matrix size
        ri = self.RANDOM_INDEX.get(self.n_criteria, 1.49)
        
        # Calculate Consistency Ratio (CR)
        self.consistency_ratio = ci / ri if ri != 0 else 0
        
        return self.consistency_ratio
    
    def is_consistent(self, threshold: float = 0.1) -> bool:
        """
        Check if the comparison matrix is acceptably consistent.
        
        Args:
            threshold: Maximum acceptable CR value (default 0.1)
            
        Returns:
            True if CR < threshold, False otherwise
        """
        if self.consistency_ratio is None:
            self.calculate_consistency_ratio()
            
        return self.consistency_ratio < threshold
    
    def get_weighted_scores(self, alternatives_scores: Dict[str, np.ndarray]) -> Dict[str, float]:
        """
        Calculate final priority scores for alternatives using criteria weights.
        
        Args:
            alternatives_scores: Dictionary with alternative names as keys
                               and score vectors as values
                               
        Returns:
            Dictionary with alternative names and final priority scores
        """
        if self.weights is None:
            raise ValueError("Weights not calculated. Call calculate_weights first.")
        
        final_scores = {}
        for alternative, scores in alternatives_scores.items():
            final_scores[alternative] = np.dot(self.weights, scores)
            
        return final_scores
    
    def get_summary(self) -> Dict:
        """
        Get summary of AHP analysis.
        
        Returns:
            Dictionary with criteria weights, consistency ratio, and status
        """
        return {
            'criteria': self.criteria,
            'weights': self.weights.tolist() if self.weights is not None else None,
            'consistency_ratio': self.consistency_ratio,
            'is_consistent': self.is_consistent() if self.consistency_ratio is not None else None,
            'comparison_matrix': self.comparison_matrix.tolist() if self.comparison_matrix is not None else None
        }


def create_saaty_scale_comparison(value: float) -> str:
    """
    Convert numerical comparison to Saaty scale interpretation.
    
    Args:
        value: Numerical comparison value (1-9)
        
    Returns:
        Textual interpretation of the comparison
    """
    scale = {
        1: "Equal importance",
        2: "Weak or slight",
        3: "Moderate importance",
        4: "Moderate plus",
        5: "Strong importance",
        6: "Strong plus",
        7: "Very strong importance",
        8: "Very, very strong",
        9: "Extreme importance"
    }
    
    rounded_value = round(value)
    return scale.get(rounded_value, "Unknown")


if __name__ == "__main__":
    # Example usage
    criteria = ["Public Safety", "Impact Scale", "Urgency", "Resources", "Capacity"]
    
    # Create AHP instance
    ahp = AHPCore(criteria)
    
    # Example pairwise comparisons (values from 1-9)
    # Higher value means first criterion is more important
    comparisons = {
        ("Public Safety", "Impact Scale"): 3,  # Safety moderately more important
        ("Public Safety", "Urgency"): 2,
        ("Public Safety", "Resources"): 5,
        ("Public Safety", "Capacity"): 4,
        ("Impact Scale", "Urgency"): 1,  # Equal importance
        ("Impact Scale", "Resources"): 3,
        ("Impact Scale", "Capacity"): 2,
        ("Urgency", "Resources"): 3,
        ("Urgency", "Capacity"): 2,
        ("Resources", "Capacity"): 1
    }
    
    # Create comparison matrix
    matrix = ahp.create_comparison_matrix(comparisons)
    print("Pairwise Comparison Matrix:")
    print(matrix)
    print()
    
    # Calculate weights
    weights = ahp.calculate_weights()
    print("Criteria Weights:")
    for criterion, weight in zip(criteria, weights):
        print(f"{criterion}: {weight:.4f} ({weight*100:.2f}%)")
    print()
    
    # Check consistency
    cr = ahp.calculate_consistency_ratio()
    print(f"Consistency Ratio: {cr:.4f}")
    print(f"Consistency Status: {'Acceptable' if ahp.is_consistent() else 'Not Acceptable'}")
    print(f"(CR < 0.1 is acceptable)")
