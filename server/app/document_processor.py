import io
import os
from typing import List, Optional, Tuple
from PyPDF2 import PdfReader
from docx import Document
from app.config import settings


def extract_text_from_pdf(file_content: bytes) -> str:
    """Extract text from PDF file"""
    try:
        pdf_file = io.BytesIO(file_content)
        reader = PdfReader(pdf_file)
        text = ""
        for page in reader.pages:
            text += page.extract_text() + "\n"
        return text.strip()
    except Exception as e:
        raise ValueError(f"Error extracting text from PDF: {str(e)}")


def extract_text_from_docx(file_content: bytes) -> str:
    """Extract text from DOCX file"""
    try:
        docx_file = io.BytesIO(file_content)
        doc = Document(docx_file)
        text = "\n".join([paragraph.text for paragraph in doc.paragraphs])
        return text.strip()
    except Exception as e:
        raise ValueError(f"Error extracting text from DOCX: {str(e)}")


def extract_text_from_txt(file_content: bytes) -> str:
    """Extract text from TXT file"""
    try:
        return file_content.decode('utf-8').strip()
    except UnicodeDecodeError:
        # Try with different encoding
        return file_content.decode('latin-1').strip()


def extract_text(file_content: bytes, file_type: str) -> str:
    """Extract text based on file type"""
    if file_type == "pdf":
        return extract_text_from_pdf(file_content)
    elif file_type == "docx":
        return extract_text_from_docx(file_content)
    elif file_type == "txt":
        return extract_text_from_txt(file_content)
    else:
        raise ValueError(f"Unsupported file type: {file_type}")


def chunk_text(text: str, chunk_size: int = None, overlap: int = None) -> List[str]:
    """Split text into chunks with overlap"""
    if chunk_size is None:
        chunk_size = settings.CHUNK_SIZE
    if overlap is None:
        overlap = settings.CHUNK_OVERLAP
    
    chunks = []
    start = 0
    text_length = len(text)
    
    while start < text_length:
        end = start + chunk_size
        chunk = text[start:end]
        
        if chunk.strip():
            chunks.append(chunk.strip())
        
        start += chunk_size - overlap
    
    return chunks


def process_document(file_content: bytes, filename: str) -> Tuple[List[str], str, List[Optional[int]]]:
    """Process document: extract text and split into chunks"""
    # Get file extension
    file_ext = filename.rsplit('.', 1)[1].lower() if '.' in filename else ''

    if file_ext == "pdf":
        pdf_file = io.BytesIO(file_content)
        reader = PdfReader(pdf_file)
        chunks: List[str] = []
        page_numbers: List[Optional[int]] = []

        for page_idx, page in enumerate(reader.pages):
            page_text = (page.extract_text() or "").strip()
            if not page_text:
                continue

            page_chunks = chunk_text(page_text)
            for chunk in page_chunks:
                chunks.append(chunk)
                page_numbers.append(page_idx + 1)

        if not chunks:
            raise ValueError("No text could be extracted from the document")

        return chunks, file_ext, page_numbers

    # Extract text for non-PDF files
    text = extract_text(file_content, file_ext)

    if not text:
        raise ValueError("No text could be extracted from the document")

    chunks = chunk_text(text)
    page_numbers = [None] * len(chunks)

    return chunks, file_ext, page_numbers
