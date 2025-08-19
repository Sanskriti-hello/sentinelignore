# classifier.py

import math
from summarizer import get_incident_details_from_text
## -----------------------------------------------------------------------------
## 1. CONFIGURATION CONSTANTS
## -----------------------------------------------------------------------------

PRIORITY_LEVELS = {1: "Very Low", 2: "Low", 3: "Medium", 4: "High", 5: "Very High"}

FINANCIAL_THRESHOLDS = {
    500: 1, 5000: 2, 25000: 3, 100000: 4, float('inf'): 5
}

VOLUME_THRESHOLDS = {
    1: 1, 50: 2, 1000: 3, 50000: 4, float('inf'): 5
}

## -----------------------------------------------------------------------------
## 2. CYBERCRIME DEFINITIONS (using snake_case for LLM compatibility)
## -----------------------------------------------------------------------------

CRIME_CATEGORIES = {
    # Generic catch-all types
    'financial_fraud': 'Financial',
    'spam': 'Volume',
    'phishing': 'Volume',
    'smishing': 'Volume',
    'data_breach': 'Hybrid',
    'ransomware': 'Hybrid',
    'cyber_terrorism': 'Severity',
    'national_security_threat': 'Severity',
    'threat_to_life': 'Severity',
    
    # More specific types
    'online_shopping_fraud': 'Financial',
    'credit_debit_card_fraud': 'Financial',
    'upi_fraud': 'Financial',
    'investment_scam': 'Financial',
    'corporate_espionage': 'Hybrid'
}

CRIME_SEVERITY_WEIGHTS = {
    'spam': 2, 'phishing': 4, 'smishing': 4,
    'online_shopping_fraud': 5, 'upi_fraud': 5, 'financial_fraud': 5,
    'credit_debit_card_fraud': 6, 'investment_scam': 7,
    'corporate_espionage': 8, 'data_breach': 8, 'ransomware': 9,
    'threat_to_life': 10, 'cyber_terrorism': 10, 'national_security_threat': 10
}

## -----------------------------------------------------------------------------
## 3. HELPER & CORE LOGIC FUNCTIONS (Largely unchanged)
## -----------------------------------------------------------------------------

def _get_score_from_thresholds(value, thresholds):
    """Finds the appropriate score for a value from a threshold dictionary."""
    for limit, score in sorted(thresholds.items()):
        if value <= limit:
            return score
    return 1

def _map_score_to_priority(score, is_ongoing=False):
    """Maps a final numeric score (1-5) back to a priority string."""
    # Clamp the score between 1 and 5 before rounding.
    final_score = max(1, min(5, round(score)))
    priority_text = PRIORITY_LEVELS[final_score]
    
    # Add a suffix for urgent, ongoing incidents
    if is_ongoing and final_score >= 3: # Add urgency for Medium priority and above
        priority_text += " (Ongoing)"
        
    return priority_text

def get_single_crime_score(crime_type, financial_loss=0, people_affected=1):
    """Calculates the priority score (1-5) for a single type of cybercrime."""
    category = CRIME_CATEGORIES.get(crime_type)
    if not category:
        print(f"Warning: Crime type '{crime_type}' is not defined. Defaulting to Medium.")
        return 3

    if category == 'Financial':
        return _get_score_from_thresholds(financial_loss, FINANCIAL_THRESHOLDS)
    if category == 'Volume':
        return _get_score_from_thresholds(people_affected, VOLUME_THRESHOLDS)
    if category == 'Severity':
        return 4 if crime_type == 'threat_to_life' else 5
    if category == 'Hybrid':
        financial_score = _get_score_from_thresholds(financial_loss, FINANCIAL_THRESHOLDS)
        volume_score = _get_score_from_thresholds(people_affected, VOLUME_THRESHOLDS)
        return max(financial_score, volume_score)
    return 1

## -----------------------------------------------------------------------------
## 4. MAIN CLASSIFIER FUNCTION (Refactored for dictionary input)
## -----------------------------------------------------------------------------

