import os
import re
import sys
import numpy as np
import faiss
from pypdf import PdfReader
from sentence_transformers import SentenceTransformer, util
import groq
# --- NEW: Import the Tavily client for web search ---
from tavily import TavilyClient

# --- 1. Configuration ---
PDF_FILES = [
    "CyberCrime Manual.pdf",
    "Indore Cybercrime Details and Actions_.pdf",
    "it_act_2000_updated.pdf",
]

MODEL_NAME = 'all-mpnet-base-v2'
LLM_NAME = 'llama3-8b-8192' 

# --- 2. Load and Chunk PDFs ---
def chunk_documents(documents, chunk_size=1000, chunk_overlap=200):
    """
    Splits documents into overlapping chunks of a specified size.
    """
    all_chunks = []
    for doc in documents:
        text = doc['content']
        source = doc['source']
        text = re.sub(r'\s+', ' ', text).strip()
        if not text:
            continue
        start_index = 0
        while start_index < len(text):
            end_index = start_index + chunk_size
            chunk_content = text[start_index:end_index]
            all_chunks.append({"content": chunk_content, "source": source})
            start_index += chunk_size - chunk_overlap
    print(f"\nSuccessfully created {len(all_chunks)} chunks with a size of {chunk_size} and overlap of {chunk_overlap}.")
    return all_chunks

def get_pdf_text_and_metadata(file_paths):
    documents = []
    for file_path in file_paths:
        try:
            filename = os.path.basename(file_path)
            reader = PdfReader(file_path)
            full_text = ""
            for page in reader.pages:
                page_text = page.extract_text()
                if page_text:
                    full_text += page_text + "\n"
            documents.append({"content": full_text, "source": filename})
            print(f"Successfully loaded and extracted text from {filename}")
        except FileNotFoundError:
            print(f"Error: The file '{file_path}' was not found. Please check the path.")
        except Exception as e:
            print(f"Error reading {file_path}: {e}")
    return documents

# --- 3. Embed and Index ---
def create_vector_index(chunks, model):
    chunk_texts = [chunk['content'] for chunk in chunks]
    print(f"\nGenerating embeddings for {len(chunk_texts)} chunks...")
    embeddings = model.encode(chunk_texts, show_progress_bar=True, convert_to_numpy=True)
    faiss.normalize_L2(embeddings)
    d = embeddings.shape[1]
    index = faiss.IndexFlatIP(d)
    index.add(embeddings)
    print(f"FAISS index created successfully with {index.ntotal} vectors.")
    return index

# --- 4. Search ---
def search_index(query, model, index, chunks, k=5):
    query_vector = model.encode([query])
    faiss.normalize_L2(query_vector)
    distances, indices = index.search(query_vector, k)
    results = []
    for i in range(len(indices[0])):
        chunk_index = indices[0][i]
        if chunk_index < len(chunks):
             result_chunk = chunks[chunk_index]
             results.append({
                 "score": distances[0][i],
                 "content": result_chunk['content'],
                 "source": result_chunk['source']
             })
    return results

# --- NEW: Function to perform web search using Tavily ---
def search_web_for_context(query, tavily_client):
    """
    Performs a web search using the Tavily API and returns the context.
    """
    print("\nCould not find a relevant answer in local documents. Searching online...")
    try:
        response = tavily_client.search(query=query, search_depth="basic")
        # We will use the 'answer' if available, otherwise join the content of results
        if response.get("answer"):
            return response["answer"]
        
        context = "\n\n".join([result["content"] for result in response["results"]])
        return context
    except Exception as e:
        print(f"An error occurred during web search: {e}")
        return None

