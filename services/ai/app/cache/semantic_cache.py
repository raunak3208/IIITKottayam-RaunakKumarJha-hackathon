import hashlib
import json
import re

from redis.commands.search.field import TagField, TextField, VectorField
from redis.commands.search.indexDefinition import IndexDefinition, IndexType
from redis.commands.search.query import Query
from redis.exceptions import ResponseError

INDEX = "idx:semcache"
PREFIX = "semcache:"

WORD = re.compile(r"[a-z']+")
NUMBER = re.compile(r"\d+(?:[.,]\d+)*")

NEGATIONS = {
    "not", "no", "never", "without", "unable", "cannot", "can't", "won't", "isn't", "wasn't",
    "didn't", "doesn't", "fail", "fails", "failed", "deny", "denies", "denied", "reject",
    "rejects", "rejected", "block", "blocks", "blocked", "halt", "halts", "halted",
    "cancel", "cancels", "cancelled", "canceled",
}
UP = {
    "rise", "rises", "rose", "gain", "gains", "gained", "jump", "jumps", "surge", "surges",
    "soar", "soars", "up", "higher", "raise", "raises", "raised", "increase", "increases",
    "climb", "climbs", "rally", "rallies", "beats", "tops", "hike", "hikes", "hiked",
}
DOWN = {
    "fall", "falls", "fell", "drop", "drops", "dropped", "decline", "declines", "slump",
    "slumps", "plunge", "plunges", "down", "lower", "cut", "cuts", "decrease", "decreases",
    "slide", "slides", "sink", "sinks", "misses", "slashes",
}


def scope_key(tickers):
    cleaned = ["".join(c for c in t if c.isalnum()) for t in sorted(tickers)]
    return "_".join(cleaned) or "MARKET"


def meaning_flip(a, b):
    ta, tb = WORD.findall(a.lower()), WORD.findall(b.lower())
    if sum(w in NEGATIONS for w in ta) % 2 != sum(w in NEGATIONS for w in tb) % 2:
        return True
    if set(NUMBER.findall(a)) != set(NUMBER.findall(b)):
        return True
    a_up, a_down = bool(UP & set(ta)), bool(DOWN & set(ta))
    b_up, b_down = bool(UP & set(tb)), bool(DOWN & set(tb))
    return (a_up and not a_down and b_down and not b_up) or (
        a_down and not a_up and b_up and not b_down
    )


def _text(value):
    return value.decode() if isinstance(value, bytes) else value


class SemanticCache:
    def __init__(self, client, threshold, ttl, dim, on_flip=None):
        self.client = client
        self.threshold = threshold
        self.ttl = ttl
        self.dim = dim
        self.on_flip = on_flip or (lambda: None)
        self._ensure_index()

    def _ensure_index(self):
        try:
            self.client.ft(INDEX).info()
        except ResponseError:
            schema = (
                TagField("scope"),
                TextField("text"),
                VectorField(
                    "embedding",
                    "HNSW",
                    {"TYPE": "FLOAT32", "DIM": self.dim, "DISTANCE_METRIC": "COSINE"},
                ),
            )
            definition = IndexDefinition(prefix=[PREFIX], index_type=IndexType.HASH)
            self.client.ft(INDEX).create_index(schema, definition=definition)

    def lookup(self, embedding, tickers, text):
        scope = scope_key(tickers)
        query = (
            Query(f"(@scope:{{{scope}}})=>[KNN 3 @embedding $vec AS dist]")
            .sort_by("dist")
            .return_fields("dist", "text", "payload")
            .dialect(2)
        )
        result = self.client.ft(INDEX).search(query, query_params={"vec": embedding.tobytes()})
        for doc in result.docs:
            similarity = 1 - float(_text(doc.dist))
            if similarity < self.threshold:
                break
            if meaning_flip(text, _text(doc.text)):
                self.on_flip()
                continue
            return json.loads(_text(doc.payload)), similarity
        return None, None

    def store(self, embedding, tickers, text, payload):
        scope = scope_key(tickers)
        key = PREFIX + hashlib.sha1(f"{scope}|{text}".encode()).hexdigest()[:16]
        self.client.hset(
            key,
            mapping={
                "scope": scope,
                "text": text[:1500],
                "embedding": embedding.tobytes(),
                "payload": json.dumps(payload),
            },
        )
        self.client.expire(key, self.ttl)