def classify_cybercrime(details_dict):
    """
    Classifies a cybercrime incident from a details dictionary and assigns a priority.

    Args:
        details_dict (dict): A dictionary containing the incident details.
            Expected keys: "crime_type", "financial_loss_inr", "victims_affected", "is_ongoing".

    Returns:
        tuple: A tuple containing the priority level (str) and the calculated score (float).
    """
    # Extract details from the dictionary with safe defaults
    crime_type_input = details_dict.get("crime_type", [])
    financial_loss = details_dict.get("financial_loss_inr", 0)
    people_affected = details_dict.get("victims_affected", 1)
    is_ongoing = details_dict.get("is_ongoing", False)

    # Normalize crime_type to be a list
    if isinstance(crime_type_input, str):
        crime_types = [crime_type_input]
    elif isinstance(crime_type_input, list):
        crime_types = crime_type_input
    else:
        return "Invalid crime_type format", 0

    if not crime_types:
        return "No crime specified", 0

    # --- Calculate base score ---
    base_score = 0
    if len(crime_types) == 1:
        base_score = get_single_crime_score(crime_types[0], financial_loss, people_affected)
    else: # Mixed Crime Incident
        total_weighted_score, total_weight, highest_individual_score = 0, 0, 0
        for crime in crime_types:
            score = get_single_crime_score(crime, financial_loss, people_affected)
            weight = CRIME_SEVERITY_WEIGHTS.get(crime, 3)
            total_weighted_score += score * weight
            total_weight += weight
            highest_individual_score = max(highest_individual_score, score)
        
        weighted_average_score = total_weighted_score / total_weight if total_weight > 0 else 0
        base_score = max(highest_individual_score, weighted_average_score)

    # --- Apply Contextual Boosts ---
    final_score = base_score
    if is_ongoing:
        # An active, ongoing incident requires higher priority.
        final_score += 0.5 

    # Other potential boosts could be added here based on "data_sensitivity", "target_type", etc.

    # --- Finalize and return ---
    priority = _map_score_to_priority(final_score, is_ongoing)
    # Ensure the returned score is capped at 5 for consistency
    final_score_capped = min(5.0, final_score)
    
    return priority, final_score_capped


## -----------------------------------------------------------------------------
## 5. EXAMPLE USAGE (Updated for new dictionary input)
## -----------------------------------------------------------------------------
if __name__ == "__main__":
    print("--- Cybercrime Priority Classification Examples ---")

    # Example 1: The original problem - small financial fraud.
    incident1 = {
        "crime_type": "financial_fraud",
        "financial_loss_inr": 40,
        "is_ongoing": False,
        "victims_affected": 1
    }
    priority, score = classify_cybercrime(incident1)
    print(f"\nIncident: Small, completed financial fraud")
    print(f"  -> Priority: {priority}, Score: {score:.2f}")

    # Example 2: Large-scale, ongoing phishing attack.
    incident2 = {
        "crime_type": "phishing",
        "financial_loss_inr": 5000,
        "is_ongoing": True,
        "victims_affected": 1500
    }
    priority, score = classify_cybercrime(incident2)
    print(f"\nIncident: Large-scale, ONGOING phishing campaign")
    print(f"  -> Priority: {priority}, Score: {score:.2f}")

    # Example 3: Severe threat.
    incident3 = {"crime_type": "national_security_threat"}
    priority, score = classify_cybercrime(incident3)
    print(f"\nIncident: National Security Threat")
    print(f"  -> Priority: {priority}, Score: {score:.2f}")

    # Example 4: A mixed incident (Phishing + Ransomware).
    incident4 = {
        "crime_type": ["phishing", "ransomware"],
        "financial_loss_inr": 200000,
        "is_ongoing": False,
        "victims_affected": 500
    }
    priority, score = classify_cybercrime(incident4)
    print(f"\nIncident: Phishing leading to Ransomware")
    print(f"  -> Priority: {priority}, Score: {score:.2f}")

    incident5 = {
  "crime_type": "financial_fraud",
  "financial_loss_inr": 40,
  "is_ongoing": False,
  "victims_affected": 1,
  "data_sensitivity": "financial",
  "target_type": "individual",
  "evidence_match": True,
  "relevant_department": [
    "Department of Financial Services (DoFS)",
    "Department of Telecommunications (DoT)"
  ]
}
    priority, score = classify_cybercrime(incident5)
    print(f"  -> Priority: {priority}, Score: {score:.2f}")