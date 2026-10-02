import json
from pathlib import Path

from jsonschema import Draft7Validator

from app import config


def signal_validator():
    path = Path(config.CONTRACTS_DIR) / "signal.v1.schema.json"
    return Draft7Validator(json.loads(path.read_text()))