# --- 5. Synthesize and Format the Answer (Now with Web Search Fallback) ---
def generate_synthesized_answer(query, search_results, embedding_model, groq_client, tavily_client):
    # First, try to find an answer from the local documents
    query_emb = embedding_model.encode(query, convert_to_tensor=True)
    relevant_chunks = []
    sources = set()
    source_type = "local" # Start with local source type

    for result in search_results:
        chunk_emb = embedding_model.encode(result['content'], convert_to_tensor=True)
        similarity = util.cos_sim(query_emb, chunk_emb).item()
        if similarity > 0.5: # Using the lower threshold
            relevant_chunks.append(result['content'])
            sources.add(result['source'])

    # If no relevant chunks are found locally, use the web search fallback
    if not relevant_chunks:
        context = search_web_for_context(query, tavily_client)
        source_type = "web" # Change source type to web
        if not context:
            return "I could not find a relevant answer in your documents or online. Please try rephrasing your query."
    else:
        # If local chunks were found, use them as context
        relevant_chunks = list(dict.fromkeys(relevant_chunks))
        context = "\n\n---\n\n".join(relevant_chunks)

    # The rest of the function synthesizes the answer from the chosen context (local or web)
    system_prompt = """
    You are an expert assistant. Your task is to synthesize information from the provided context to answer the user's query.
    1.  Carefully read the User's Query and the provided CONTEXT.
    2.  Synthesize the information into a single, coherent, and practical answer.
    3.  If the context provides a sequence of actions or steps, present them as a clear, numbered list.
    4.  Begin your response with a direct answer to the query. Do NOT say "Based on the context provided...".
    """
    
    user_prompt = f"""
    User's Query: "{query}"

    CONTEXT:
    {context}
    ---
    
    Synthesized Answer:
    """

    print("\nSynthesizing the final answer with Groq...")
    
    try:
        chat_completion = groq_client.chat.completions.create(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            model=LLM_NAME,
            temperature=0.2,
            max_tokens=1024
        )
        final_answer = chat_completion.choices[0].message.content
    except Exception as e:
        final_answer = f"An error occurred while contacting the Groq API: {e}"

    # Add the appropriate citation at the end
    if source_type == "local" and sources:
        final_answer += f"\n\n*This information was synthesized from: {', '.join(sorted(list(sources)))}*"
    elif source_type == "web":
        final_answer += f"\n\n*This answer was generated using information from an online search.*"
        
    return final_answer

# --- Main Execution Block ---
if __name__ == "__main__":
    # --- Initialize Groq Client ---
    try:
        groq_client = groq.Groq(api_key=os.environ.get("GROQ_API_KEY"))
        print("Groq client initialized successfully.")
    except Exception as e:
        print(f"Error initializing Groq client: {e}\nPlease make sure your GROQ_API_KEY environment variable is set.")
        sys.exit()

    # --- NEW: Initialize Tavily Client ---
    try:
        tavily_api_key = os.environ.get("TAVILY_API_KEY")
        if not tavily_api_key:
            raise ValueError("TAVILY_API_KEY environment variable not set.")
        tavily_client = TavilyClient(api_key=tavily_api_key)
        print("Tavily client initialized successfully.")
    except Exception as e:
        print(f"Error initializing Tavily client: {e}")
        sys.exit()

    print("\nLoading the sentence transformer model...")
    embedding_model = SentenceTransformer(MODEL_NAME)
    
    documents = get_pdf_text_and_metadata(PDF_FILES)
    if not documents:
        print("\nNo documents were loaded. Exiting.")
        sys.exit()
    
    chunks = chunk_documents(documents, chunk_size=1000, chunk_overlap=200)
    if not chunks:
        print("\nError: Could not create any text chunks from the documents.")
        sys.exit()

    vector_index = create_vector_index(chunks, embedding_model)

    print("\n\n--- PDF Vector Search is Ready ---")
    print("Enter your query below (or type 'exit' to quit).")

    while True:
        user_query = input("\nQuery: ")
        if user_query.lower() == 'exit':
            break

        search_results = search_index(user_query, embedding_model, vector_index, chunks, k=5)
        
        # Pass the tavily_client to the answer generation function
        final_answer = generate_synthesized_answer(user_query, search_results, embedding_model, groq_client, tavily_client)
        
        print("\n--- Answer ---")
        print(final_answer)