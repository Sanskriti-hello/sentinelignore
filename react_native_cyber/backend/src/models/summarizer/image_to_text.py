import pytesseract
from PIL import Image
def extract_text_from_image(image_path):
    """
    Extracts text from an image file using Tesseract OCR.
    """
    # For Windows users: If Tesseract is not in your system's PATH,
    # uncomment the line below and set the path to your Tesseract installation.
    pytesseract.pytesseract.tesseract_cmd = r"D:\Tesseract\tesseract.exe"
    try:
        return pytesseract.image_to_string(Image.open(image_path))
    except FileNotFoundError:
        return f"ERROR: The image file was not found at '{image_path}'. Please check the file name and path."
    except Exception as e:
        # This will catch errors if Tesseract is not installed or configured correctly.
        return f"ERROR: Could not process image. Ensure Tesseract is installed and configured. Details: {e}"

if __name__ == "__main__":
    # Example usage
    image_path = "1.jpg"  # Replace with your image file path
    extracted_text = extract_text_from_image(image_path)
    print(f"Extracted Text:\n{extracted_text}")