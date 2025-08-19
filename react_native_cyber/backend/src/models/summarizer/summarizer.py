import requests
import os
import json
from image_to_text import extract_text_from_image
from pdf_to_text import extract_text_from_pdf

def get_incident_details_from_text(complaint_text, image_evidence_text, pdf_evidence_text, audio_evidence_text, text_from_video_audio, text_from_video_frames):
    """
    Uses the Groq API to extract key details into a structured JSON object.
    """
    # It is highly recommended to set the GROQ_API_KEY as an environment variable
    # for better security, but a fallback is provided.
    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        print("Warning: GROQ_API_KEY environment variable not set. Using a hardcoded key.")
        api_key = "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" # Replace if needed

    url = "https://api.groq.com/openai/v1/chat/completions"
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    departments = """
    Department for Promotion of Industry and Internal Trade (DPIIT)
    Department of Administrative Reforms and Public Grievances (DARPG)
    Department of Agricultural Research and Education (DARE)
    Department of Agriculture and Farmers Welfare (DoAFW)
    Department of Animal Husbandry and Dairying (DoAHD)
    Department of Biotechnology (DBT)
    Department of Border Management (DoBM)
    Department of Chemicals and Petro-Chemicals (DoCP)
    Department of Commerce (DoC)
    Department of Consumer Affairs (DoCA)
    Department of Defence (DoD)
    Department of Defence Production (DDP)
    Department of Defence Research and Development (DRDO)
    Department of Drinking Water and Sanitation (DDWS)
    Department of Economic Affairs (DEA)
    Department of Empowerment of Persons with Disabilities (DEPWD)
    Department of Ex-Servicemen Welfare (DESW)
    Department of Expenditure (DoE)
    Department of Fertilizers (DoFz)
    Department of Financial Services (DoFS)
    Department of Fisheries (DoF)
    Department of Food and Public Distribution (DFPD)
    Department of Health Research (DHR)
    Department of Health and Family Welfare (DoHFW)
    Department of Higher Education (DoHE)
    Department of Home (DoH)
    Department of Investment and Public Asset Management (DIPAM)
    Department of Justice (DoJ)
    Department of Land Resources (DLR)
    Department of Legal Affairs (DoLA)
    Department of Military Affairs (DMA)
    Department of Official Language (DoOL)
    Department of Pension & Pensioner's Welfare (DoPPW)
    Department of Personnel and Training (DoPT)
    Department of Pharmaceuticals (DoPs)
    Department of Posts (DoP)
    Department of Public Enterprises (DPE)
    Department of Revenue (DoR)
    Department of Rural Development (DoRD)
    Department of School Education and Literacy (DSEL)
    Department of Science and Technology (DST)
    Department of Scientific and Industrial Research (DSIR)
    Department of Social Justice and Empowerment (DoSJE)
    Department of Sports (DoS)
    Department of Telecommunications (DoT)
    Department of Water Resources, River Development and Ganga Rejuvenation (DoWRGR)
    Department of Youth Affairs (DoYA)
    Legislative Department (LD)
    """
    prompt = f"""
    You are an expert cybercrime analyst. Your task is to analyze the following complaint, cross-check it with the provided evidence, and extract key information into a clean JSON format.

    Complaint:
    "{complaint_text}"

    Image Evidence Text:
    "{image_evidence_text}"

    PDF Evidence Text:
    "{pdf_evidence_text}"

    Audio Evidence Text (if any):
    "{audio_evidence_text}"

    Video evidence:
    Video Audio Text (if any):
    "{text_from_video_audio}"
    Video Frame Text (if any):
    "{text_from_video_frames}"

    ---
    Based on the complaint, perform the following tasks.

    List of potential government departments:
    {departments}

    Instructions for filling the JSON:
    1.  "crime_type": Choose from: 'spam', 'phishing', 'smishing', 'malware', 'ransomware', 'data_breach', 'financial_fraud', 'corporate_espionage', 'cyber_terrorism', 'national_security_threat', 'threat_to_life'.
    2.  "financial_loss_inr": Estimate the financial loss in INR from the complaint. If no amount is mentioned, use 0. Ensure this is a number.
    3.  "is_ongoing": true if the attack is currently happening, otherwise false.
    4.  "victims_affected": State the number of people affected. Ensure this is a number.
    5.  "data_sensitivity": Choose from: 'none', 'personal', 'financial', 'medical', 'intellectual_property', 'classified'.
    6.  "target_type": Choose from: 'individual', 'organization', 'government'.
    7.  "evidence_match": Based on the evidence text, determine if it supports the complaint. Choose from: true, false, or "partial".
    8.  "relevant_department": From the list of government departments provided above, identify up to two of the most relevant departments for this complaint. The result must be a list of strings.

    Only output the raw JSON object. Do not include any other text or markdown formatting.
    """

    payload = {
        "model": "llama3-8b-8192",
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.1,
        "max_tokens": 512,
        "response_format": {"type": "json_object"},
    }

    try:
        response = requests.post(url, headers=headers, json=payload)
        response.raise_for_status()
        response_data = response.json()
        json_string = response_data["choices"][0]["message"]["content"]
        return json.loads(json_string)
    except Exception as e:
        print(f"An unexpected error occurred in get_incident_details_from_text: {e}")
        return None

