import pandas as pd
from sklearn.metrics.pairwise import cosine_similarity
from sentence_transformers import SentenceTransformer
import csv
import os

print("Loading embedding model...")
model = SentenceTransformer('all-mpnet-base-v2')

# Expected schema
ALL_FIELDS = [
    'report_id', 'report_date', 'reporter_type', 'case_status',
    'phones', 'bank_accounts', 'upi_ids', 'emails', 'websites',
    'social_handles', 'ip_addresses', 'crypto_wallets',
    'institute', 'victim_location', 'scammer_claimed_location',
    'platforms', 'language_accent', 'scam_category',
    'description', 'profile_details', 'documents_shared_keywords',
    'payment_method', 'referrer_source', 'contact_methods'
]

# -------- CSV LOADING & CLEANING -------- #

def auto_clean_csv(filename, expected_columns):
    """Fix CSV so that every row has exactly `expected_columns` fields."""
    clean_name = f"{os.path.splitext(filename)[0]}_clean.csv"

    with open(filename, "r", encoding="utf-8", errors="ignore") as infile:
        reader = csv.reader(infile)
        rows = list(reader)

    fixed_rows = []
    for row in rows:
        if len(row) > expected_columns:
            # Merge extra data into last column (likely description)
            row = row[:expected_columns-1] + [",".join(row[expected_columns-1:])]
        elif len(row) < expected_columns:
            # Pad missing columns
            row += [""] * (expected_columns - len(row))
        fixed_rows.append(row)

    with open(clean_name, "w", encoding="utf-8", newline="") as outfile:
        writer = csv.writer(outfile, quoting=csv.QUOTE_ALL)
        writer.writerows(fixed_rows)

    print(f"[INFO] Cleaned CSV saved as {clean_name} with {expected_columns} columns each")
    return clean_name

def load_csv_safe(filename):
    """Try normal load, else clean and reload."""
    try:
        return pd.read_csv(filename, quotechar='"', skipinitialspace=True).fillna("")
    except pd.errors.ParserError:
        print(f"[WARNING] Parsing error in {filename}, attempting auto-clean...")
        clean_file = auto_clean_csv(filename, expected_columns=len(ALL_FIELDS))
        return pd.read_csv(clean_file, quotechar='"', skipinitialspace=True).fillna("")

# -------- NORMALIZATION FUNCTIONS -------- #

def normalize_phone(phone):
    return phone.replace("+91", "").replace("-", "").replace(" ", "").strip()

def normalize_email(email):
    return email.lower().strip()

def normalize_website(url):
    return url.lower().strip().replace("https://", "").replace("http://", "").replace("www.", "")

def normalize_field(x):
    return set(str(x).split('|')) if pd.notna(x) and str(x).strip() and str(x).lower() != 'nan' else set()

# -------- MATCHING LOGIC -------- #

def match_score(a, b):
    score = 0
    reasons = []

    strong_fields = ['phones', 'bank_accounts', 'upi_ids', 'emails', 'websites', 'social_handles', 'ip_addresses', 'crypto_wallets']
    for field in strong_fields:
        if set(a[field]) & set(b[field]):
            score += 0.7
            reasons.append(f"same {field}")

    medium_fields = ['institute', 'victim_location', 'scammer_claimed_location', 'platforms', 'contact_methods']
    for field in medium_fields:
        if isinstance(a[field], set) and isinstance(b[field], set):
            if a[field] & b[field]:
                score += 0.3
                reasons.append(f"same {field}")
        elif a[field] and b[field] and str(a[field]).lower() == str(b[field]).lower():
            score += 0.3
            reasons.append(f"same {field}")

    weak_fields = ['language_accent', 'scam_category', 'payment_method']
    for field in weak_fields:
        if a[field] and b[field] and str(a[field]).lower() == str(b[field]).lower():
            score += 0.2
            reasons.append(f"same {field}")

    pattern_fields = ['description', 'profile_details', 'documents_shared_keywords', 'referrer_source']
    for field in pattern_fields:
        if a[field] and b[field]:
            emb = model.encode([a[field], b[field]])
            sim = cosine_similarity([emb[0]], [emb[1]])[0][0]
            if sim > 0.3:
                score += sim * 0.1
                reasons.append(f"{field} similarity {sim:.2f}")

    return min(score, 1.0), reasons

def cross_db_match(db1, db2, threshold=0.5):
    results = []
    for i, row1 in db1.iterrows():
        for j, row2 in db2.iterrows():
            s, reasons = match_score(row1, row2)
            if s >= threshold:
                results.append((f"Victim {i}", f"Official {j}", s, "; ".join(reasons)))
    return sorted(results, key=lambda x: x[2], reverse=True)

def within_db_match(df, threshold=0.3):
    results = []
    for i in range(len(df)):
        for j in range(i + 1, len(df)):
            s, reasons = match_score(df.iloc[i], df.iloc[j])
            if s >= threshold:
                results.append((f"Victim {i}", f"Victim {j}", s, "; ".join(reasons)))
    return sorted(results, key=lambda x: x[2], reverse=True)

def ensure_all_columns(df):
    for field in ALL_FIELDS:
        if field not in df.columns:
            df[field] = ""
    return df

# -------- MAIN -------- #

if __name__ == "__main__":
    db1 = ensure_all_columns(load_csv_safe("victim_reports.csv"))
    db2 = ensure_all_columns(load_csv_safe("official_scam_records.csv"))

    set_fields = ['phones', 'bank_accounts', 'upi_ids', 'emails', 'websites',
                  'social_handles', 'ip_addresses', 'crypto_wallets', 'contact_methods']
    for df in [db1, db2]:
        for field in set_fields:
            if 'phone' in field and field != 'contact_methods':
                df[field] = df[field].apply(lambda x: set(normalize_phone(p) for p in str(x).split('|') if p and p != 'nan'))
            elif 'email' in field:
                df[field] = df[field].apply(lambda x: set(normalize_email(e) for e in str(x).split('|') if e and e != 'nan'))
            elif 'website' in field:
                df[field] = df[field].apply(lambda x: set(normalize_website(w) for w in str(x).split('|') if w and w != 'nan'))
            else:
                df[field] = df[field].apply(normalize_field)

    print("\n--- Cross Database Matches ---")
    for m in cross_db_match(db1, db2, threshold=0.5):
        print(f"{m[0]} <--> {m[1]} | Score: {m[2]:.2f} | Reasons: {m[3]}")

    print("\n--- Victim-to-Victim Matches ---")
    for m in within_db_match(db1, threshold=0.3):
        print(f"{m[0]} <--> {m[1]} | Score: {m[2]:.2f} | Reasons: {m[3]}")
