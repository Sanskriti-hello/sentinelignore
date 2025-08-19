import requests
import json
import os
from image_to_text import extract_text_from_image
from pdf_to_text import extract_text_from_pdf


def contradiction_in_complain_and_evidences(complaint_text, image_evidence_text, pdf_evidence_text, audio_evidence_text, text_from_video_audio, text_from_video_frames):
    """
    Analyzes the complaint against the evidence to find contradictions.

    Returns:
        tuple: A tuple containing the detailed JSON analysis (dict) and a
               boolean indicating if a contradiction was found (True/False).
               Returns (None, False) on error.
    """
    api_key = os.environ.get("GROQ_API_KEY", "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")
    if not api_key or api_key == "YOUR_GROQ_API_KEY":
        print("Error: Please replace 'YOUR_GROQ_API_KEY' with your actual Groq API key.")
        return None, False

    url = "https://api.groq.com/openai/v1/chat/completions"
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}

    prompt = f"""
    You are a meticulous cybercrime evidence analyst. Your task is to compare the user's complaint against the text extracted from image and PDF evidence. Identify key entities (like financial amounts, names, dates) and report if they match, partially match, or contradict.

    Complaint:
    "{complaint_text}"

    Image Evidence Text:
    "{image_evidence_text}"

    PDF Evidence Text (if any):
    "{pdf_evidence_text}"

    Audio Evidence Text (if any):
    "{audio_evidence_text}"

    Video evidence:
    Video Audio Text (if any):
    "{text_from_video_audio}"
    Video Frame Text (if any):
    "{text_from_video_frames}"

    ---
    Instructions:
    1.  Extract key entities from the complaint (e.g., amount, recipient name).
    2.  Search for the same entities in the provided evidence texts.
    3.  For each entity, compare the value from the complaint with the value from the evidence.
    4.  Produce a JSON object that details your findings. The JSON should have a key "contradiction_analysis".
    5.  Under this key, for each entity you analyze (e.g., "financial_amount_inr", "recipient_name"), provide the following:
        - "complaint_value": The value found in the complaint.
        - "evidence_value": The value found in the evidence. Use "Not Found" if it's missing.
        - "match_status": Can be "match", "contradiction", or "partial_match".
        - "summary": A brief, one-sentence explanation of your finding. Clearly state the contradiction if one exists.

    Your response MUST be only a valid JSON object and nothing else.
    """

    payload = {
        "model": "llama3-8b-8192",
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.1,
        "max_tokens": 1024,
        "response_format": {"type": "json_object"},
    }
    
    try:
        response = requests.post(url, headers=headers, json=payload)
        response.raise_for_status()
        response_data = response.json()
        json_string = response_data["choices"][0]["message"]["content"]
        
        # Parse the JSON response
        json_result = json.loads(json_string)
        
        # --- NEW LOGIC: Check for contradictions ---
        has_contradiction = False
        # Safely get the analysis dictionary
        analysis = json_result.get("contradiction_analysis", {})
        for entity_details in analysis.values():
            if entity_details.get("match_status") == "contradiction":
                has_contradiction = True
                break # Found a contradiction, no need to check further
        
        return json_result, has_contradiction

    except Exception as e:
        print(f"An unexpected error occurred in evidence function: {e}")
        return None, False
    
if __name__ == "__main__":
    # Example usage
    # In this example, the complaint says the recipient is "Swarad", but let's assume
    # the evidence (from OCR) will say "Swaraj". This creates a contradiction.
    complaint_text = "Money from my account, amount: 40rs was unknownly tranfered from myy upi to someone named Swarad."
    
    print("--- Step 1: Extracting text from evidence ---")
    image_evidence_text = extract_text_from_image("1.jpg")  
    pdf_evidence_text = extract_text_from_pdf("evidence.pdf") 
    print("Evidence text processed.")

    print("\n--- Step 2: Analyzing for contradictions ---")
    # The function now returns two values, so we unpack the tuple
    analysis_result, is_contradictory = contradiction_in_complain_and_evidences(complaint_text, image_evidence_text, pdf_evidence_text)
    
    # First, print the detailed JSON analysis
    print("\n--- Detailed Analysis (JSON) ---")
    if analysis_result:
        print(json.dumps(analysis_result, indent=2))
    else:
        print("No analysis result was returned.")
        
    # Second, print the simple True/False output
    print("\n--- Final Verdict ---")
    print(f"Does the evidence contradict the complaint? {is_contradictory}")