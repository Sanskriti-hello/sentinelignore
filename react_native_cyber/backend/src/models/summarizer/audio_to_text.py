import whisper

# print("Loading Whisper model...")
# # The 'base' model is a good starting point. Other options are 'tiny', 'small', 'medium', 'large'.
# model = whisper.load_model("base")

# print("Transcribing audio...")
# result = model.transcribe("2.wav") # You can use MP3 or WAV files directly

# print("\nTranscription:")
# print(result["text"])

def extract_text_from_audio(audio_file):
    model = whisper.load_model("base")
    result = model.transcribe(audio_file)
    return result["text"]