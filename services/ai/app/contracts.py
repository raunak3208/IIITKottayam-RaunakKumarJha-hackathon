import json
from pathlib import Path

from jsonschema import Draft7Validator

from app import config


def validator(name):
    path = Path(config.CONTRACTS_DIR) / f"{name}.v1.schema.json"
    return Draft7Validator(json.loads(path.read_text()))


def signal_validator():
    return validator("signal")
