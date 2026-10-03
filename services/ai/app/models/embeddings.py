import numpy as np
from sentence_transformers import SentenceTransformer

MAX_CHARS = 1500


class Embedder:
    def __init__(self, name):
        self.model = SentenceTransformer(name)

    def encode(self, text):
        return self.encode_many([text])[0]

    def encode_many(self, texts):
        vectors = self.model.encode(
            [t[:MAX_CHARS] for t in texts], normalize_embeddings=True, batch_size=32
        )
        return np.asarray(vectors, dtype=np.float32)
