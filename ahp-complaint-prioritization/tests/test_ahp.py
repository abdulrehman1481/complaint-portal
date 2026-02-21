"""
Test Suite for AHP Core Algorithm
"""

import pytest
import numpy as np
import sys
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent / 'src'))

from src.ahp_core import AHPCore, create_saaty_scale_comparison


class TestAHPCore:
    """Test cases for AHP core algorithm."""
    
    def test_initialization(self):
        """Test AHP initialization."""
        criteria = ["A", "B", "C"]
        ahp = AHPCore(criteria)
        
        assert ahp.criteria == criteria
        assert ahp.n_criteria == 3
        assert ahp.comparison_matrix is None
        assert ahp.weights is None
    
    def test_comparison_matrix_creation(self):
        """Test pairwise comparison matrix creation."""
        criteria = ["A", "B", "C"]
        ahp = AHPCore(criteria)
        
        comparisons = {
            ("A", "B"): 3,
            ("A", "C"): 5,
            ("B", "C"): 2
        }
        
        matrix = ahp.create_comparison_matrix(comparisons)
        
        # Check diagonal is all ones
        assert np.allclose(np.diag(matrix), np.ones(3))
        
        # Check reciprocals
        assert np.isclose(matrix[0, 1], 3.0)
        assert np.isclose(matrix[1, 0], 1/3.0)
        assert np.isclose(matrix[0, 2], 5.0)
        assert np.isclose(matrix[2, 0], 1/5.0)
    
    def test_weight_calculation(self):
        """Test priority weight calculation."""
        criteria = ["A", "B", "C"]
        ahp = AHPCore(criteria)
        
        # Create simple comparison (A is most important)
        comparisons = {
            ("A", "B"): 5,
            ("A", "C"): 7,
            ("B", "C"): 3
        }
        
        ahp.create_comparison_matrix(comparisons)
        weights = ahp.calculate_weights()
        
        # Weights should sum to 1
        assert np.isclose(np.sum(weights), 1.0)
        
        # All weights should be positive
        assert np.all(weights > 0)
        
        # A should have highest weight
        assert weights[0] == np.max(weights)
    
    def test_consistency_ratio(self):
        """Test consistency ratio calculation."""
        criteria = ["A", "B", "C"]
        ahp = AHPCore(criteria)
        
        # Create perfectly consistent comparison
        comparisons = {
            ("A", "B"): 3,
            ("A", "C"): 9,  # 3 * 3
            ("B", "C"): 3
        }
        
        ahp.create_comparison_matrix(comparisons)
        ahp.calculate_weights()
        cr = ahp.calculate_consistency_ratio()
        
        # Perfectly consistent should have CR near 0
        assert cr < 0.1
    
    def test_is_consistent(self):
        """Test consistency checking."""
        criteria = ["A", "B", "C"]
        ahp = AHPCore(criteria)
        
        # Consistent comparison
        comparisons = {
            ("A", "B"): 2,
            ("A", "C"): 4,
            ("B", "C"): 2
        }
        
        ahp.create_comparison_matrix(comparisons)
        ahp.calculate_weights()
        ahp.calculate_consistency_ratio()
        
        assert ahp.is_consistent()
    
    def test_weighted_scores(self):
        """Test final score calculation."""
        criteria = ["A", "B", "C"]
        ahp = AHPCore(criteria)
        
        comparisons = {
            ("A", "B"): 3,
            ("A", "C"): 5,
            ("B", "C"): 2
        }
        
        ahp.create_comparison_matrix(comparisons)
        ahp.calculate_weights()
        
        # Alternative scores
        alternatives = {
            "Option1": np.array([0.8, 0.6, 0.4]),
            "Option2": np.array([0.5, 0.9, 0.7]),
            "Option3": np.array([0.3, 0.4, 0.9])
        }
        
        scores = ahp.get_weighted_scores(alternatives)
        
        # All scores should be between 0 and 1
        for score in scores.values():
            assert 0 <= score <= 1
    
    def test_summary(self):
        """Test summary generation."""
        criteria = ["A", "B", "C"]
        ahp = AHPCore(criteria)
        
        comparisons = {
            ("A", "B"): 3,
            ("A", "C"): 5,
            ("B", "C"): 2
        }
        
        ahp.create_comparison_matrix(comparisons)
        ahp.calculate_weights()
        ahp.calculate_consistency_ratio()
        
        summary = ahp.get_summary()
        
        assert 'criteria' in summary
        assert 'weights' in summary
        assert 'consistency_ratio' in summary
        assert 'is_consistent' in summary
        assert summary['criteria'] == criteria


class TestSaatyScale:
    """Test Saaty scale interpretation."""
    
    def test_scale_interpretation(self):
        """Test scale value interpretation."""
        assert create_saaty_scale_comparison(1) == "Equal importance"
        assert create_saaty_scale_comparison(3) == "Moderate importance"
        assert create_saaty_scale_comparison(5) == "Strong importance"
        assert create_saaty_scale_comparison(9) == "Extreme importance"
    
    def test_rounding(self):
        """Test rounding of scale values."""
        assert create_saaty_scale_comparison(2.7) == "Moderate importance"
        assert create_saaty_scale_comparison(5.2) == "Strong importance"


if __name__ == "__main__":
    # Run tests
    pytest.main([__file__, "-v"])
