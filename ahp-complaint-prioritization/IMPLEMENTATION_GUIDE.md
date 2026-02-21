# Implementation Guide
## AHP-Based Complaint Prioritization System

### Overview
This guide will help you understand and implement the AHP complaint prioritization system for your SDSS project.

---

## Table of Contents
1. [Understanding AHP](#understanding-ahp)
2. [System Architecture](#system-architecture)
3. [Implementation Steps](#implementation-steps)
4. [Customization Guide](#customization-guide)
5. [Integration with Existing System](#integration)
6. [Presentation Tips](#presentation-tips)

---

## Understanding AHP

### What is AHP?
The Analytic Hierarchy Process (AHP) is a structured technique for organizing and analyzing complex decisions, developed by Thomas L. Saaty in the 1970s.

### How It Works
1. **Define Criteria**: Identify factors that influence decision-making
2. **Pairwise Comparisons**: Compare criteria against each other
3. **Calculate Weights**: Use mathematical operations to derive importance
4. **Validate Consistency**: Ensure logical comparisons (CR < 0.1)
5. **Synthesize Results**: Apply weights to alternatives

### Saaty's 1-9 Scale
- **1**: Equal importance
- **3**: Moderate importance
- **5**: Strong importance  
- **7**: Very strong importance
- **9**: Extreme importance
- **2, 4, 6, 8**: Intermediate values

---

## System Architecture

### Module Structure
```
ahp-complaint-prioritization/
│
├── src/                          # Source code
│   ├── ahp_core.py              # Core AHP algorithm
│   │   └── AHPCore class
│   │       ├── create_comparison_matrix()
│   │       ├── calculate_weights()
│   │       └── calculate_consistency_ratio()
│   │
│   ├── data_loader.py           # Data integration
│   │   └── ComplaintDataLoader class
│   │       ├── load_from_csv()
│   │       ├── load_from_supabase()
│   │       └── enrich_complaint_data()
│   │
│   ├── prioritizer.py           # Main prioritization engine
│   │   └── ComplaintPrioritizer class
│   │       ├── set_criteria_weights()
│   │       ├── prioritize_complaints()
│   │       └── export_results()
│   │
│   └── visualizer.py            # Visualization module
│       └── PrioritizationVisualizer class
│           ├── plot_criteria_weights()
│           ├── plot_priority_distribution()
│           └── plot_priority_by_category()
│
├── data/                         # Input/output data
├── config/                       # Configuration files
├── tests/                        # Test cases
└── main.py                       # Application entry point
```

---

## Implementation Steps

### Step 1: Environment Setup
```bash
# Create Python virtual environment (recommended)
python -m venv venv

# Activate virtual environment
# Windows:
venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### Step 2: Understanding the Core Algorithm

#### Key Mathematical Operations

**1. Eigenvector Calculation**
```python
# This calculates the principal eigenvector
eigenvalues, eigenvectors = np.linalg.eig(comparison_matrix)
max_idx = np.argmax(eigenvalues)
weights = eigenvectors[:, max_idx]
weights = weights / np.sum(weights)  # Normalize
```

**2. Consistency Ratio**
```python
# Calculate lambda_max
lambda_max = np.max(np.linalg.eigvals(matrix))

# Consistency Index
CI = (lambda_max - n) / (n - 1)

# Consistency Ratio
CR = CI / RI[n]
```

### Step 3: Running Basic Examples

#### Example 1: Test Core Algorithm
```bash
python src/ahp_core.py
```

This will show:
- Pairwise comparison matrix
- Calculated criteria weights
- Consistency ratio validation

#### Example 2: Test with Sample Data
```bash
python main.py --input data/sample_complaints.csv
```

### Step 4: Generating Visualizations
```bash
python main.py --input data/sample_complaints.csv --visualize
```

This creates:
- Criteria weights bar chart
- Priority score distribution
- Category-wise priorities
- Priority level pie chart
- Criteria heatmap

---

## Customization Guide

### 1. Adjusting Criteria Weights

Edit `config/criteria_weights.json` to change pairwise comparisons:

```json
{
  "pairwise_comparisons": {
    "your_scenario": {
      "Public Safety Risk vs Scale of Impact": 5,
      "Public Safety Risk vs Urgency Level": 3,
      ...
    }
  }
}
```

### 2. Adding New Criteria

In `prioritizer.py`, modify:
```python
DEFAULT_CRITERIA = [
    "Public Safety Risk",
    "Scale of Impact",
    "Urgency Level",
    "Resource Requirements",
    "Department Capacity",
    "Your New Criterion"  # Add here
]
```

Then update `data_loader.py` to calculate scores for the new criterion.

### 3. Custom Scoring Functions

Add new scoring methods in `data_loader.py`:
```python
def calculate_your_criterion_score(self, params):
    """
    Calculate score for your custom criterion.
    
    Returns:
        Score between 0 and 1
    """
    # Your calculation logic
    return score
```

---

## Integration with Existing System

### Option 1: Standalone Analysis
Run periodically to reprioritize existing complaints:
```python
# Load from database
complaints = fetch_from_supabase()

# Prioritize
prioritizer.prioritize_complaints(complaints)

# Export results
prioritizer.export_results('results.csv')
```

### Option 2: Real-time Integration
Add to complaint submission workflow:
```python
# When new complaint submitted
new_complaint = process_complaint(complaint_data)

# Calculate AHP scores
scores = data_loader.enrich_complaint_data([new_complaint])
priority = prioritizer.calculate_priority(scores)

# Update in database
update_complaint_priority(complaint_id, priority)
```

### Option 3: API Endpoint
Create FastAPI endpoint:
```python
@app.post("/prioritize")
async def prioritize_complaint(complaint: ComplaintModel):
    priority_score = prioritizer.calculate_priority(complaint)
    return {"priority_score": priority_score}
```

---

## Presentation Tips for Your Project

### 1. Problem Statement (2 minutes)
- Show real examples of mismanaged complaints
- Explain impact on citizens and resources
- Highlight need for systematic approach

### 2. AHP Methodology (3 minutes)
- Explain Saaty's scale with examples
- Show pairwise comparison matrix
- Demonstrate eigenvector calculation
- Explain consistency checking

### 3. Implementation Demo (5 minutes)
- Run main.py with sample data
- Show top priority complaints
- Display visualizations:
  * Criteria weights chart
  * Priority distribution
  * Heatmap of top complaints
- Explain consistency ratio results

### 4. Results Analysis (3 minutes)
- Compare priorities: before vs after AHP
- Show how critical safety issues rank higher
- Demonstrate efficiency gains
- Present statistics from summary report

### 5. Innovation & Impact (2 minutes)
- Scientific decision-making
- Scalable solution
- Integration possibilities
- Future enhancements

### Demo Script
```bash
# 1. Show criteria weights
python src/ahp_core.py

# 2. Prioritize complaints
python main.py --input data/sample_complaints.csv --top-n 5

# 3. Generate visualizations
python main.py --input data/sample_complaints.csv --visualize

# 4. Show summary report
type reports\summary_report.txt
```

---

## Mathematical Foundations

### Eigenvector Method
The priority weights are derived from the principal eigenvector of the comparison matrix:

```
A * w = λ_max * w
```

Where:
- A = comparison matrix
- w = weight vector (eigenvector)
- λ_max = maximum eigenvalue

### Consistency Index
```
CI = (λ_max - n) / (n - 1)
```

### Consistency Ratio
```
CR = CI / RI
```

Where RI (Random Index) depends on matrix size:
- n=3: RI=0.58
- n=4: RI=0.90
- n=5: RI=1.12

**CR < 0.1** indicates acceptable consistency

---

## Testing Your Implementation

### Run Test Suite
```bash
pytest tests/ -v
```

### Manual Validation
1. Check that weights sum to 1.0
2. Verify consistency ratio < 0.1
3. Ensure priority scores between 0 and 1
4. Validate top priorities make logical sense

---

## Troubleshooting

### Common Issues

**1. Inconsistent Comparisons (CR > 0.1)**
- Review your pairwise values
- Ensure transitivity: if A>B and B>C, then A>C
- Adjust extreme values (avoid 9s unless necessary)

**2. Import Errors**
```bash
pip install -r requirements.txt
```

**3. Missing Data Columns**
- Check CSV header matches expected columns
- Update data_loader.py to handle your data format

---

## Report Writing Tips

### Structure Your Report
1. **Introduction**
   - Problem context
   - Research objective

2. **Literature Review**
   - AHP methodology
   - Applications in municipal management

3. **Methodology**
   - Criteria selection justification
   - Pairwise comparison rationale
   - Algorithm implementation

4. **Results**
   - Criteria weights
   - Sample prioritization
   - Consistency validation
   - Visualizations

5. **Discussion**
   - Interpretation of results
   - Comparison with manual prioritization
   - Limitations

6. **Conclusion**
   - Summary of findings
   - Practical implications
   - Future work

---

## Additional Resources

### References
1. Saaty, T.L. (1980). *The Analytic Hierarchy Process*. McGraw-Hill.
2. Saaty, T.L. (2008). "Decision making with the analytic hierarchy process"
3. Triantaphyllou, E. (2000). *Multi-Criteria Decision Making Methods*

### Further Reading
- AHP Calculator Tools
- Multi-Criteria Decision Analysis
- Operations Research in Public Administration

---

## Contact & Support

For questions about this implementation:
- Review code comments in each module
- Check test cases for usage examples
- Refer to main.py for complete workflow

**Project Authors:**
- Saif ullah Yar khan
- Abdul Rehman Nadeem

**Course:** SDSS  
**Instructor:** Misbah Rani

---

Good luck with your project presentation! 🎓
