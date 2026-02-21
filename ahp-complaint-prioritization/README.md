# AHP-Based Complaint Prioritization System

## Project Information
**Title:** Implementation of Analytic Hierarchy Process (AHP) for Civic Complaint Prioritization

**Team Members:**
- Saif ullah Yar khan
- Abdul Rehman Nadeem

**Course:** SDSS  
**Instructor:** Misbah Rani

## Overview
This project implements a Python-based Analytic Hierarchy Process (AHP) algorithm to intelligently prioritize civic complaints. The system assigns optimal weights to different complaint criteria and ranks complaints based on urgency and impact.

## Problem Statement
Municipal authorities face challenges in:
- Systematically prioritizing complaints based on multiple criteria
- Addressing critical public safety issues promptly
- Allocating limited resources efficiently
- Maintaining consistent complaint handling

## Solution
An AHP-based system that:
- Automatically calculates priority weights for complaint criteria
- Processes complaint data through pairwise comparisons
- Generates objective priority scores
- Ensures mathematical consistency in decision-making

## Project Structure
```
ahp-complaint-prioritization/
├── src/                    # Source code
│   ├── ahp_core.py        # Core AHP algorithm implementation
│   ├── data_loader.py     # Data integration with existing system
│   ├── prioritizer.py     # Complaint prioritization engine
│   └── visualizer.py      # Results visualization
├── data/                   # Input/output data
│   ├── sample_complaints.csv
│   └── prioritized_results.csv
├── config/                 # Configuration files
│   └── criteria_weights.json
├── tests/                  # Test cases
│   └── test_ahp.py
├── reports/                # Generated reports
│   └── consistency_report.txt
├── requirements.txt        # Python dependencies
├── main.py                # Main application entry point
└── README.md              # This file
```

## AHP Criteria
1. **Public Safety Risk** - Potential danger to human life or property
2. **Scale of Impact** - Number of people affected
3. **Urgency Level** - Time sensitivity of resolution
4. **Resource Requirements** - Cost and complexity to resolve
5. **Department Capacity** - Current workload and resources

## Installation

### Prerequisites
- Python 3.8 or higher
- pip package manager

### Setup
```bash
# Navigate to project directory
cd ahp-complaint-prioritization

# Install required packages
pip install -r requirements.txt
```

## Usage

### Basic Usage
```bash
# Run the AHP prioritization system
python main.py
```

### Using Sample Data
```bash
# Process sample complaints
python main.py --input data/sample_complaints.csv --output data/prioritized_results.csv
```

### Custom Criteria Weights
Edit `config/criteria_weights.json` to adjust pairwise comparison values for your specific needs.

## Technical Implementation

### AHP Methodology
1. **Pairwise Comparison Matrix**: Systematic comparison of all criteria pairs
2. **Eigenvector Calculation**: Mathematical derivation of criteria weights
3. **Consistency Validation**: Ensures logical decision-making (CR < 0.1)
4. **Priority Synthesis**: Calculates final scores for complaint ranking

### Technology Stack
- **Python 3.x**: Primary programming language
- **NumPy**: Matrix operations and calculations
- **Pandas**: Data handling and processing
- **Matplotlib/Seaborn**: Data visualization

## Expected Outcomes
- ✅ Objective, mathematical complaint ranking
- ✅ Consistent, bias-free decision-making
- ✅ Efficient resource allocation
- ✅ Transparent priority assignment process

## Testing
```bash
# Run test suite
python -m pytest tests/
```

## Example Output
```
Complaint Prioritization Results
================================
Complaint ID | Priority Score | Rank | Status
-------------|---------------|------|--------
C-1234       | 0.847         | 1    | Critical
C-5678       | 0.632         | 2    | High
C-9012       | 0.421         | 3    | Medium

Consistency Ratio: 0.067 (Acceptable)
```

## Integration with Existing System
This module can be integrated with the existing complaint management system by:
1. Fetching complaint data from Supabase
2. Processing through AHP algorithm
3. Updating priority scores in database
4. Triggering notifications for high-priority complaints

## Future Enhancements
- Real-time priority recalculation
- Machine learning for dynamic weight adjustment
- Web dashboard for AHP configuration
- API endpoints for system integration

## References
- Saaty, T.L. (1980). The Analytic Hierarchy Process
- Operations Research in Municipal Management
- Multi-Criteria Decision Making Techniques

## License
Academic Project - SDSS Course

## Contact
For questions or contributions, contact the project team members.
