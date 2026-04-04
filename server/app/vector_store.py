import chromadb
from chromadb.config import Settings as ChromaSettings
from sentence_transformers import SentenceTransformer
from app.config import settings
from typing import Optional

class VectorStore:
    def __init__(self):
        self.client: Optional[chromadb.ClientAPI] = None
        self.embedding_model: Optional[SentenceTransformer] = None
    
    def initialize(self):
        """Initialize ChromaDB and embedding model"""
        self.client = chromadb.PersistentClient(
            path=settings.CHROMA_PERSIST_DIRECTORY,
            settings=ChromaSettings(anonymized_telemetry=False)
        )
        self.embedding_model = SentenceTransformer(settings.EMBEDDING_MODEL)
        print("✅ Initialized ChromaDB and embedding model")
    
    def get_or_create_collection(self, course_id: str):
        """Get or create collection for a course"""
        collection_name = f"course_{course_id}"
        return self.client.get_or_create_collection(
            name=collection_name,
            metadata={"course_id": course_id}
        )
    
    def delete_collection(self, course_id: str):
        """Delete collection for a course"""
        collection_name = f"course_{course_id}"
        try:
            self.client.delete_collection(name=collection_name)
        except Exception as e:
            print(f"Error deleting collection: {e}")
    
    def embed_text(self, text: str):
        """Generate embedding for text"""
        return self.embedding_model.encode(text).tolist()
    
    def add_documents(self, course_id: str, documents: list, metadatas: list, ids: list):
        """Add documents to collection"""
        collection = self.get_or_create_collection(course_id)
        embeddings = [self.embed_text(doc) for doc in documents]
        collection.add(
            documents=documents,
            metadatas=metadatas,
            ids=ids,
            embeddings=embeddings
        )
    
    def search(self, course_id: str, query: str, n_results: int = 3):
        """Search for similar documents"""
        collection = self.get_or_create_collection(course_id)
        query_embedding = self.embed_text(query)
        results = collection.query(
            query_embeddings=[query_embedding],
            n_results=n_results
        )
        return results

vector_store = VectorStore()
