from typing import Any, Dict, List, Optional

from pymongo import ASCENDING, MongoClient
from sentence_transformers import SentenceTransformer

from app.config import settings


class VectorStore:
    def __init__(self):
        self.client: Optional[MongoClient] = None
        self.embedding_model: Optional[SentenceTransformer] = None
        self.collection = None

    def initialize(self):
        """Initialize MongoDB-backed vector store and embedding model."""
        self.client = MongoClient(
            settings.MONGODB_URL,
            serverSelectionTimeoutMS=5000,
            connectTimeoutMS=5000,
            socketTimeoutMS=5000,
        )
        database = self.client[settings.VECTOR_DATABASE_NAME]
        self.collection = database[settings.VECTOR_COLLECTION_NAME]

        self.collection.create_index([("vector_id", ASCENDING)], unique=True)
        self.collection.create_index([("course_id", ASCENDING)])
        self.collection.create_index([("metadata.document_id", ASCENDING)])
        self.collection.create_index([("metadata.filename", ASCENDING)])

        self._ensure_vector_search_index()
        self.embedding_model = SentenceTransformer(settings.EMBEDDING_MODEL)
        print("✅ Initialized MongoDB vector store and embedding model")

    def _ensure_vector_search_index(self):
        """Ensure Atlas Vector Search index exists for embeddings."""
        if self.client is None:
            raise RuntimeError("Vector store is not initialized")

        database = self.client[settings.VECTOR_DATABASE_NAME]
        try:
            database.command(
                {
                    "createSearchIndexes": settings.VECTOR_COLLECTION_NAME,
                    "indexes": [
                        {
                            "name": settings.VECTOR_SEARCH_INDEX_NAME,
                            "type": "vectorSearch",
                            "definition": {
                                "fields": [
                                    {
                                        "type": "vector",
                                        "path": "embedding",
                                        "numDimensions": settings.VECTOR_DIMENSIONS,
                                        "similarity": "cosine",
                                    },
                                    {
                                        "type": "filter",
                                        "path": "course_id",
                                    },
                                    {
                                        "type": "filter",
                                        "path": "metadata.filename",
                                    },
                                ]
                            },
                        }
                    ],
                }
            )
        except Exception as exc:
            text = str(exc)
            if "already exists" in text.lower() or "index already exists" in text.lower():
                return
            print(f"⚠️ Could not auto-create vector index: {exc}")

    def close(self):
        """Close vector store Mongo client."""
        if self.client is not None:
            self.client.close()
            self.client = None
            self.collection = None

    def delete_collection(self, course_id: str):
        """Delete all vectors for a course."""
        if self.collection is None:
            raise RuntimeError("Vector store is not initialized")
        self.collection.delete_many({"course_id": course_id})

    def delete_document(self, document_id: str):
        """Delete all vectors for a single document."""
        if self.collection is None:
            raise RuntimeError("Vector store is not initialized")
        self.collection.delete_many({"metadata.document_id": document_id})

    def embed_text(self, text: str) -> List[float]:
        """Generate embedding for text."""
        if self.embedding_model is None:
            raise RuntimeError("Embedding model is not initialized")
        return self.embedding_model.encode(text).tolist()

    def add_documents(self, course_id: str, documents: list, metadatas: list, ids: list):
        """Add document chunks and embeddings to MongoDB."""
        if self.collection is None:
            raise RuntimeError("Vector store is not initialized")

        embeddings = [self.embed_text(doc) for doc in documents]
        records = []
        for idx, doc in enumerate(documents):
            metadata = metadatas[idx] if idx < len(metadatas) else {}
            records.append(
                {
                    "vector_id": ids[idx],
                    "course_id": course_id,
                    "content": doc,
                    "metadata": metadata,
                    "embedding": embeddings[idx],
                }
            )

        if records:
            self.collection.insert_many(records, ordered=False)

    def _build_filter(self, course_id: str, where: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        query_filter: Dict[str, Any] = {"course_id": course_id}
        if not where:
            return query_filter

        for key, value in where.items():
            if key == "filename":
                query_filter["metadata.filename"] = value
            elif key.startswith("metadata."):
                query_filter[key] = value
            else:
                query_filter[f"metadata.{key}"] = value

        return query_filter

    def search(
        self,
        course_id: str,
        query: str,
        n_results: int = 3,
        where: Optional[Dict[str, Any]] = None,
    ):
        """Search for similar chunks using Atlas Vector Search."""
        if self.collection is None:
            raise RuntimeError("Vector store is not initialized")

        query_embedding = self.embed_text(query)
        query_filter = self._build_filter(course_id, where)

        pipeline = [
            {
                "$vectorSearch": {
                    "index": settings.VECTOR_SEARCH_INDEX_NAME,
                    "path": "embedding",
                    "queryVector": query_embedding,
                    "numCandidates": max(n_results * 20, 100),
                    "limit": n_results,
                    "filter": query_filter,
                }
            },
            {
                "$project": {
                    "_id": 0,
                    "vector_id": 1,
                    "content": 1,
                    "metadata": 1,
                    "score": {"$meta": "vectorSearchScore"},
                }
            },
        ]

        docs = list(self.collection.aggregate(pipeline))

        return {
            "ids": [[item.get("vector_id") for item in docs]],
            "documents": [[item.get("content", "") for item in docs]],
            "metadatas": [[item.get("metadata", {}) for item in docs]],
            "distances": [[item.get("score", 0.0) for item in docs]],
        }

    def get_chunks_by_filename(self, course_id: str, filename: str, limit: int = 5) -> List[Dict[str, Any]]:
        """Get chunks for one filename from a course."""
        if self.collection is None:
            raise RuntimeError("Vector store is not initialized")

        cursor = (
            self.collection.find(
                {
                    "course_id": course_id,
                    "metadata.filename": filename,
                },
                {
                    "_id": 0,
                    "content": 1,
                    "metadata": 1,
                },
            )
            .sort("metadata.chunk_index", ASCENDING)
            .limit(limit)
        )

        chunks: List[Dict[str, Any]] = []
        for item in cursor:
            chunks.append(
                {
                    "content": item.get("content", ""),
                    "metadata": item.get("metadata", {}) or {},
                }
            )
        return chunks

vector_store = VectorStore()
