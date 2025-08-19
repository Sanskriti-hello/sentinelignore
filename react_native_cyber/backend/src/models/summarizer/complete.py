import json
from pdf_to_text import extract_text_from_pdf
from image_to_text import extract_text_from_image
from summarizer import get_incident_details_from_text, get_narrative_summary
from classifier import classify_cybercrime
from contradict import contradiction_in_complain_and_evidences
from audio_to_text import extract_text_from_audio
from video_to_text import extract_details_from_video

complaint = input("Enter the complaint: ")
pdf_path = input("Enter the path to the PDF file (if any): ")
image_path = input("Enter the path to the image file (if any): ")
audio_file_path = input("Enter the path to the audio file (if any): ")
video_file_path = input("Enter the path to the video file (if any): ")

image_text = extract_text_from_image(image_path) if image_path else ""
pdf_text = extract_text_from_pdf(pdf_path) if pdf_path else ""
audio_text = extract_text_from_audio(audio_file_path) if audio_file_path else ""
video_details = extract_details_from_video(video_file_path) if video_file_path else {"transcribed_audio": "", "text_from_frames": []}
text_from_video_audio = video_details.get("transcribed_audio", "")
text_from_video_frames = " ".join(video_details.get("text_from_frames", []))

if image_path or pdf_path:
    contradiction_text, contradiction = contradiction_in_complain_and_evidences(complaint, image_text, pdf_text, audio_text, text_from_video_audio, text_from_video_frames)
    if contradiction:
        print("Contradiction found in the complaint and evidence.")
        print(json.dumps(contradiction_text, indent=2))

narrative_summary = get_narrative_summary(complaint, image_text, pdf_text, audio_text, text_from_video_audio, text_from_video_frames)
incident_details = get_incident_details_from_text(complaint, image_text, pdf_text, audio_text, text_from_video_audio, text_from_video_frames)

if narrative_summary:
    print("\n--- Summary ---")
    print(narrative_summary)

if incident_details:
    print("\n--- Relevant Departments ---")
    print(json.dumps(incident_details['relevant_department'], indent=2))
    classification, score = classify_cybercrime(incident_details)
    print("\n--- Priority Classification ---")
    print(f"Priority: {classification}")