def get_narrative_summary(complaint_text, image_evidence_text, pdf_evidence_text, audio_evidence_text, text_from_video_audio, text_from_video_frames):
    """
    Uses the Groq API to generate a human-readable summary of the incident.
    """
    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        api_key = "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" # Replace if needed

    url = "https://api.groq.com/openai/v1/chat/completions"
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}

    prompt = f"""
    You are a cybercrime analyst. Based on the complaint and evidence below, write a concise, human-readable narrative summary of the incident in 2-4 clear sentences.
    Focus on the main events, the impact, and whether the evidence supports the claim.
    Also provide one line summary.
    Complaint:
    "{complaint_text}"

    Image Evidence Text (if any):
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
    Provide the summary in plain text.
    """

    payload = {
        "model": "llama3-8b-8192",
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.3,
        "max_tokens": 512,
    }

    try:
        response = requests.post(url, headers=headers, json=payload)
        response.raise_for_status()
        response_data = response.json()
        return response_data["choices"][0]["message"]["content"]
    except Exception as e:
        print(f"An unexpected error occurred in get_narrative_summary: {e}")
        return "Error: Could not generate narrative summary."

# --- Main Execution Block ---
if __name__ == "__main__":
    # Define paths to your evidence files.
    # NOTE: Replace with your actual file paths.
    image_evidence_path = "1.jpg"
    pdf_evidence_path = "evidence.pdf"

    # Define the user's complaint text.
    complaint = """
    Money from my account, amount: 40rs was unknownly tranfered from myy upi to someone named Swarad.
    """

    print("--- Step 1: Processing Cybercrime Complaint ---")
    print(f"Complaint Text:\n{complaint}")

    # --- Extract text from evidence files ---
    print("\n--- Step 2: Extracting Text from Evidence Files ---")
    image_text = extract_text_from_image(image_evidence_path)
    pdf_text = extract_text_from_pdf(pdf_evidence_path)
    print(f"Text from '{image_evidence_path}' processed.")
    print(f"Text from '{pdf_evidence_path}' processed.")

    # --- Generate Structured JSON Output ---
    print("\n--- Step 3: Generating Structured JSON Details ---")
    incident_details = get_incident_details_from_text(complaint, image_text, pdf_text)

    if incident_details:
        # Print the formatted JSON
        print(json.dumps(incident_details, indent=2))
    else:
        print("Could not retrieve structured incident details.")

    # --- Generate Narrative Summary ---
    print("\n--- Step 4: Generating Narrative Summary ---")
    summary = get_narrative_summary(complaint, image_text, pdf_text)
    print(summary)