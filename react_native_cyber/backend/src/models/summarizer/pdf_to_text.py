import fitz  # PyMuPDF
import pytesseract
from PIL import Image
import os
import io

def extract_text_from_pdf(pdf_path):
    """
    Extracts text from a PDF file, using OCR for image-based pages.

    Args:
        pdf_path (str): The full path to the PDF file.

    Returns:
        str: The extracted text from the entire PDF, or an error message.
    """
    if not os.path.exists(pdf_path):
        return f"Error: The file '{pdf_path}' was not found."

    # --- WINDOWS ONLY CONFIGURATION ---
    # If the script cannot find your Tesseract installation, uncomment
    # the following line and set the correct path to tesseract.exe.
    pytesseract.pytesseract.tesseract_cmd = r'D:\Tesseract\tesseract.exe'

    full_text = ""
    
    print(f"Opening PDF: {pdf_path}...")
    try:
        doc = fitz.open(pdf_path)
    except Exception as e:
        return f"Error: Could not open or process the PDF file. Details: {e}"

    print(f"Found {len(doc)} pages to process.")

    # Iterate through each page of the PDF
    for page_num, page in enumerate(doc):
        print(f"Processing page {page_num + 1}/{len(doc)}...")
        
        # 1. First, try to extract text directly
        text = page.get_text()
        
        # If direct extraction yields significant text, use it.
        # The threshold helps ignore pages with only minor text fragments.
        if len(text.strip()) > 100:
            print(f"  -> Extracted text directly from page {page_num + 1}.")
            full_text += f"\n--- Page {page_num + 1} ---\n"
            full_text += text
            continue

        # 2. If direct extraction fails, use OCR
        print(f"  -> No significant text found. Attempting OCR on page {page_num + 1}.")
        try:
            # Render the page to an image (pixmap)
            # We increase the zoom/dpi for better OCR accuracy
            pix = page.get_pixmap(dpi=300)
            
            # Convert the pixmap into a format that PIL can read
            img_data = pix.tobytes("png")
            image = Image.open(io.BytesIO(img_data))
            
            # Use Tesseract to extract text from the image
            ocr_text = pytesseract.image_to_string(image)
            
            if ocr_text.strip():
                print(f"  -> Successfully extracted text with OCR from page {page_num + 1}.")
                full_text += f"\n--- Page {page_num + 1} (OCR) ---\n"
                full_text += ocr_text
            else:
                print(f"  -> OCR found no text on page {page_num + 1}.")

        except Exception as e:
            print(f"  -> Could not perform OCR on page {page_num + 1}. Error: {e}")

    doc.close()
    return full_text

def save_text_to_file(text, output_filename):
    """
    Saves the extracted text to a .txt file.

    Args:
        text (str): The text content to save.
        output_filename (str): The name of the output file.
    """
    try:
        with open(output_filename, 'w', encoding='utf-8') as f:
            f.write(text)
        print(f"\nSuccessfully saved extracted text to '{output_filename}'")
    except Exception as e:
        print(f"\nError: Could not save the text to a file. Details: {e}")


# --- Main execution block ---
if __name__ == "__main__":
    # Get the PDF file path from the user
    pdf_file_path = input("Please enter the full path to your PDF file: ").strip()

    # Clean up the path (removes quotes if user drags and drops file)
    pdf_file_path = pdf_file_path.strip('\"\'')

    if pdf_file_path:
        # Extract the text
        extracted_text = extract_text_from_pdf(pdf_file_path)
        
        if extracted_text and not extracted_text.startswith("Error:"):
            # Create a name for the output text file
            base_name = os.path.basename(pdf_file_path)
            file_name_without_ext = os.path.splitext(base_name)[0]
            output_txt_file = f"{file_name_without_ext}_extracted.txt"
            
            # Save the text to the file
            save_text_to_file(extracted_text, output_txt_file)
        else:
            print(extracted_text) # Print the error message
    else:
        print("No file path provided. Please run the script again.")