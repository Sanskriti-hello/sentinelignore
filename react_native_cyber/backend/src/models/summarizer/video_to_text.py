import os
import whisper
from moviepy.editor import VideoFileClip
from PIL import Image
import pytesseract
import math

# Load the Whisper model (using "base" is a good starting point)
whisper_model = whisper.load_model("base")

def extract_details_from_video(video_path):
    """
    Extracts details from a video by transcribing its audio and performing OCR on keyframes.

    Args:
        video_path (str): The path to the video file.

    Returns:
        dict: A dictionary containing the transcribed audio and text found in frames.
    """
    if not os.path.exists(video_path):
        return {"error": "Video file not found."}

    print(f"Processing video: {video_path}")
    video = VideoFileClip(video_path)
    
    # --- 1. Audio Transcription ---
    audio_text = ""
    temp_audio_path = "temp_audio.wav"
    try:
        if video.audio:
            print("Extracting and transcribing audio...")
            # Extract audio and save it as a temporary WAV file
            video.audio.write_audiofile(temp_audio_path)
            
            # Transcribe the audio file using Whisper
            result = whisper_model.transcribe(temp_audio_path)
            audio_text = result.get("text", "").strip()
            print("Audio transcription complete.")
        else:
            print("No audio track found in the video.")
    except Exception as e:
        audio_text = f"Could not process audio: {e}"
    finally:
        # Clean up the temporary audio file
        if os.path.exists(temp_audio_path):
            os.remove(temp_audio_path)

    # --- 2. Frame Analysis using OCR ---
    frame_texts = set() # Use a set to store unique text snippets
    try:
        print("Analyzing video frames for text...")
        # Analyze one frame every 2 seconds
        for i in range(0, math.floor(video.duration), 2):
            # Get frame as a NumPy array
            frame = video.get_frame(i)
            # Convert frame to a PIL Image
            pil_image = Image.fromarray(frame)
            
            # Perform OCR on the image
            pytesseract.pytesseract.tesseract_cmd = r"D:\Tesseract\tesseract.exe"
            text = pytesseract.image_to_string(pil_image)
            
            # Clean and store the text if it's significant
            cleaned_text = text.strip()
            if len(cleaned_text) > 5: # Ignore very short/irrelevant OCR results
                frame_texts.add(cleaned_text)
        print("Frame analysis complete.")
    except Exception as e:
        frame_texts.add(f"Could not process frames: {e}")

    video.close()
    
    return {
        "transcribed_audio": audio_text,
        "text_from_frames": list(frame_texts) # Convert set to list for the final output
    }

# --- Example Usage ---
if __name__ == "__main__":
    # Replace with the path to your video evidence file
    video_file = "1.mp4" 
    
    details = extract_details_from_video(video_file)

    print("\n--- EXTRACTED DETAILS ---")
    print("\n## Transcribed Audio:")
    print(details.get("transcribed_audio", "N/A"))
    
    print("\n## Text Found in Video Frames:")
    text_from_video = details.get("text_from_frames", [])
    if text_from_video:
        for text_block in text_from_video:
            print("-" * 20)
            print(text_block)
    else:
        print("N/A")